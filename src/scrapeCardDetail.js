const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// 선택: --save 플래그 시 DB 저장, 범위 처리 지원
let saveToDb = false;
const positionals = [];

for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg === '--save') {
    saveToDb = true;
  } else {
    positionals.push(arg);
  }
}

if (positionals.length === 0) {
  console.error('사용법: node src/scrapeCardDetail.js <cardId|url | start~end | start-end | start end> [--save]');
  process.exit(1);
}

function buildDetailUrl(target) {
  if (/^https?:\/\//i.test(target)) return target;
  const id = String(target).trim();
  return `https://www.card-gorilla.com/card/detail/${id}`;
}

function extractIdFromUrl(u) {
  try {
    const url = new URL(u);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts[parts.length - 1];
    const num = Number(idx);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 600;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight - 50) {
          clearInterval(timer);
          resolve();
        }
      }, 150);
    });
  });
}

function normalizeWhitespace(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim();
}

async function scrapeCardDetail(targetUrl, idHint) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  );
  await page.setRequestInterception(true);
  page.on('request', req => {
    const resourceType = req.resourceType();
    if (['image', 'media', 'font'].includes(resourceType)) {
      req.continue(); // 이미지도 필요할 수 있어 일단 허용
    } else {
      req.continue();
    }
  });

  try {
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60_000 });
    await page.waitForSelector('body', { timeout: 30_000 });

    // 초기 대기 + 스크롤로 지연 로딩 컨텐츠 확보 
    await autoScroll(page);

    // dt 토글이 있는 경우 모두 클릭하여 다음 dt가 나오기 전까지의 모든 dd가 생성 및 표시되도록 전개
    async function expandAllDt() {
      const dtHandles = await page.$$('dt');
      for (const dt of dtHandles) {
        try {
          // 현재 dt 이후 다음 dt 전까지 보이는 dd가 존재하는지 검사
          const hasVisible = await dt.evaluate(el => {
            let sib = el.nextElementSibling;
            while (sib && sib.tagName) {
              const tag = sib.tagName.toLowerCase();
              if (tag === 'dt') break;
              if (tag === 'dd') {
                const s = window.getComputedStyle(sib);
                if (s.display !== 'none' && s.visibility !== 'hidden' && sib.clientHeight > 0) return true;
              }
              sib = sib.nextElementSibling;
            }
            return false;
          });

          if (!hasVisible) {
            // 클릭하여 dd 생성/표시 유도
            await dt.evaluate(el => el.scrollIntoView({ block: 'center' }));
            await dt.click({ delay: 20 });
            // 다음 dt 전까지 하나 이상의 dd가 보일 때까지 대기
            await page.waitForFunction(el => {
              let sib = el.nextElementSibling;
              while (sib && sib.tagName) {
                const tag = sib.tagName.toLowerCase();
                if (tag === 'dt') break;
                if (tag === 'dd') {
                  const s = window.getComputedStyle(sib);
                  if (s.display !== 'none' && s.visibility !== 'hidden' && sib.clientHeight > 0) return true;
                }
                sib = sib.nextElementSibling;
              }
              return false;
            }, {}, dt);
            await page.waitForTimeout(50);
          }
        } catch (_) {}
      }
    }

    await expandAllDt();

    const data = await page.evaluate(() => {
      const bySelectorText = (selectorList) => {
        for (const sel of selectorList) {
          const el = document.querySelector(sel);
          if (el && el.textContent) return el.textContent.trim();
        }
        return '';
      };

      const byMeta = (property) => {
        const el = document.querySelector(`meta[property="${property}"]`);
        return el?.getAttribute('content')?.trim() || '';
      };

      const grabAll = (selector) => Array.from(document.querySelectorAll(selector)).map(el => el.textContent?.trim()).filter(Boolean);

      const textNearLabel = (labels) => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
        const found = [];
        while (walker.nextNode()) {
          const el = walker.currentNode;
          const text = el.textContent?.trim() || '';
          if (!text) continue;
          if (labels.some(lb => text.includes(lb))) {
            // 우선 형제 텍스트, 그 다음 인접 영역 텍스트
            let siblingText = '';
            if (el.nextElementSibling) siblingText = el.nextElementSibling.textContent?.trim() || '';
            if (!siblingText && el.parentElement) siblingText = el.parentElement.textContent?.trim() || '';
            found.push(siblingText || text);
          }
        }
        return found[0] || '';
      };

      // 이름, 이미지, 설명 추출
      const ogTitle = byMeta('og:title');
      const ogImage = byMeta('og:image');
      const ogDesc = byMeta('og:description');

      const nameCandidate = bySelectorText([
        'h1',
        'h2',
        '.card-title',
        '.wrap_title h2',
        '.wrap_title .tit_h2',
        '.detail-title',
      ]) || ogTitle;

      // 카드 이미지 백업 선택자
      const imageCandidate = (() => {
        const img1 = document.querySelector('.card_img img');
        if (img1?.src) return img1.src;
        const img2 = document.querySelector('.detail img');
        if (img2?.src) return img2.src;
        return ogImage;
      })();

      // 점수, 랭킹 등 레이블 기반 추출
      const scoreText = textNearLabel(['점수', '평점', 'Score']);
      const rankingText = textNearLabel(['랭킹', '순위', 'Ranking']);

      // 혜택 섹션: 제목과 항목 수집
      const benefitSections = [];
      const possibleBenefitSelectors = [
        '.benefit',
        '.benefits',
        '.benefit_list',
        '.list_benefit',
        '.wrap_benefit',
        '[class*="benefit"] ul',
      ];
      for (const sel of possibleBenefitSelectors) {
        const lists = Array.from(document.querySelectorAll(sel));
        for (const list of lists) {
          const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim()).filter(Boolean);
          if (items.length) {
            benefitSections.push({ title: '', items });
          }
        }
      }

      // 태그/칩 형태의 혜택 키워드 추출
      const benefitTags = grabAll('.tag, .chip, .badge, [class*="tag"], [class*="chip"]');

      // 브랜드 텍스트/로고 ALT 수집
      const brandNames = (() => {
        const names = new Set();
        const brandContainers = document.querySelectorAll('[class*="brand"], .wrap_brand, .brand_list');
        brandContainers.forEach(c => {
          c.querySelectorAll('img[alt]').forEach(img => names.add(img.getAttribute('alt')));
          c.querySelectorAll('li, span, a, div').forEach(el => {
            const t = el.textContent?.trim();
            if (t && /비자|마스터|아멕스|JCB|유니온페이|Visa|Master|Amex|JCB|UnionPay/i.test(t)) names.add(t);
          });
        });
        return Array.from(names).filter(Boolean);
      })();

      // 이벤트/프로모션 타이틀 후보
      const eventTitle = bySelectorText(['.event_title', '.badge-event', '.event .title']) || '';

      // dt / dd 섹션 수집 (토글 전개 후): 각 dt 이후 다음 dt가 나오기 전까지의 모든 dd 수집
      const dtddSections = Array.from(document.querySelectorAll('dt')).flatMap(dt => {
        const title = dt.textContent?.trim() || '';
        const entries = [];
        let sib = dt.nextElementSibling;
        while (sib && sib.tagName) {
          const tag = sib.tagName.toLowerCase();
          if (tag === 'dt') break;
          if (tag === 'dd') {
            const html = sib.innerHTML?.trim() || '';
            const text = sib.textContent?.replace(/\s+/g, ' ').trim() || '';
            const items = Array.from(sib.querySelectorAll('li, p')).map(el => el.textContent?.trim()).filter(Boolean);
            entries.push({ title, html, text, items });
          }
          sib = sib.nextElementSibling;
        }
        return entries;
      });

      return {
        name: nameCandidate || '',
        card_img: imageCandidate || '',
        event_title: eventTitle || ogDesc || '',
        score_raw: scoreText || '',
        ranking_raw: rankingText || '',
        dtddSections,
        top_benefit: benefitSections.flatMap(sec => (sec.items || []).slice(0, 20)).map((t, i) => ({
          idx: i + 1,
          title: t,
          tags: benefitTags.slice(0, 10),
          logo_img: { url: '', name: '' },
          inputValue: ''
        })),
        brand: brandNames.map((b, i) => ({
          no: i + 1,
          idx: i + 1,
          code: '',
          name: b,
          reg_dt: '',
          checked: false,
          logo_img: { url: '', name: '' },
          is_visible: true
        }))
      };
    });

    // 후처리 정규화
    const normalized = {
      card_idx: idHint || extractIdFromUrl(targetUrl) || undefined,
      name: normalizeWhitespace(data.name),
      brand: data.brand,
      top_benefit: data.top_benefit,
      score: (() => {
        const m = String(data.score_raw || '').match(/([0-9]+(?:\.[0-9]+)?)/);
        return m ? Number(m[1]) : undefined;
      })(),
      card_img: data.card_img,
      event_title: normalizeWhitespace(data.event_title),
      ranking: (() => {
        const m = String(data.ranking_raw || '').match(/([0-9]{1,4})/);
        return m ? Number(m[1]) : undefined;
      })(),
      compared: undefined,
      is_visible: 1,
      pr_view_mode: undefined,
      detail_sections: Array.isArray(data.dtddSections) ? data.dtddSections : []
    };

    await browser.close();
    return normalized;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function main() {
  // 입력 파싱: 단일 cardId/url 또는 범위(start~end | start-end | start end)
  const first = positionals[0];
  const second = positionals[1];

  const tryParseRange = (a, b) => {
    const m = String(a).match(/^(\d+)\s*(?:~|-|\.\.)\s*(\d+)$/);
    if (m) return { start: Number(m[1]), end: Number(m[2]) };
    if (a && b && /^\d+$/.test(a) && /^\d+$/.test(b)) return { start: Number(a), end: Number(b) };
    return null;
  };

  const range = tryParseRange(first, second);
  if (range) {
    const { start, end } = range;
    if (start > end) {
      console.error('범위 오류: 시작 값이 끝 값보다 큽니다.');
      process.exit(1);
    }
    console.log(`범위 스크래핑 시작: ${start} ~ ${end}`);

    // DB 연결은 옵션 사용 시 한 번만 열고 한 번만 닫기
    const MongoDatabase = require('./mongoDatabase');
    const db = saveToDb ? new MongoDatabase() : null;
    if (db) await db.connect();

    const outDir = path.resolve(__dirname, '../data');
    fs.mkdirSync(outDir, { recursive: true });

    for (let id = start; id <= end; id++) {
      try {
        const url = buildDetailUrl(id);
        console.log('대상 URL:', url);
        const detail = await scrapeCardDetail(url, id);

        const outPath = path.join(outDir, `card-${id}.json`);
        fs.writeFileSync(outPath, JSON.stringify(detail, null, 2), 'utf-8');
        console.log('JSON 저장 완료:', outPath);

        if (db) {
          const ok = await db.upsertCard(detail);
          console.log(ok ? `✓ DB 저장 성공: ${detail.name}` : `✗ DB 저장 실패: ${detail.name}`);
        }

        await new Promise(r => setTimeout(r, 150));
      } catch (e) {
        console.error(`ID ${id} 처리 중 오류:`, e.message || e);
      }
    }

    if (db) await db.close();
    return;
  }

  // 단건 처리
  const singleInput = first;
  const url = buildDetailUrl(singleInput);
  console.log('대상 URL:', url);

  const detail = await scrapeCardDetail(url, /^\d+$/.test(singleInput) ? Number(singleInput) : undefined);

  // JSON 저장 (항상 저장)
  try {
    const outDir = path.resolve(__dirname, '../data');
    fs.mkdirSync(outDir, { recursive: true });
    const fileName = `card-${detail.card_idx || Date.now()}.json`;
    const outPath = path.join(outDir, fileName);
    fs.writeFileSync(outPath, JSON.stringify(detail, null, 2), 'utf-8');
    console.log('JSON 저장 완료:', outPath);
  } catch (e) {
    console.error('JSON 저장 중 오류:', e);
  }

  if (!saveToDb) {
    console.log(JSON.stringify(detail, null, 2));
    return;
  }

  // DB 저장 경로
  const MongoDatabase = require('./mongoDatabase');
  const db = new MongoDatabase();
  try {
    await db.connect();
    const ok = await db.upsertCard(detail);
    if (ok) {
      console.log('✓ 카드 상세 정보 저장 성공:', detail.name);
    } else {
      console.log('✗ 카드 상세 정보 저장 실패:', detail.name);
    }
  } catch (e) {
    console.error('DB 저장 중 오류:', e);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('스크래핑 중 오류:', err);
    process.exit(1);
  });
}

module.exports = { scrapeCardDetail };



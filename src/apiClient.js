const axios = require('axios');
const config = require('../config');

class CardGorillaAPI {
  constructor() {
    this.baseURL = config.CARD_GORILLA_BASE_URL;
    this.timeout = config.REQUEST_TIMEOUT;
    this.retryAttempts = config.RETRY_ATTEMPTS;
    this.retryDelay = config.RETRY_DELAY;
  }

  // HTTP 요청 재시도 로직
  async retryRequest(requestFn, attempt = 1) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt < this.retryAttempts) {
        console.log(`요청 실패, ${this.retryDelay}ms 후 재시도... (${attempt}/${this.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  // 카드 랭킹 데이터 조회
  async getCardRanking(options = {}) {
    const {
      term = 'weekly',        // daily, weekly, monthly
      card_gb = 'CRD',        // CRD (신용카드), CHK (체크카드)
      limit = 100,            // 조회할 카드 수
      chart = 'top100'        // 차트 타입
    } = options;

    const params = {
      term,
      card_gb,
      limit,
      chart
    };

    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/charts/ranking`, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 특정 카드 상세 정보 조회
  async getCardDetail(cardIdx) {
    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/cards/${cardIdx}`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 카드 목록 조회 (페이징 지원)
  async getCardList(options = {}) {
    const {
      page = 1,
      limit = 20,
      card_gb = 'CRD',
      sort = 'ranking',
      order = 'asc'
    } = options;

    const params = {
      page,
      limit,
      card_gb,
      sort,
      order
    };

    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/cards`, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 카드 검색
  async searchCards(query, options = {}) {
    const {
      page = 1,
      limit = 20,
      card_gb = 'CRD'
    } = options;

    const params = {
      q: query,
      page,
      limit,
      card_gb
    };

    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/cards/search`, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 카드 브랜드 목록 조회
  async getCardBrands() {
    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/brands`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 카드 회사 목록 조회
  async getCardCorps() {
    const requestFn = async () => {
      const response = await axios.get(`${this.baseURL}/corps`, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8'
        }
      });

      return response.data;
    };

    return this.retryRequest(requestFn);
  }

  // 데이터 유효성 검사
  validateCardData(cardData) {
    const requiredFields = ['card_idx', 'name', 'ranking'];
    
    for (const field of requiredFields) {
      if (cardData[field] === undefined || cardData[field] === null) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }

    return true;
  }

  // 데이터 정규화
  normalizeCardData(rawData) {
    try {
      // JSON 문자열 파싱 함수
      const parseJsonField = (field) => {
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch (e) {
            return field; // 파싱 실패시 원본 문자열 반환
          }
        }
        return field || null;
      };

      // 값(any)을 안전하게 문자열 배열로 변환
      const toStringArray = (value) => {
        if (!value) return [];
        if (typeof value === 'string') {
          // JSON 배열 문자열 시도
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) return parsed.map(v => String(v ?? ''));
            // 단일 문자열은 단일 요소 배열로
            return [value];
          } catch {
            return [value];
          }
        }
        if (Array.isArray(value)) return value.map(v => String(v ?? ''));
        // 기타 타입은 문자열화 후 단일 요소 배열로
        return [String(value)];
      };

      const corpObject = (() => {
        const corp = parseJsonField(rawData.corp) || {};
        // 중첩 필드 보정: 문자열/JSON 문자열/배열 모두 허용 → 최종적으로 문자열 배열 유지
        corp.pr_detail_img = toStringArray(corp.pr_detail_img);
        corp.pr_detail_img_chk = toStringArray(corp.pr_detail_img_chk);
        return corp;
      })();

      return {
        card_idx: rawData.card_idx || rawData.idx,
        name: rawData.name || rawData.no_cmt || '',
        brand: parseJsonField(rawData.brand),
        top_benefit: parseJsonField(rawData.top_benefit),
        annual_fee_basic: rawData.annual_fee_basic || '',
        score: rawData.score || 0,
        card_img: rawData.card_img || '',
        event_title: rawData.event_title || '',
        ranking: rawData.ranking || 0,
        compared: rawData.compared || 0,
        is_visible: rawData.is_visible || 0,
        pr_view_mode: rawData.pr_view_mode || 0,
        corp: corpObject
      };
    } catch (error) {
      console.error('데이터 정규화 오류:', error);
      throw error;
    }
  }
}

module.exports = CardGorillaAPI;

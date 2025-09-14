const CardGorillaAPI = require('./apiClient');
const MongoDatabase = require('./mongoDatabase');
const moment = require('moment');

class CardDataCollector {
  constructor() {
    this.api = new CardGorillaAPI();
    this.db = new MongoDatabase();
  }

  // 데이터 수집 시작
  async startCollection(options = {}) {
    console.log('카드 데이터 수집을 시작합니다...');
    
    try {
      // 데이터베이스 연결
      await this.db.connect();

      const collectionLog = {
        collection_date: moment().format('YYYY-MM-DD'),
        term: options.term || 'weekly',
        card_gb: options.card_gb || 'CRD',
        limit_count: options.limit || 100,
        chart_type: options.chart || 'top100',
        total_cards: 0,
        success_count: 0,
        error_count: 0
      };

      // 카드 랭킹 데이터 수집
      console.log('카드 랭킹 데이터를 수집합니다...');
      const rankingData = await this.api.getCardRanking(options);
      
      if (!Array.isArray(rankingData)) {
        throw new Error('API 응답이 배열 형태가 아닙니다.');
      }

      collectionLog.total_cards = rankingData.length;
      console.log(`총 ${rankingData.length}개의 카드 데이터를 수집했습니다.`);

      // 각 카드 데이터 처리
      for (let i = 0; i < rankingData.length; i++) {
        const cardData = rankingData[i];
        
        try {
          console.log(`카드 처리 중... (${i + 1}/${rankingData.length}) - ${cardData.name || '이름없음'}`);
          
          // 데이터 유효성 검사
          this.api.validateCardData(cardData);
          
          // 데이터 정규화
          const normalizedData = this.api.normalizeCardData(cardData);
          
          // 데이터베이스에 저장
          const saved = await this.db.upsertCard(normalizedData);
          
          if (saved) {
            collectionLog.success_count++;
            console.log(`✓ 카드 저장 성공: ${normalizedData.name}`);
          } else {
            collectionLog.error_count++;
            console.log(`✗ 카드 저장 실패: ${normalizedData.name}`);
          }

          // API 부하 방지를 위한 지연
          await this.delay(100);
          
        } catch (error) {
          collectionLog.error_count++;
          console.error(`카드 처리 오류 (${cardData.name || '이름없음'}):`, error.message);
        }
      }

      // 수집 로그 저장
      await this.db.saveCollectionLog(collectionLog);
      
      console.log('\n=== 수집 완료 ===');
      console.log(`총 카드 수: ${collectionLog.total_cards}`);
      console.log(`성공: ${collectionLog.success_count}`);
      console.log(`실패: ${collectionLog.error_count}`);
      console.log(`수집률: ${((collectionLog.success_count / collectionLog.total_cards) * 100).toFixed(2)}%`);

      return collectionLog;

    } catch (error) {
      console.error('데이터 수집 중 오류 발생:', error);
      throw error;
    } finally {
      // 데이터베이스 연결 종료
      this.db.close();
    }
  }

  // 특정 카드 상세 정보 수집
  async collectCardDetail(cardIdx) {
    try {
      console.log(`카드 상세 정보 수집 중... (ID: ${cardIdx})`);
      
      await this.db.connect();
      
      const detailData = await this.api.getCardDetail(cardIdx);
      const normalizedData = this.api.normalizeCardData(detailData);
      
      const saved = await this.db.upsertCard(normalizedData);
      
      if (saved) {
        console.log(`✓ 카드 상세 정보 저장 성공: ${normalizedData.name}`);
      } else {
        console.log(`✗ 카드 상세 정보 저장 실패: ${normalizedData.name}`);
      }
      
      return saved;
      
    } catch (error) {
      console.error(`카드 상세 정보 수집 오류 (ID: ${cardIdx}):`, error);
      return false;
    } finally {
      this.db.close();
    }
  }

  // 카드 목록 페이지별 수집
  async collectCardList(options = {}) {
    console.log('카드 목록 수집을 시작합니다...');
    
    try {
      await this.db.connect();

      let page = options.page || 1;
      let hasMoreData = true;
      let totalCollected = 0;
      let successCount = 0;
      let errorCount = 0;

      while (hasMoreData) {
        console.log(`페이지 ${page} 수집 중...`);
        
        try {
          const cardList = await this.api.getCardList({ ...options, page });
          
          if (!cardList || !Array.isArray(cardList) || cardList.length === 0) {
            hasMoreData = false;
            break;
          }

          for (const cardData of cardList) {
            try {
              this.api.validateCardData(cardData);
              const normalizedData = this.api.normalizeCardData(cardData);
              const saved = await this.db.upsertCard(normalizedData);
              
              if (saved) {
                successCount++;
                console.log(`✓ 저장: ${normalizedData.name}`);
              } else {
                errorCount++;
                console.log(`✗ 저장 실패: ${normalizedData.name}`);
              }
              
              totalCollected++;
              await this.delay(50);
              
            } catch (error) {
              errorCount++;
              console.error(`카드 처리 오류:`, error.message);
            }
          }

          page++;
          
          // API 부하 방지를 위한 지연
          await this.delay(500);
          
        } catch (error) {
          console.error(`페이지 ${page} 수집 오류:`, error.message);
          errorCount++;
          hasMoreData = false;
        }
      }

      console.log('\n=== 카드 목록 수집 완료 ===');
      console.log(`총 수집: ${totalCollected}`);
      console.log(`성공: ${successCount}`);
      console.log(`실패: ${errorCount}`);

      return { totalCollected, successCount, errorCount };

    } catch (error) {
      console.error('카드 목록 수집 중 오류 발생:', error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  // 데이터베이스 통계 조회
  async getCollectionStats() {
    try {
      await this.db.connect();
      
      const stats = await this.db.getStats();
      
      return stats;
      
    } catch (error) {
      console.error('통계 조회 오류:', error);
      return null;
    } finally {
      this.db.close();
    }
  }

  // 지연 함수
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = CardDataCollector;

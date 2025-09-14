const mongoConnection = require('./mongoConnection');
const { Card, CardBrand, CardBenefit, CardCorp, CollectionLog } = require('./models');

class MongoDatabase {
  constructor() {
    this.isConnected = false;
  }

  // 데이터베이스 연결
  async connect() {
    try {
      await mongoConnection.connect();
      this.isConnected = true;
      console.log('MongoDB 데이터베이스 연결 성공');
      return true;
    } catch (error) {
      console.error('MongoDB 데이터베이스 연결 오류:', error);
      throw error;
    }
  }

  // 카드 데이터 삽입 또는 업데이트
  async upsertCard(cardData) {
    try {
      // 기존 카드 확인
      const existingCard = await Card.findOne({ card_idx: cardData.card_idx });

      const document = {
        ...cardData,
        updated_at: new Date()
      };

      if (existingCard) {
        // 업데이트
        await Card.updateOne(
          { card_idx: cardData.card_idx },
          { $set: document }
        );
        console.log(`카드 업데이트 성공: ${cardData.name}`);
      } else {
        // 삽입
        document.created_at = new Date();
        await Card.create(document);
        console.log(`카드 삽입 성공: ${cardData.name}`);
      }

      // 브랜드 정보 저장 (이제 별도 컬렉션에 저장하지 않고 메인 카드 문서에 포함)
      // 브랜드, 혜택, 회사 정보는 이미 파싱된 객체로 cardData에 포함되어 있음

      return true;
    } catch (error) {
      console.error('카드 데이터 저장 오류:', error);
      return false;
    }
  }

  // 고급 쿼리: 브랜드별 카드 조회
  async getCardsByBrand(brandName) {
    try {
      return await Card.find({
        'brand.name': { $regex: brandName, $options: 'i' }
      }).lean();
    } catch (error) {
      console.error('브랜드별 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 혜택별 카드 조회
  async getCardsByBenefit(benefitTitle) {
    try {
      return await Card.find({
        'top_benefit.title': { $regex: benefitTitle, $options: 'i' }
      }).lean();
    } catch (error) {
      console.error('혜택별 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 회사별 카드 조회
  async getCardsByCorp(corpName) {
    try {
      return await Card.find({
        'corp.name': { $regex: corpName, $options: 'i' }
      }).lean();
    } catch (error) {
      console.error('회사별 카드 조회 오류:', error);
      return [];
    }
  }

  // 수집 로그 저장
  async saveCollectionLog(logData) {
    try {
      await CollectionLog.create(logData);
      console.log('수집 로그 저장 성공');
    } catch (error) {
      console.error('수집 로그 저장 오류:', error);
    }
  }

  // 카드 조회
  async getCard(cardIdx) {
    try {
      return await Card.findOne({ card_idx: cardIdx });
    } catch (error) {
      console.error('카드 조회 오류:', error);
      return null;
    }
  }

  // 카드 목록 조회 (페이징)
  async getCards(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { ranking: 1 },
        filter = {}
      } = options;

      const skip = (page - 1) * limit;
      
      const [cards, total] = await Promise.all([
        Card.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Card.countDocuments(filter)
      ]);

      return {
        cards,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('카드 목록 조회 오류:', error);
      return { cards: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  // 통계 조회
  async getStats() {
    try {
      const [cardStats, recentLogs] = await Promise.all([
        Card.aggregate([
          {
            $group: {
              _id: null,
              total_cards: { $sum: 1 },
              avg_score: { $avg: '$score' },
              max_score: { $max: '$score' },
              min_score: { $min: '$score' },
              last_update: { $max: '$updated_at' }
            }
          }
        ]),
        
        CollectionLog.find({})
          .sort({ created_at: -1 })
          .limit(10)
          .lean()
      ]);

      const stats = cardStats[0] || {
        total_cards: 0,
        avg_score: 0,
        max_score: 0,
        min_score: 0,
        last_update: null
      };

      return {
        cards: stats,
        recentCollections: recentLogs
      };
    } catch (error) {
      console.error('통계 조회 오류:', error);
      return null;
    }
  }

  // 검색
  async searchCards(query, options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sort = { score: -1 }
      } = options;

      const skip = (page - 1) * limit;
      
      const searchFilter = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { event_title: { $regex: query, $options: 'i' } }
        ]
      };

      const [cards, total] = await Promise.all([
        Card.find(searchFilter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean(),
        Card.countDocuments(searchFilter)
      ]);

      return {
        cards,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('카드 검색 오류:', error);
      return { cards: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }
  }

  // 데이터베이스 연결 종료
  async close() {
    try {
      await mongoConnection.disconnect();
      this.isConnected = false;
      console.log('MongoDB 데이터베이스 연결 종료');
    } catch (error) {
      console.error('MongoDB 데이터베이스 연결 종료 오류:', error);
    }
  }

  // 컬렉션 초기화 (개발용)
  async clearCollections() {
    try {
      await Promise.all([
        Card.deleteMany({}),
        CollectionLog.deleteMany({})
      ]);
      console.log('모든 컬렉션 초기화 완료');
    } catch (error) {
      console.error('컬렉션 초기화 오류:', error);
    }
  }

  // 고급 쿼리: 점수별 상위 카드 조회
  async getTopCardsByScore(limit = 10) {
    try {
      return await Card.find({})
        .sort({ score: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('상위 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 랭킹 범위별 카드 조회
  async getCardsByRankingRange(startRank, endRank) {
    try {
      return await Card.find({
        ranking: { $gte: startRank, $lte: endRank }
      }).sort({ ranking: 1 }).lean();
    } catch (error) {
      console.error('랭킹 범위 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 혜택이 있는 카드 조회
  async getCardsWithBenefits() {
    try {
      return await Card.find({
        'top_benefit.0': { $exists: true }
      }).lean();
    } catch (error) {
      console.error('혜택 포함 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 특정 태그를 가진 혜택이 있는 카드 조회
  async getCardsByBenefitTag(tag) {
    try {
      return await Card.find({
        'top_benefit.tags': { $in: [tag] }
      }).lean();
    } catch (error) {
      console.error('혜택 태그별 카드 조회 오류:', error);
      return [];
    }
  }

  // 고급 쿼리: 복합 검색 (브랜드 + 혜택)
  async getCardsByBrandAndBenefit(brandName, benefitTitle) {
    try {
      return await Card.find({
        'brand.name': { $regex: brandName, $options: 'i' },
        'top_benefit.title': { $regex: benefitTitle, $options: 'i' }
      }).lean();
    } catch (error) {
      console.error('브랜드+혜택별 카드 조회 오류:', error);
      return [];
    }
  }
}

module.exports = MongoDatabase;

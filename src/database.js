const { MongoClient } = require('mongodb');
const config = require('../config');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.uri = config.MONGODB_URI;
    this.dbName = config.DATABASE_NAME;
  }

  // 데이터베이스 연결
  async connect() {
    try {
      this.client = new MongoClient(this.uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(this.dbName);
      
      console.log('MongoDB 연결 성공');
      
      // 인덱스 생성
      await this.createIndexes();
      
      return true;
    } catch (error) {
      console.error('MongoDB 연결 오류:', error.message);
      throw error;
    }
  }

  // 인덱스 생성
  async createIndexes() {
    try {
      const collections = [
        {
          name: 'cards',
          indexes: [
            { key: { card_idx: 1 }, options: { unique: true } },
            { key: { ranking: 1 } },
            { key: { score: -1 } },
            { key: { created_at: -1 } },
            { key: { updated_at: -1 } }
          ]
        },
        {
          name: 'collection_logs',
          indexes: [
            { key: { collection_date: 1 } },
            { key: { created_at: -1 } }
          ]
        }
      ];

      for (const collection of collections) {
        for (const index of collection.indexes) {
          await this.db.collection(collection.name).createIndex(index.key, index.options);
        }
      }
      
      console.log('MongoDB 인덱스 생성 완료');
    } catch (error) {
      console.error('인덱스 생성 오류:', error);
    }
  }

  // 카드 데이터 삽입 또는 업데이트
  async upsertCard(cardData) {
    try {
      const collection = this.db.collection('cards');
      
      // 기존 카드 확인
      const existingCard = await collection.findOne({ card_idx: cardData.card_idx });

      const document = {
        ...cardData,
        updated_at: new Date()
      };

      if (existingCard) {
        // 업데이트
        const result = await collection.updateOne(
          { card_idx: cardData.card_idx },
          { $set: document }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`카드 업데이트 성공: ${cardData.name}`);
        }
      } else {
        // 삽입
        document.created_at = new Date();
        await collection.insertOne(document);
        console.log(`카드 삽입 성공: ${cardData.name}`);
      }

      // 브랜드 정보 저장
      if (cardData.brand) {
        await this.saveCardBrands(cardData.card_idx, JSON.parse(cardData.brand));
      }

      // 혜택 정보 저장
      if (cardData.top_benefit) {
        await this.saveCardBenefits(cardData.card_idx, JSON.parse(cardData.top_benefit));
      }

      // 회사 정보 저장
      if (cardData.corp) {
        await this.saveCardCorp(cardData.card_idx, JSON.parse(cardData.corp));
      }

      return true;
    } catch (error) {
      console.error('카드 데이터 저장 오류:', error);
      return false;
    }
  }

  // 브랜드 정보 저장
  async saveCardBrands(cardIdx, brands) {
    try {
      const collection = this.db.collection('card_brands');
      
      // 기존 브랜드 정보 삭제
      await collection.deleteMany({ card_idx: cardIdx });

      // 새 브랜드 정보 저장
      if (Array.isArray(brands) && brands.length > 0) {
        const brandDocs = brands.map(brand => ({
          card_idx: cardIdx,
          brand_no: brand.no,
          brand_idx: brand.idx,
          brand_code: brand.code,
          brand_name: brand.name,
          brand_logo_url: brand.logo_img?.url,
          is_visible: brand.is_visible,
          created_at: new Date()
        }));

        await collection.insertMany(brandDocs);
      }
    } catch (error) {
      console.error('브랜드 정보 저장 오류:', error);
    }
  }

  // 혜택 정보 저장
  async saveCardBenefits(cardIdx, benefits) {
    try {
      const collection = this.db.collection('card_benefits');
      
      // 기존 혜택 정보 삭제
      await collection.deleteMany({ card_idx: cardIdx });

      // 새 혜택 정보 저장
      if (Array.isArray(benefits) && benefits.length > 0) {
        const benefitDocs = benefits.map(benefit => ({
          card_idx: cardIdx,
          benefit_idx: benefit.idx,
          benefit_title: benefit.title,
          benefit_tags: benefit.tags,
          benefit_logo_url: benefit.logo_img?.url,
          created_at: new Date()
        }));

        await collection.insertMany(benefitDocs);
      }
    } catch (error) {
      console.error('혜택 정보 저장 오류:', error);
    }
  }

  // 회사 정보 저장
  async saveCardCorp(cardIdx, corp) {
    try {
      const collection = this.db.collection('card_corps');
      
      // 기존 회사 정보 삭제
      await collection.deleteMany({ card_idx: cardIdx });

      // 새 회사 정보 저장
      if (corp && corp.idx) {
        const corpDoc = {
          card_idx: cardIdx,
          corp_idx: corp.idx,
          corp_name: corp.name,
          corp_name_eng: corp.name_eng,
          corp_logo_url: corp.logo_img?.url,
          corp_color: corp.color,
          is_event: corp.is_event,
          pr_detail: corp.pr_detail,
          created_at: new Date()
        };

        await collection.insertOne(corpDoc);
      }
    } catch (error) {
      console.error('회사 정보 저장 오류:', error);
    }
  }

  // 수집 로그 저장
  async saveCollectionLog(logData) {
    try {
      const collection = this.db.collection('collection_logs');
      
      const logDoc = {
        ...logData,
        created_at: new Date()
      };

      await collection.insertOne(logDoc);
      console.log('수집 로그 저장 성공');
    } catch (error) {
      console.error('수집 로그 저장 오류:', error);
    }
  }

  // 카드 조회
  async getCard(cardIdx) {
    try {
      const collection = this.db.collection('cards');
      return await collection.findOne({ card_idx: cardIdx });
    } catch (error) {
      console.error('카드 조회 오류:', error);
      return null;
    }
  }

  // 카드 목록 조회 (페이징)
  async getCards(options = {}) {
    try {
      const collection = this.db.collection('cards');
      
      const {
        page = 1,
        limit = 20,
        sort = { ranking: 1 },
        filter = {}
      } = options;

      const skip = (page - 1) * limit;
      
      const cursor = collection
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const cards = await cursor.toArray();
      const total = await collection.countDocuments(filter);

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
      const cardsCollection = this.db.collection('cards');
      const logsCollection = this.db.collection('collection_logs');

      const [cardStats, recentLogs] = await Promise.all([
        cardsCollection.aggregate([
          {
            $group: {
              _id: null,
              total_cards: { $sum: 1 },
              avg_score: { $avg: '$score' },
              max_score: { $max: '$score' },
              min_score: { $min: '$score' }
            }
          }
        ]).toArray(),
        
        logsCollection
          .find({})
          .sort({ created_at: -1 })
          .limit(10)
          .toArray()
      ]);

      const stats = cardStats[0] || {
        total_cards: 0,
        avg_score: 0,
        max_score: 0,
        min_score: 0
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
      const collection = this.db.collection('cards');
      
      const {
        page = 1,
        limit = 20,
        sort = { score: -1 }
      } = options;

      const skip = (page - 1) * limit;
      
      // 텍스트 검색을 위한 인덱스 (필요시 생성)
      const searchFilter = {
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { event_title: { $regex: query, $options: 'i' } }
        ]
      };

      const cursor = collection
        .find(searchFilter)
        .sort(sort)
        .skip(skip)
        .limit(limit);

      const cards = await cursor.toArray();
      const total = await collection.countDocuments(searchFilter);

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
      if (this.client) {
        await this.client.close();
        console.log('MongoDB 연결 종료');
      }
    } catch (error) {
      console.error('MongoDB 연결 종료 오류:', error);
    }
  }

  // 컬렉션 초기화 (개발용)
  async clearCollections() {
    try {
      const collections = ['cards', 'card_brands', 'card_benefits', 'card_corps', 'collection_logs'];
      
      for (const collectionName of collections) {
        await this.db.collection(collectionName).deleteMany({});
        console.log(`${collectionName} 컬렉션 초기화 완료`);
      }
    } catch (error) {
      console.error('컬렉션 초기화 오류:', error);
    }
  }
}

module.exports = Database;
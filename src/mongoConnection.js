const mongoose = require('mongoose');
const config = require('../config');

class MongoConnection {
  constructor() {
    this.isConnected = false;
  }

  // MongoDB 연결
  async connect() {
    try {
      if (this.isConnected) {
        console.log('MongoDB가 이미 연결되어 있습니다.');
        return;
      }

      await mongoose.connect(config.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      this.isConnected = true;
      console.log('MongoDB 연결 성공');

      // 연결 이벤트 리스너
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB 연결 오류:', err);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB 연결이 끊어졌습니다.');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB 재연결 성공');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('MongoDB 연결 실패:', error);
      this.isConnected = false;
      throw error;
    }
  }

  // MongoDB 연결 종료
  async disconnect() {
    try {
      if (this.isConnected) {
        await mongoose.connection.close();
        this.isConnected = false;
        console.log('MongoDB 연결 종료');
      }
    } catch (error) {
      console.error('MongoDB 연결 종료 오류:', error);
    }
  }

  // 연결 상태 확인
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name
    };
  }

  // 연결 상태 모니터링
  startHealthCheck() {
    setInterval(() => {
      const status = this.getConnectionStatus();
      console.log(`MongoDB 상태: ${status.isConnected ? '연결됨' : '연결 안됨'} (${status.readyState})`);
    }, 30000); // 30초마다 체크
  }
}

// 싱글톤 인스턴스
const mongoConnection = new MongoConnection();

module.exports = mongoConnection;

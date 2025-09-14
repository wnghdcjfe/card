// 환경 설정
module.exports = {
  // 카드 고릴라 API 설정
  CARD_GORILLA_BASE_URL: 'https://api.card-gorilla.com:8080/v1',
  
  // MongoDB 설정
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/card-gorilla',
  DATABASE_NAME: 'card-gorilla',
  
  // 스케줄링 설정 (매일 오전 9시)
  SCHEDULE_TIME: '0 9 * * *',
  
  // API 요청 설정
  REQUEST_TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000
};

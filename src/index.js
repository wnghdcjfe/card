const CardDataCollector = require('./collector');
const mongoConnection = require('./mongoConnection');
const config = require('../config');

async function main() {
  console.log('=== 카드 고릴라 데이터 수집기 시작 ===');
  
  const collector = new CardDataCollector();
  
  try {
    // 기본 수집 옵션
    const collectionOptions = {
      term: 'weekly',      // 주간 랭킹
      card_gb: 'CRD',      // 신용카드
      limit: 100,          // 상위 100개
      chart: 'top100'      // top100 차트
    };

    console.log('수집 옵션:', collectionOptions);
    
    // 데이터 수집 실행
    const result = await collector.startCollection(collectionOptions);
    
    console.log('\n=== 수집 결과 ===');
    console.log(`수집 일시: ${result.collection_date}`);
    console.log(`총 카드 수: ${result.total_cards}`);
    console.log(`성공: ${result.success_count}`);
    console.log(`실패: ${result.error_count}`);
    
    // 통계 조회
    console.log('\n=== 데이터베이스 통계 ===');
    const stats = await collector.getCollectionStats();
    
    if (stats) {
      console.log(`총 카드 수: ${stats.cards.total_cards}`);
      console.log(`수집 일수: ${stats.cards.collection_days}`);
      console.log(`마지막 업데이트: ${stats.cards.last_update}`);
      
      if (stats.recentCollections.length > 0) {
        console.log('\n최근 수집 기록:');
        stats.recentCollections.forEach((log, index) => {
          console.log(`${index + 1}. ${log.collection_date} - ${log.success_count}/${log.total_cards} 성공`);
        });
      }
    }
    
  } catch (error) {
    console.error('메인 실행 중 오류 발생:', error);
    process.exit(1);
  } finally {
    // MongoDB 연결 종료
    await mongoConnection.disconnect();
  }
}

// 스크립트가 직접 실행될 때만 main 함수 호출
if (require.main === module) {
  main().then(() => {
    console.log('\n프로그램이 정상적으로 종료되었습니다.');
    process.exit(0);
  }).catch((error) => {
    console.error('프로그램 실행 중 오류:', error);
    process.exit(1);
  });
}

module.exports = main;

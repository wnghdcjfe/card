const cron = require('node-cron');
const CardDataCollector = require('./collector');
const mongoConnection = require('./mongoConnection');
const config = require('../config');

class CardDataScheduler {
  constructor() {
    this.collector = new CardDataCollector();
    this.jobs = new Map();
  }

  // 스케줄러 시작
  start() {
    console.log('=== 카드 데이터 스케줄러 시작 ===');
    console.log(`스케줄 설정: ${config.SCHEDULE_TIME}`);
    
    // 기본 수집 작업 스케줄링
    this.scheduleCollection('daily', config.SCHEDULE_TIME, {
      term: 'daily',
      card_gb: 'CRD',
      limit: 100,
      chart: 'top100'
    });

    // 주간 수집 작업 (매주 월요일 오전 10시)
    this.scheduleCollection('weekly', '0 10 * * 1', {
      term: 'weekly',
      card_gb: 'CRD',
      limit: 200,
      chart: 'top100'
    });

    // 월간 수집 작업 (매월 1일 오전 11시)
    this.scheduleCollection('monthly', '0 11 1 * *', {
      term: 'monthly',
      card_gb: 'CRD',
      limit: 500,
      chart: 'top100'
    });

    console.log('모든 스케줄 작업이 등록되었습니다.');
    this.printScheduleInfo();
  }

  // 수집 작업 스케줄링
  scheduleCollection(name, cronExpression, options) {
    if (this.jobs.has(name)) {
      console.log(`작업 '${name}'이 이미 존재합니다. 기존 작업을 중지합니다.`);
      this.jobs.get(name).destroy();
    }

    const job = cron.schedule(cronExpression, async () => {
      console.log(`\n=== ${name.toUpperCase()} 수집 작업 시작 ===`);
      console.log(`시작 시간: ${new Date().toLocaleString('ko-KR')}`);
      
      try {
        const result = await this.collector.startCollection(options);
        
        console.log(`\n=== ${name.toUpperCase()} 수집 작업 완료 ===`);
        console.log(`완료 시간: ${new Date().toLocaleString('ko-KR')}`);
        console.log(`수집 결과: ${result.success_count}/${result.total_cards} 성공`);
        
        // 이메일 알림이나 로그 저장 등의 후속 처리
        await this.postCollectionProcess(name, result);
        
      } catch (error) {
        console.error(`\n=== ${name.toUpperCase()} 수집 작업 실패 ===`);
        console.error(`오류 시간: ${new Date().toLocaleString('ko-KR')}`);
        console.error('오류 내용:', error.message);
        
        // 오류 알림 처리
        await this.handleCollectionError(name, error);
      }
    }, {
      scheduled: false,
      timezone: "Asia/Seoul"
    });

    this.jobs.set(name, job);
    job.start();
    
    console.log(`✓ '${name}' 작업이 스케줄에 등록되었습니다. (${cronExpression})`);
  }

  // 수집 후 처리
  async postCollectionProcess(name, result) {
    try {
      // 데이터베이스 통계 업데이트
      const stats = await this.collector.getCollectionStats();
      
      console.log(`데이터베이스 통계 업데이트 완료:`);
      console.log(`- 총 카드 수: ${stats.cards.total_cards}`);
      console.log(`- 마지막 업데이트: ${stats.cards.last_update}`);
      
      // 여기에 추가적인 후속 처리 로직을 추가할 수 있습니다:
      // - 이메일 알림
      // - 슬랙 알림
      // - 백업 생성
      // - 데이터 검증
      
    } catch (error) {
      console.error('후속 처리 중 오류:', error);
    }
  }

  // 수집 오류 처리
  async handleCollectionError(name, error) {
    try {
      console.error(`수집 오류 처리 중...`);
      
      // 오류 로그 저장
      const errorLog = {
        job_name: name,
        error_message: error.message,
        error_stack: error.stack,
        timestamp: new Date().toISOString()
      };
      
      // 여기에 오류 알림 로직을 추가할 수 있습니다:
      // - 이메일 알림
      // - 슬랙 알림
      // - 오류 로그 파일 저장
      
      console.error('오류 로그:', errorLog);
      
    } catch (logError) {
      console.error('오류 로그 저장 중 문제 발생:', logError);
    }
  }

  // 스케줄 정보 출력
  printScheduleInfo() {
    console.log('\n=== 등록된 스케줄 작업 ===');
    this.jobs.forEach((job, name) => {
      console.log(`- ${name}: ${job.options.cronTime || '실행 중'}`);
    });
    console.log('========================\n');
  }

  // 특정 작업 중지
  stopJob(name) {
    if (this.jobs.has(name)) {
      this.jobs.get(name).destroy();
      this.jobs.delete(name);
      console.log(`'${name}' 작업이 중지되었습니다.`);
    } else {
      console.log(`'${name}' 작업을 찾을 수 없습니다.`);
    }
  }

  // 모든 작업 중지
  stopAll() {
    console.log('모든 스케줄 작업을 중지합니다...');
    this.jobs.forEach((job, name) => {
      job.destroy();
      console.log(`- '${name}' 작업 중지`);
    });
    this.jobs.clear();
    console.log('모든 작업이 중지되었습니다.');
  }

  // 수동 수집 실행
  async runManualCollection(name, options) {
    console.log(`\n=== 수동 ${name.toUpperCase()} 수집 실행 ===`);
    
    try {
      const result = await this.collector.startCollection(options);
      
      console.log(`\n=== 수동 수집 완료 ===`);
      console.log(`수집 결과: ${result.success_count}/${result.total_cards} 성공`);
      
      return result;
      
    } catch (error) {
      console.error(`수동 수집 실패:`, error);
      throw error;
    }
  }

  // 상태 조회
  getStatus() {
    return {
      runningJobs: Array.from(this.jobs.keys()),
      totalJobs: this.jobs.size,
      uptime: process.uptime()
    };
  }
}

// 스크립트가 직접 실행될 때만 스케줄러 시작
if (require.main === module) {
  const scheduler = new CardDataScheduler();
  
  // 스케줄러 시작
  scheduler.start();
  
  // 프로세스 종료 시 정리
  process.on('SIGINT', async () => {
    console.log('\n프로그램 종료 신호를 받았습니다...');
    scheduler.stopAll();
    await mongoConnection.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n프로그램 종료 신호를 받았습니다...');
    scheduler.stopAll();
    await mongoConnection.disconnect();
    process.exit(0);
  });

  // 상태 조회 (5분마다)
  setInterval(() => {
    const status = scheduler.getStatus();
    console.log(`\n[${new Date().toLocaleString('ko-KR')}] 스케줄러 상태:`, status);
  }, 5 * 60 * 1000);
}

module.exports = CardDataScheduler;

# 카드 고릴라 데이터베이스 구축 프로젝트

카드 고릴라 API를 활용하여 카드 정보를 자동으로 수집하고 MongoDB 데이터베이스를 구축하는 Node.js 프로젝트입니다.

## 주요 기능

- 📊 카드 랭킹 데이터 자동 수집
- 🗄️ MongoDB 데이터베이스 저장
- ⏰ 스케줄링을 통한 자동 수집
- 🔄 데이터 중복 방지 및 업데이트
- 📈 수집 통계 및 로그 관리
- 🔍 고급 검색 및 집계 기능

## 프로젝트 구조

```
card/
├── src/
│   ├── index.js              # 메인 실행 파일
│   ├── apiClient.js          # 카드 고릴라 API 클라이언트
│   ├── mongoDatabase.js      # MongoDB 데이터베이스 관리
│   ├── mongoConnection.js    # MongoDB 연결 관리
│   ├── models.js             # Mongoose 스키마 모델
│   ├── collector.js          # 데이터 수집 로직
│   └── scheduler.js          # 스케줄링 관리
├── config.js                # 설정 파일
├── package.json             # 프로젝트 설정
└── README.md               # 프로젝트 문서
```

## 설치 및 실행

### 1. MongoDB 설치 및 실행

MongoDB를 설치하고 실행해주세요.

```bash
# Windows (Chocolatey 사용)
choco install mongodb

# macOS (Homebrew 사용)
brew install mongodb/brew/mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb

# MongoDB 서비스 시작
sudo systemctl start mongod
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 단일 실행 (데이터 수집)

```bash
npm start
```

### 4. 개발 모드 실행 (파일 변경 감지)

```bash
npm run dev
```

### 5. 스케줄러 실행 (자동 수집)

```bash
npm run schedule
```

## MongoDB 컬렉션 구조

### cards (카드 정보)
- `card_idx`: 카드 고유 ID (Number, Unique Index)
- `name`: 카드명 (String, Index)
- `brand`: 브랜드 정보 (String - JSON 형태)
- `top_benefit`: 주요 혜택 (String - JSON 형태)
- `annual_fee_basic`: 연회비 정보 (String)
- `score`: 카드 점수 (Number, Index)
- `ranking`: 랭킹 (Number, Index)
- `corp`: 카드사 정보 (String - JSON 형태)
- `created_at`: 생성일시 (Date, Index)
- `updated_at`: 수정일시 (Date, Index)

### cardbrands (카드 브랜드)
- `card_idx`: 카드 ID (Number, Index)
- `brand_no`: 브랜드 번호 (Number)
- `brand_idx`: 브랜드 인덱스 (Number)
- `brand_code`: 브랜드 코드 (String)
- `brand_name`: 브랜드명 (String, Index)
- `brand_logo_url`: 브랜드 로고 URL (String)
- `is_visible`: 표시 여부 (Number)
- `created_at`: 생성일시 (Date)

### cardbenefits (카드 혜택)
- `card_idx`: 카드 ID (Number, Index)
- `benefit_idx`: 혜택 인덱스 (Number)
- `benefit_title`: 혜택명 (String, Index)
- `benefit_tags`: 혜택 태그 (Array)
- `benefit_logo_url`: 혜택 로고 URL (String)
- `created_at`: 생성일시 (Date)

### cardcorps (카드사 정보)
- `card_idx`: 카드 ID (Number, Index)
- `corp_idx`: 카드사 인덱스 (Number)
- `corp_name`: 카드사명 (String, Index)
- `corp_name_eng`: 카드사 영문명 (String)
- `corp_logo_url`: 카드사 로고 URL (String)
- `corp_color`: 카드사 색상 (String)
- `is_event`: 이벤트 여부 (Number)
- `pr_detail`: 상세 설명 (String)
- `created_at`: 생성일시 (Date)

### collectionlogs (수집 로그)
- `collection_date`: 수집 일자 (Date, Index)
- `term`: 수집 주기 (String)
- `card_gb`: 카드 구분 (String)
- `limit_count`: 수집 제한 수 (Number)
- `chart_type`: 차트 타입 (String)
- `total_cards`: 총 카드 수 (Number)
- `success_count`: 성공 수 (Number)
- `error_count`: 실패 수 (Number)
- `created_at`: 생성일시 (Date, Index)

## 설정

`config.js` 파일에서 다음 설정을 변경할 수 있습니다:

```javascript
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
```

## 사용 예시

### 기본 수집 실행

```javascript
const CardDataCollector = require('./src/collector');
const mongoConnection = require('./src/mongoConnection');

async function runCollection() {
  try {
    // MongoDB 연결
    await mongoConnection.connect();
    
    const collector = new CardDataCollector();

    // 주간 랭킹 상위 100개 수집
    const result = await collector.startCollection({
      term: 'weekly',
      card_gb: 'CRD',
      limit: 100,
      chart: 'top100'
    });
    
    console.log('수집 완료:', result);
  } finally {
    await mongoConnection.disconnect();
  }
}

runCollection();
```

### 특정 카드 상세 정보 수집

```javascript
// 특정 카드의 상세 정보 수집
await collector.collectCardDetail(51);
```

### 스케줄러 설정

```javascript
const CardDataScheduler = require('./src/scheduler');

const scheduler = new CardDataScheduler();

// 매일 오전 9시에 수집
scheduler.scheduleCollection('daily', '0 9 * * *', {
  term: 'daily',
  card_gb: 'CRD',
  limit: 100
});

scheduler.start();
```

## API 엔드포인트

카드 고릴라 API에서 사용하는 주요 엔드포인트:

- `GET /v1/charts/ranking` - 카드 랭킹 조회
- `GET /v1/cards/{cardIdx}` - 특정 카드 상세 정보
- `GET /v1/cards` - 카드 목록 조회
- `GET /v1/cards/search` - 카드 검색

## 로그 및 모니터링

프로그램 실행 시 다음과 같은 로그를 확인할 수 있습니다:

- 데이터 수집 진행 상황
- 성공/실패 카드 수
- API 요청 재시도 정보
- 데이터베이스 저장 결과

## 주의사항

1. **API 사용량 제한**: 과도한 요청을 방지하기 위해 요청 간 지연이 설정되어 있습니다.
2. **데이터 정합성**: 동일한 카드는 업데이트 방식으로 처리됩니다.
3. **오류 처리**: API 오류 시 자동 재시도 로직이 포함되어 있습니다.

## 라이선스

MIT License

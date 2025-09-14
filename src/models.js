const { Schema, model } = require('mongoose');

// 브랜드 서브 스키마
const brandSchema = new Schema({
  no: { type: Number },
  idx: { type: Number },
  code: { type: String },
  name: { type: String },
  reg_dt: { type: String },
  checked: { type: Boolean },
  logo_img: {
    url: { type: String },
    name: { type: String }
  },
  is_visible: { type: Boolean }
}, { _id: false });

// 혜택 서브 스키마
const benefitSchema = new Schema({
  idx: { type: Number },
  tags: [{ type: String }],
  title: { type: String },
  logo_img: {
    url: { type: String },
    name: { type: String }
  },
  inputValue: { type: String }
}, { _id: false });

// 회사 서브 스키마
const corpSchema = new Schema({
  idx: { type: Number },
  name: { type: String },
  tips: [{
    title: { type: String },
    contents: { type: String }
  }],
  color: { type: String },
  is_event: { type: Boolean },
  logo_img: {
    url: { type: String },
    name: { type: String }
  },
  name_eng: { type: String },
  pr_detail: { type: String },
  is_visible: { type: Boolean },
  pr_container: { type: String },
  pr_detail_chk: { type: String },
  pr_detail_img: [{ type: String }],
  pr_container_chk: { type: String },
  pr_detail_img_chk: [{ type: String }]
}, { _id: false });

// 카드 스키마
const cardSchema = new Schema({
  card_idx: { type: Number, required: true, unique: true, index: true },
  name: { type: String, required: true, index: true },
  brand: [brandSchema], // 실제 객체 배열로 저장
  top_benefit: [benefitSchema], // 실제 객체 배열로 저장
  annual_fee_basic: { type: String },
  score: { type: Number, index: true },
  card_img: { type: String },
  event_title: { type: String },
  ranking: { type: Number, index: true },
  compared: { type: Number },
  is_visible: { type: Number },
  pr_view_mode: { type: Number },
  corp: corpSchema, // 실제 객체로 저장
  created_at: { type: Date, default: Date.now, index: true },
  updated_at: { type: Date, default: Date.now, index: true }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// 카드 브랜드 스키마
const cardBrandSchema = new Schema({
  card_idx: { type: Number, required: true, index: true },
  brand_no: { type: Number },
  brand_idx: { type: Number },
  brand_code: { type: String },
  brand_name: { type: String, index: true },
  brand_logo_url: { type: String },
  is_visible: { type: Number },
  created_at: { type: Date, default: Date.now }
});

// 카드 혜택 스키마
const cardBenefitSchema = new Schema({
  card_idx: { type: Number, required: true, index: true },
  benefit_idx: { type: Number },
  benefit_title: { type: String, index: true },
  benefit_tags: [{ type: String }],
  benefit_logo_url: { type: String },
  created_at: { type: Date, default: Date.now }
});

// 카드사 스키마
const cardCorpSchema = new Schema({
  card_idx: { type: Number, required: true, index: true },
  corp_idx: { type: Number },
  corp_name: { type: String, index: true },
  corp_name_eng: { type: String },
  corp_logo_url: { type: String },
  corp_color: { type: String },
  is_event: { type: Number },
  pr_detail: { type: String },
  created_at: { type: Date, default: Date.now }
});

// 수집 로그 스키마
const collectionLogSchema = new Schema({
  collection_date: { type: Date, required: true, index: true },
  term: { type: String, required: true },
  card_gb: { type: String, required: true },
  limit_count: { type: Number },
  chart_type: { type: String },
  total_cards: { type: Number },
  success_count: { type: Number },
  error_count: { type: Number },
  created_at: { type: Date, default: Date.now, index: true }
});

// 모델 생성
const Card = model('Card', cardSchema);
const CardBrand = model('CardBrand', cardBrandSchema);
const CardBenefit = model('CardBenefit', cardBenefitSchema);
const CardCorp = model('CardCorp', cardCorpSchema);
const CollectionLog = model('CollectionLog', collectionLogSchema);

module.exports = {
  Card,
  CardBrand,
  CardBenefit,
  CardCorp,
  CollectionLog
};

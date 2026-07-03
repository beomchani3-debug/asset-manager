/**
 * @typedef {'농협증권'|'메리츠증권'} Broker
 * @typedef {'매수'|'매도'|'배당'} TxSide
 * @typedef {'미국'|'국내'|'일본'|'코인'} Market
 * @typedef {'KRW'|'USD'|'JPY'} Currency
 * @typedef {'수입'|'고정비'|'변동지출'} CashFlowType
 */

/**
 * @typedef {Object} Transaction
 * @property {string}   id
 * @property {string}   date        YYYY-MM-DD
 * @property {Broker}   broker
 * @property {TxSide}   side
 * @property {string}   assetName
 * @property {string}   ticker
 * @property {Market}   market
 * @property {string}   sector
 * @property {Currency} currency
 * @property {number}   price       거래 단가 (원통화 기준)
 * @property {number}   quantity    수량
 * @property {number}   fxRate      원/외화 환율 (KRW 종목이면 1)
 * @property {number}   krwAmount   원화 환산 금액 = price × quantity × fxRate
 * @property {string}   [memo]
 */

/**
 * @typedef {Object} Holding
 * @property {string}      ticker
 * @property {string}      assetName
 * @property {Market}      market
 * @property {string}      sector
 * @property {Broker}      broker
 * @property {Currency}    currency
 * @property {number}      quantity      보유 수량 (매수 - 매도)
 * @property {number}      avgPrice      원통화 기준 평균단가
 * @property {number}      avgFxRate     가중평균 환율
 * @property {number}      principal     원화 환산 매입원금
 * @property {number|null} currentPrice  현재가 (수동 or API)
 * @property {number|null} marketValue   평가금액
 * @property {number|null} unrealizedPnl 평가손익
 */

/**
 * @typedef {Object} CashFlow
 * @property {string}       id
 * @property {string}       date         YYYY-MM-DD
 * @property {CashFlowType} type
 * @property {string}       category
 * @property {number}       amount       원화
 * @property {string}       [memo]
 * @property {string}       [recurringId] 반복 고정비 템플릿 id (자동/연결 생성된 내역에만 존재)
 */

/**
 * @typedef {Object} FixedExpense
 * @property {string}  id
 * @property {string}  name
 * @property {number}  amount
 * @property {number}  day        매달 반복일 (1~31, 31은 말일로 처리)
 * @property {boolean} isActive
 * @property {string}  createdAt
 */

/**
 * @typedef {Object} Settings
 * @property {number}                   dividendGoalKrw   연간 배당 목표 (원화)
 * @property {{ USD: number, JPY: number }} fxRates       수동 환율
 * @property {{ [ticker: string]: number }} manualPrices  수동 현재가
 */

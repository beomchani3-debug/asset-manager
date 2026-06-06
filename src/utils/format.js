// ─── 숫자 포맷 유틸리티 ──────────────────────────────────────────────────────

/** 1234567 → "1,234,567원" */
export const formatKRW = (n) =>
  `${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`

/** 1234.56 → "+1,234원" / "-1,234원" */
export const formatKRWSigned = (n) => {
  const sign = n >= 0 ? '+' : '−'
  return `${sign}${Math.round(Math.abs(n)).toLocaleString('ko-KR')}원`
}

/** 1234567 → "123.5만원" / "1.2억원" */
export const formatKRWCompact = (n) => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}억원`
  if (abs >= 10_000)      return `${sign}${(abs / 10_000).toFixed(0)}만원`
  return `${sign}${Math.round(abs).toLocaleString('ko-KR')}원`
}

/** 1234.56 → "$1,234.56" */
export const formatUSD = (n) =>
  `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** 1234 → "¥1,234" */
export const formatJPY = (n) =>
  `¥${Math.round(Math.abs(n)).toLocaleString('ja-JP')}`

/** 12.34 → "+12.34%", -5.6 → "-5.60%" */
export const formatPercent = (rate, decimals = 2) => {
  const sign = rate >= 0 ? '+' : '−'
  return `${sign}${Math.abs(rate).toFixed(decimals)}%`
}

/** "2026-06-05" → "2026.06.05" */
export const formatDate = (dateStr) =>
  dateStr ? dateStr.replace(/-/g, '.') : ''

/** "2026-06-05" → "06.05" */
export const formatMD = (dateStr) =>
  dateStr ? dateStr.slice(5).replace('-', '.') : ''

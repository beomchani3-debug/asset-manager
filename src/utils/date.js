/** 해당 연/월의 마지막 날짜 (month: 1~12) */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

/**
 * 반복일(day)을 특정 연/월에 맞춰 실제 날짜(YYYY-MM-DD)로 변환한다.
 * day가 그 달의 마지막 날보다 크면(예: 31일) 말일로 처리한다.
 */
export function resolveRecurringDate(year, month, day) {
  const clamped = Math.min(day, daysInMonth(year, month))
  return `${year}-${String(month).padStart(2, '0')}-${String(clamped).padStart(2, '0')}`
}

export function currentYearMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM'을 delta개월만큼 이동시킨 'YYYY-MM'을 반환한다 */
export function shiftYearMonth(yearMonth, delta) {
  const [y, m] = yearMonth.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** start부터 end까지(포함) 'YYYY-MM' 목록을 반환한다 */
export function monthsBetween(startYearMonth, endYearMonth) {
  const months = []
  let cur = startYearMonth
  let guard = 0
  while (cur <= endYearMonth && guard < 1200) {
    months.push(cur)
    cur = shiftYearMonth(cur, 1)
    guard++
  }
  return months
}

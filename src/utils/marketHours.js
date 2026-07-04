const MARKET_TZ = {
  '국내': 'Asia/Seoul',
  '일본': 'Asia/Tokyo',
}

function localParts(tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  return { weekday: map.weekday, minutes: Number(map.hour) * 60 + Number(map.minute) }
}

/**
 * 시장별 정규장 개장 여부 근사치 판단 (공휴일 미반영).
 * '국내'·'일본'은 해당 거래소 시간대, 그 외(미국 등)는 뉴욕 시간(NYSE/NASDAQ) 기준.
 */
export function isMarketOpen(market) {
  const tz = MARKET_TZ[market] ?? 'America/New_York'
  const { weekday, minutes } = localParts(tz)
  if (weekday === 'Sat' || weekday === 'Sun') return false
  if (tz === 'Asia/Seoul') return minutes >= 9 * 60 && minutes <= 15 * 60 + 30
  if (tz === 'Asia/Tokyo') return minutes >= 9 * 60 && minutes <= 15 * 60
  return minutes >= 9 * 60 + 30 && minutes <= 16 * 60
}

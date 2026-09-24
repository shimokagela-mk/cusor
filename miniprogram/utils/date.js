function parseDate(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

function weekdayMonFirst(day) {
  return day === 0 ? 7 : day
}

function sortWeekdays(days) {
  return [...days].sort((a, b) => weekdayMonFirst(a) - weekdayMonFirst(b))
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function weekdayLabel(day) {
  return WEEKDAY_LABELS[day] || ''
}

function startOfWeek(date) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDays(date, diff)
}

module.exports = {
  parseDate,
  formatDate,
  addDays,
  sortWeekdays,
  weekdayLabel,
  startOfWeek,
  WEEKDAY_LABELS
}

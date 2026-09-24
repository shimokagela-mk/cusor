const { weekdayLabel } = require('../utils/date')
const { MEAL_KEYS, MEAL_LABELS, emptyLog, evaluateDay, hydrateWorkout } = require('./logs')

function percent(actual, target) {
  if (!target) return 0
  return Math.min(100, Math.round((actual / target) * 100))
}

function presentDay({ plan, date, log, today }) {
  const day = plan.days.find((item) => item.date === date) || null
  const current = log || emptyLog(date)
  const check = evaluateDay(day, current)
  const workout = hydrateWorkout(day, current)
  let statusLabel = '未到'
  let statusKind = 'future'
  if (day && date < today) {
    statusLabel = check.complete ? '已打卡' : '未完成'
    statusKind = check.complete ? 'done' : 'missed'
  } else if (day && date === today) {
    statusLabel = check.complete ? '已打卡' : '进行中'
    statusKind = check.complete ? 'done' : 'today'
  } else if (!day) {
    statusLabel = '不在周期内'
    statusKind = 'outside'
  }
  const macros = day ? [
    { key: 'kcal', label: '热量', actual: check.totals.kcal, target: day.targets.kcal, unit: '千卡', percent: percent(check.totals.kcal, day.targets.kcal), over: check.totals.kcal > day.targets.kcal },
    { key: 'protein', label: '蛋白质', actual: check.totals.protein, target: day.targets.protein, unit: '克', percent: percent(check.totals.protein, day.targets.protein), over: check.totals.protein > day.targets.protein + 5 },
    { key: 'carbs', label: '碳水', actual: check.totals.carbs, target: day.targets.carbs, unit: '克', percent: percent(check.totals.carbs, day.targets.carbs), over: check.totals.carbs > day.targets.carbs },
    { key: 'fat', label: '脂肪', actual: check.totals.fat, target: day.targets.fat, unit: '克', percent: percent(check.totals.fat, day.targets.fat), over: check.totals.fat > day.targets.fat }
  ] : []
  const meals = day ? MEAL_KEYS.map((key) => {
    const planned = day.meals[key]
    const logged = current.meals[key] || []
    const loggedKcal = logged.reduce((sum, item) => sum + Number(item.kcal || 0), 0)
    return {
      key,
      label: MEAL_LABELS[key],
      name: planned.name,
      badge: planned.badge,
      plannedKcal: planned.totals.kcal,
      plannedLines: (planned.items || []).map((item) => `${item.name} ${item.grams}克`),
      logged,
      loggedKcal,
      skipped: !!current.skippedMeals[key]
    }
  }) : []
  const [year, month, dayNum] = date.split('-')
  return {
    inPlan: !!day,
    date,
    dateLabel: `${Number(month)}月${Number(dayNum)}日 ${weekdayLabel(day ? day.weekday : 0)}`,
    year,
    phaseName: day ? day.phaseName : '',
    weekNum: day ? day.weekNum : 0,
    statusLabel,
    statusKind,
    canLog: !!day && date <= today,
    weightKg: current.weightKg,
    weightDone: check.weightDone,
    mealDone: check.mealDone,
    trainRequired: check.trainRequired,
    trainDone: check.trainDone,
    complete: check.complete,
    targets: day ? day.targets : null,
    macros,
    meals,
    workout: day && day.isTrainingDay ? workout : null,
    rest: !!day && !day.isTrainingDay
  }
}

module.exports = { presentDay }

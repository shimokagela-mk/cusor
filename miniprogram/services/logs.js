const { clone } = require('../utils/clone')
const { sumEntries, presentNutrition } = require('./nutrition')

const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐', snack: '加餐' }

function emptyLog(date) {
  return {
    date,
    weightKg: null,
    skippedMeals: { breakfast: false, lunch: false, dinner: false, snack: false },
    meals: { breakfast: [], lunch: [], dinner: [], snack: [] },
    workout: { completedManual: false, exercises: {} }
  }
}

function withLog(log, date) {
  return clone(log || emptyLog(date))
}

function appendMeal(log, meal, entry) {
  const next = withLog(log, log && log.date)
  next.meals[meal] = (next.meals[meal] || []).concat(entry)
  next.skippedMeals[meal] = false
  return next
}

function replaceMeal(log, meal, entries) {
  const next = withLog(log, log && log.date)
  next.meals[meal] = entries
  next.skippedMeals[meal] = false
  return next
}

function removeMealItem(log, meal, itemId) {
  const next = withLog(log, log && log.date)
  next.meals[meal] = (next.meals[meal] || []).filter((item) => item.id !== itemId)
  return next
}

function updateMealItem(log, meal, itemId, nextItem) {
  const next = withLog(log, log && log.date)
  next.meals[meal] = (next.meals[meal] || []).map((item) => (item.id === itemId ? nextItem : item))
  return next
}

function setMealSkipped(log, meal, skipped) {
  const next = withLog(log, log && log.date)
  next.skippedMeals[meal] = !!skipped
  if (skipped) next.meals[meal] = []
  return next
}

function setWeight(log, weightKg) {
  const next = withLog(log, log && log.date)
  next.weightKg = weightKg
  return next
}

function dayTotals(log) {
  const entries = MEAL_KEYS.reduce((all, meal) => all.concat((log && log.meals && log.meals[meal]) || []), [])
  return presentNutrition(sumEntries(entries))
}

function isWorkoutDone(day, log) {
  if (!day || !day.isTrainingDay) return true
  if (log && log.workout && log.workout.completedManual) return true
  const exercises = (day.workout && day.workout.exercises) || []
  if (!exercises.length) return false
  return exercises.every((exercise) => {
    const saved = log && log.workout && log.workout.exercises[exercise.instanceId]
    if (!saved || !saved.sets || saved.sets.length < exercise.sets) return false
    return saved.sets.slice(0, exercise.sets).every((set) => set.completed)
  })
}

function evaluateDay(day, log) {
  const current = log || emptyLog(day && day.date)
  const weightDone = typeof current.weightKg === 'number' && current.weightKg > 0
  const mealDone = !day || MEAL_KEYS.every((meal) => current.skippedMeals[meal] || ((current.meals[meal] || []).length > 0))
  const trainRequired = !!(day && day.isTrainingDay)
  const trainDone = isWorkoutDone(day, current)
  return {
    weightDone,
    mealDone,
    trainRequired,
    trainDone,
    complete: !!(day && weightDone && mealDone && trainDone),
    totals: dayTotals(current)
  }
}

function hydrateWorkout(day, log) {
  if (!day || !day.workout) return null
  const savedMap = (log && log.workout && log.workout.exercises) || {}
  return {
    title: day.workout.title,
    session: day.workout.session,
    completedManual: !!(log && log.workout && log.workout.completedManual),
    exercises: day.workout.exercises.map((exercise) => {
      const saved = savedMap[exercise.instanceId]
      const sets = []
      for (let i = 0; i < exercise.sets; i += 1) {
        const set = saved && saved.sets && saved.sets[i]
        sets.push({
          reps: set && set.reps != null ? set.reps : '',
          weightKg: set && set.weightKg != null ? set.weightKg : '',
          completed: !!(set && set.completed)
        })
      }
      return { ...exercise, loggedSets: sets }
    })
  }
}

function saveWorkoutState(log, workout) {
  const next = withLog(log, log && log.date)
  const exercises = {}
  workout.exercises.forEach((exercise) => {
    exercises[exercise.instanceId] = {
      exerciseId: exercise.exerciseId,
      sets: exercise.loggedSets.map((set) => ({
        reps: set.reps,
        weightKg: set.weightKg,
        completed: !!set.completed
      }))
    }
  })
  next.workout = {
    completedManual: !!workout.completedManual,
    exercises
  }
  return next
}

function lastWeight(logs, exerciseId) {
  const dates = Object.keys(logs || {}).sort().reverse()
  for (let i = 0; i < dates.length; i += 1) {
    const exercises = logs[dates[i]].workout && logs[dates[i]].workout.exercises
    if (!exercises) continue
    const blocks = Object.keys(exercises).map((key) => exercises[key])
    for (let j = 0; j < blocks.length; j += 1) {
      if (blocks[j].exerciseId !== exerciseId) continue
      const done = (blocks[j].sets || []).filter((set) => set.weightKg !== '' && set.weightKg != null)
      if (done.length) return done[done.length - 1].weightKg
    }
  }
  return ''
}

function swapWorkoutLogs(logA, logB, dateA, dateB) {
  const a = withLog(logA, dateA)
  const b = withLog(logB, dateB)
  const workout = a.workout
  a.workout = b.workout
  b.workout = workout
  a.date = dateA
  b.date = dateB
  return [a, b]
}

module.exports = {
  MEAL_KEYS,
  MEAL_LABELS,
  emptyLog,
  appendMeal,
  replaceMeal,
  removeMealItem,
  updateMealItem,
  setMealSkipped,
  setWeight,
  dayTotals,
  isWorkoutDone,
  evaluateDay,
  hydrateWorkout,
  saveWorkoutState,
  lastWeight,
  swapWorkoutLogs
}

const test = require('node:test')
const assert = require('node:assert/strict')
const { generatePlan, swapWorkouts } = require('../miniprogram/services/plan-engine')
const { foodById } = require('../miniprogram/data/foods')
const { EXERCISES } = require('../miniprogram/data/exercises')
const { searchFoods } = require('../miniprogram/services/nutrition')
const { recognizeFood } = require('../miniprogram/services/recognizer')
const { emptyLog, appendMeal, evaluateDay, setWeight, setMealSkipped } = require('../miniprogram/services/logs')
const { entryFromFood } = require('../miniprogram/services/nutrition')
const { presentDay } = require('../miniprogram/services/day-presenter')
const { createStore, createMemoryStorage } = require('../miniprogram/services/store')
const { handleRecognize } = require('../server/index')
const { listExercises } = require('../miniprogram/services/library')

const base = {
  gender: 'female',
  age: 30,
  heightCm: 165,
  weightKg: 65,
  bodyFatPct: 28,
  goalType: 'cut',
  targetWeightKg: 58,
  targetBodyFatPct: 22,
  weeks: 12,
  trainingWeekdays: [1, 3, 5],
  experience: 'beginner',
  venue: 'gym',
  equipment: [],
  injuries: [],
  dietRestrictions: []
}

test('12-week plan has phases, meals and training days', () => {
  const plan = generatePlan(base, '2026-09-21')
  assert.equal(plan.days.length, 84)
  assert.equal(plan.phases.length, 3)
  assert.equal(plan.phases[1].targets.kcal < plan.tdee, true)
  const monday = plan.days[0]
  assert.equal(monday.isTrainingDay, true)
  assert.equal(monday.meals.breakfast.items.length > 0, true)
  assert.equal(monday.meals.lunch.items.length > 0, true)
  assert.equal(monday.meals.dinner.items.length > 0, true)
  assert.equal(monday.meals.snack.items.length > 0, true)
  const kcal = ['breakfast', 'lunch', 'dinner', 'snack'].reduce((sum, key) => sum + monday.meals[key].totals.kcal, 0)
  assert.ok(kcal > monday.targets.kcal * 0.8 && kcal < monday.targets.kcal * 1.2)
  const protein = ['breakfast', 'lunch', 'dinner', 'snack'].reduce((sum, key) => sum + monday.meals[key].totals.protein, 0)
  assert.ok(protein > monday.targets.protein * 0.7)
})

test('bulk plan calories sit above maintenance', () => {
  const plan = generatePlan({ ...base, goalType: 'bulk', targetWeightKg: 68, gender: 'male', weightKg: 70 }, '2026-09-21')
  assert.ok(plan.phases[1].targets.kcal > plan.tdee)
})

test('restrictions remove blocked foods and keep three meal styles', () => {
  const plan = generatePlan({ ...base, dietRestrictions: ['vegetarian', 'lactose', 'spicy', 'seafood'] }, '2026-09-21')
  const badges = new Set()
  plan.days.forEach((day) => {
    Object.values(day.meals).forEach((meal) => {
      badges.add(meal.badge)
      meal.items.forEach((item) => {
        const food = foodById(item.foodId)
        assert.equal(food.excludeWhen.some((flag) => ['vegetarian', 'lactose', 'spicy', 'seafood'].includes(flag)), false)
      })
    })
  })
  assert.equal(badges.has('家常'), true)
})

test('open diet plan includes home, takeout and fitness meals', () => {
  const plan = generatePlan(base, '2026-09-21')
  const badges = new Set()
  plan.days.forEach((day) => Object.values(day.meals).forEach((meal) => badges.add(meal.badge)))
  assert.equal(badges.has('家常'), true)
  assert.equal(badges.has('外卖'), true)
  assert.equal(badges.has('健身餐'), true)
})

test('knee injury and home equipment filter exercises', () => {
  const plan = generatePlan({
    ...base,
    experience: 'intermediate',
    venue: 'home',
    equipment: [],
    injuries: ['knee'],
    trainingWeekdays: [1, 2, 4, 5]
  }, '2026-09-21')
  plan.days.forEach((day) => {
    if (!day.workout) return
    day.workout.exercises.forEach((item) => {
      const exercise = EXERCISES.find((entry) => entry.id === item.exerciseId)
      assert.equal(exercise.avoid.includes('knee'), false)
      assert.equal(exercise.equipment.some((eq) => eq === 'bodyweight'), true)
    })
  })
})

test('missed day does not shift later workouts', () => {
  const plan = generatePlan(base, '2026-09-21')
  const swapped = swapWorkouts(plan, '2026-09-21', '2026-09-22')
  assert.equal(swapped.days[2].date, plan.days[2].date)
  assert.equal(swapped.days[2].workout && swapped.days[2].workout.title, plan.days[2].workout && plan.days[2].workout.title)
  assert.equal(swapped.days[0].isTrainingDay, false)
  assert.equal(swapped.days[1].isTrainingDay, true)
  assert.equal(swapped.days[0].meals.lunch.name, plan.days[0].meals.lunch.name)
})

test('check-in needs weight, meals and workout without moving the plan', () => {
  const plan = generatePlan(base, '2026-09-21')
  const day = plan.days[0]
  let log = emptyLog(day.date)
  assert.equal(evaluateDay(day, log).complete, false)
  log = setWeight(log, 64.5)
  ;['breakfast', 'lunch', 'dinner'].forEach((meal) => {
    log = appendMeal(log, meal, entryFromFood(foodById('egg'), 50))
  })
  log = setMealSkipped(log, 'snack', true)
  log.workout.completedManual = true
  const status = evaluateDay(day, log)
  assert.equal(status.complete, true)
  const view = presentDay({ plan, date: day.date, log, today: '2026-09-22' })
  assert.equal(view.statusLabel, '已打卡')
  const missed = presentDay({ plan, date: plan.days[1].date, log: emptyLog(plan.days[1].date), today: '2026-09-23' })
  assert.equal(missed.statusLabel, '未完成')
  assert.equal(plan.days[2].date, '2026-09-23')
})

test('search and recognize food names', async () => {
  const found = searchFoods('鸡胸')
  assert.equal(found[0].name, '鸡胸肉')
  const matched = recognizeFood({ hint: '番茄炒蛋', mealType: 'lunch' })
  assert.equal(matched.confident, true)
  const photoOnly = recognizeFood({ hint: '', mealType: 'dinner' })
  assert.equal(photoOnly.confident, false)
  assert.ok(photoOnly.items.length > 0)
  const remote = await handleRecognize({ hint: '牛肉盖饭', mealType: 'lunch' })
  assert.equal(remote.ok, true)
  assert.equal(remote.items[0].name, '牛肉盖饭')
})

test('users keep separate plans', () => {
  const store = createStore(createMemoryStorage())
  store.ensureUser()
  store.savePlan({ id: 'a', days: [] })
  const other = store.createUser('朋友')
  store.switchUser(other.id)
  assert.equal(store.getPlan(), null)
  store.savePlan({ id: 'b', days: [] })
  assert.equal(store.getPlan().id, 'b')
  store.switchUser(store.listUsers()[0].id)
  assert.equal(store.getPlan().id, 'a')
})

test('library hides exercises the user cannot do', () => {
  const list = listExercises({ onlyDoable: true, equipment: [], injuries: ['knee'], query: '深蹲' })
  assert.equal(list.length, 0)
  const all = listExercises({ query: '卧推' })
  assert.ok(all.length >= 2)
})

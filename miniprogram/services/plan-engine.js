const { FOODS, foodById } = require('../data/foods')
const { TEMPLATES } = require('../data/recipes')
const { EXERCISES } = require('../data/exercises')
const { parseDate, formatDate, addDays } = require('../utils/date')
const { clone, round, round1 } = require('../utils/clone')
const { nutritionOf, presentNutrition } = require('./nutrition')
const { normalizeProfile, validateProfile } = require('./profile')

const MEAL_RATIO = { breakfast: 0.25, lunch: 0.35, dinner: 0.28, snack: 0.12 }
const MEAL_KEYS = ['breakfast', 'lunch', 'dinner', 'snack']
const PHASE_NAMES = {
  cut: ['适应期', '强化期', '巩固期'],
  bulk: ['适应期', '增量期', '巩固期']
}
const PHASE_FOCUS = {
  cut: ['熟悉动作，热量缺口温和', '提高训练量，缺口加大', '保持缺口，最后一周减少组数'],
  bulk: ['熟悉动作，小幅热量盈余', '提高训练量和盈余', '保持盈余，最后一周减少组数']
}
const SESSION_NAMES = {
  full: '全身训练',
  upper: '上肢训练',
  lower: '下肢训练',
  push: '推类训练',
  pull: '拉类训练',
  legs: '腿部训练',
  recovery: '恢复活动'
}

function bmr(profile) {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age
  return profile.gender === 'male' ? base + 5 : base - 161
}

function activityFactor(trainingDays) {
  if (trainingDays <= 1) return 1.2
  if (trainingDays <= 3) return 1.375
  if (trainingDays <= 5) return 1.55
  return 1.725
}

function phaseLengths(weeks) {
  const base = Math.floor(weeks / 3)
  const rem = weeks % 3
  const lens = [base, base, base]
  if (rem >= 1) lens[1] += 1
  if (rem >= 2) lens[2] += 1
  return lens
}

function macroTargets(weightKg, tdee, goalType, phaseIndex) {
  const multiplier = (goalType === 'cut' ? [0.88, 0.8, 0.82] : [1.08, 1.12, 1.08])[phaseIndex]
  const kcal = round(tdee * multiplier)
  const protein = round(weightKg * (goalType === 'cut' ? 2 : 1.8))
  let fat = round(weightKg * (goalType === 'cut' ? 0.8 : 0.9))
  let carbs = round((kcal - protein * 4 - fat * 9) / 4)
  if (carbs < 60) {
    const fatFloor = round(weightKg * 0.6)
    fat = Math.max(fatFloor, round((kcal - protein * 4 - 60 * 4) / 9))
    carbs = Math.max(40, round((kcal - protein * 4 - fat * 9) / 4))
  }
  return { kcal, protein, fat, carbs }
}

function paceNote(profile) {
  if (profile.targetWeightKg == null) return ''
  const delta = profile.targetWeightKg - profile.weightKg
  const perWeek = delta / profile.weeks
  const pct = (perWeek / profile.weightKg) * 100
  if (profile.goalType === 'cut' && delta > 0) {
    return '减脂计划的目标体重高于当前体重。热量仍按减脂安排，可以回头修改目标。'
  }
  if (profile.goalType === 'bulk' && delta < 0) {
    return '增肌计划的目标体重低于当前体重。热量仍按增肌安排，可以回头修改目标。'
  }
  if (profile.goalType === 'cut' && pct < -0.8) {
    return `按目标体重，平均每周约降 ${Math.abs(perWeek).toFixed(2)} 公斤，快于常见的每周 0.5%–0.8% 体重。热量按更稳妥的速度安排，周期结束时体重可能还没到目标。`
  }
  if (profile.goalType === 'bulk' && pct > 0.4) {
    return `按目标体重，平均每周约增 ${perWeek.toFixed(2)} 公斤，快于常见的每周约 0.25%–0.4% 体重。热量按更稳妥的速度安排。`
  }
  return ''
}

function templateAllowed(template, restrictions) {
  return template.items.every((item) => {
    const food = foodById(item.foodId)
    return food && !food.excludeWhen.some((flag) => restrictions.includes(flag))
  })
}

function snap(grams) {
  return Math.max(10, Math.round(grams / 5) * 5)
}

function proteinSide(restrictions) {
  const order = ['chicken', 'egg', 'tofu', 'yogurt', 'shrimp', 'tuna']
  for (let i = 0; i < order.length; i += 1) {
    const food = foodById(order[i])
    if (food && !food.excludeWhen.some((flag) => restrictions.includes(flag))) return food
  }
  return null
}

function scaleTemplate(template, target, restrictions) {
  const items = template.items.map((item) => ({
    foodId: item.foodId,
    grams: item.baseGrams,
    food: foodById(item.foodId)
  }))
  const base = nutritionOf(items)
  const factor = Math.min(1.75, Math.max(0.55, target.kcal / Math.max(base.kcal, 1)))
  items.forEach((item) => {
    item.grams = snap(item.grams * factor)
  })
  for (let step = 0; step < 8; step += 1) {
    const nut = nutritionOf(items)
    if (nut.protein < target.protein * 0.9) {
      const proteinItem = items.find((item) => item.food.roles.includes('protein'))
      if (proteinItem && proteinItem.food.per100g.protein > 0) {
        const add = (target.protein - nut.protein) / (proteinItem.food.per100g.protein / 100)
        proteinItem.grams = snap(proteinItem.grams + Math.min(50, Math.max(10, add)))
        continue
      }
      const side = proteinSide(restrictions)
      if (side) {
        const grams = snap(Math.min(220, Math.max(40, (target.protein - nut.protein) / (side.per100g.protein / 100))))
        items.push({ foodId: side.id, grams, food: side })
        continue
      }
    }
    const kcalGap = target.kcal - nut.kcal
    const carbItem = items.find((item) => item.food.roles.includes('carb') && item.food.per100g.kcal > 0)
    if (kcalGap > target.kcal * 0.06 && carbItem) {
      const add = kcalGap / (carbItem.food.per100g.kcal / 100)
      carbItem.grams = snap(carbItem.grams + Math.min(60, Math.max(10, add)))
      continue
    }
    if (kcalGap < -target.kcal * 0.06 && carbItem && carbItem.grams > 30) {
      const sub = (-kcalGap) / (carbItem.food.per100g.kcal / 100)
      carbItem.grams = Math.max(20, snap(carbItem.grams - Math.min(50, Math.max(10, sub))))
      continue
    }
    break
  }
  const totals = presentNutrition(nutritionOf(items))
  return {
    templateId: template.id,
    name: template.name,
    badge: template.badge,
    target,
    totals,
    items: items.map((item) => {
      const ratio = item.grams / 100
      return {
        foodId: item.food.id,
        name: item.food.name,
        grams: item.grams,
        kcal: round(item.food.per100g.kcal * ratio),
        protein: round1(item.food.per100g.protein * ratio),
        carbs: round1(item.food.per100g.carbs * ratio),
        fat: round1(item.food.per100g.fat * ratio),
        per100g: item.food.per100g,
        unitHint: item.food.unitHint || ''
      }
    })
  }
}

function buildMeal(meal, restrictions, dayIndex, target) {
  const list = TEMPLATES.filter((template) => template.meal === meal && templateAllowed(template, restrictions))
  if (!list.length) {
    return { templateId: '', name: '按额度自行安排', badge: '', items: [], totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, target }
  }
  const offset = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }[meal] || 0
  const template = list[(dayIndex + offset) % list.length]
  return scaleTemplate(template, target, restrictions)
}

function equipmentSet(profile) {
  const set = new Set(profile.equipment || [])
  set.add('bodyweight')
  return set
}

function exerciseAllowed(exercise, equipment, injuries) {
  if ((exercise.avoid || []).some((flag) => injuries.includes(flag))) return false
  return (exercise.equipment || []).some((item) => equipment.has(item))
}

function splitFor(count, experience) {
  if (count <= 1) return ['full']
  if (count === 2) return ['full', 'full']
  if (count === 3) return experience === 'beginner' ? ['full', 'full', 'full'] : ['push', 'pull', 'legs']
  if (count === 4) return ['upper', 'lower', 'upper', 'lower']
  if (count === 5) return ['push', 'pull', 'legs', 'upper', 'lower']
  if (count === 6) return ['push', 'pull', 'legs', 'push', 'pull', 'legs']
  return ['push', 'pull', 'legs', 'upper', 'lower', 'full', 'push'].slice(0, count)
}

function setScheme(goalType, experience, deload) {
  const table = {
    cut: {
      beginner: { sets: 3, reps: '10-15', isoReps: '12-15', rest: 60 },
      intermediate: { sets: 4, reps: '8-12', isoReps: '12-15', rest: 75 }
    },
    bulk: {
      beginner: { sets: 3, reps: '8-12', isoReps: '10-15', rest: 90 },
      intermediate: { sets: 4, reps: '6-10', isoReps: '10-12', rest: 120 }
    }
  }
  const scheme = { ...table[goalType][experience] }
  if (deload) scheme.sets = Math.max(2, scheme.sets - 1)
  return scheme
}

function buildWorkout({ session, profile, weekNum, deload, equipment, injuries, date }) {
  const pool = EXERCISES.filter((exercise) => exercise.sessions.includes(session) && exerciseAllowed(exercise, equipment, injuries))
  const compounds = pool.filter((exercise) => exercise.kind === 'compound').sort((a, b) => a.order - b.order)
  const isolations = pool.filter((exercise) => exercise.kind === 'isolation').sort((a, b) => a.order - b.order)
  const targetCount = profile.experience === 'beginner' ? 4 : 5
  const chosen = []
  const push = (exercise) => {
    if (exercise && !chosen.some((item) => item.id === exercise.id)) chosen.push(exercise)
  }
  compounds.slice(0, session === 'full' ? 3 : 2).forEach(push)
  const offset = isolations.length ? (weekNum - 1) % isolations.length : 0
  for (let i = 0; i < isolations.length && chosen.length < targetCount; i += 1) {
    push(isolations[(offset + i) % isolations.length])
  }
  for (let i = 0; i < compounds.length && chosen.length < targetCount; i += 1) push(compounds[i])
  if (!chosen.length) {
    const walk = EXERCISES.find((exercise) => exercise.id === 'walk')
    return {
      title: SESSION_NAMES.recovery,
      session: 'recovery',
      exercises: [{
        instanceId: `${date}-0`,
        exerciseId: walk.id,
        name: walk.name,
        sets: 1,
        reps: '30分钟',
        restSec: 0,
        cue: walk.cue,
        kind: walk.kind,
        muscles: walk.muscles
      }]
    }
  }
  const scheme = setScheme(profile.goalType, profile.experience, deload)
  return {
    title: SESSION_NAMES[session] + (deload ? ' · 减量周' : ''),
    session,
    exercises: chosen.map((exercise, index) => ({
      instanceId: `${date}-${index}`,
      exerciseId: exercise.id,
      name: exercise.name,
      sets: exercise.kind === 'isolation' ? Math.max(2, scheme.sets - 1) : scheme.sets,
      reps: exercise.kind === 'isolation' ? scheme.isoReps : scheme.reps,
      restSec: exercise.kind === 'isolation' ? Math.max(45, scheme.rest - 30) : scheme.rest,
      cue: exercise.cue,
      kind: exercise.kind,
      muscles: exercise.muscles
    }))
  }
}

function generatePlan(input, startDate) {
  const profile = normalizeProfile(input)
  const errors = validateProfile(profile)
  if (errors.length) throw new Error(errors.join('；'))
  const trainingWeekdays = profile.trainingWeekdays
  const maintenance = bmr(profile) * activityFactor(trainingWeekdays.length)
  const lengths = phaseLengths(profile.weeks)
  const phases = []
  let weekCursor = 1
  lengths.forEach((weeks, index) => {
    phases.push({
      index,
      name: PHASE_NAMES[profile.goalType][index],
      focus: PHASE_FOCUS[profile.goalType][index],
      startWeek: weekCursor,
      endWeek: weekCursor + weeks - 1,
      weeks,
      targets: macroTargets(profile.weightKg, maintenance, profile.goalType, index)
    })
    weekCursor += weeks
  })
  const split = splitFor(trainingWeekdays.length, profile.experience)
  const weekdaySession = {}
  trainingWeekdays.forEach((weekday, index) => {
    weekdaySession[weekday] = split[index]
  })
  const equipment = equipmentSet(profile)
  const totalDays = profile.weeks * 7
  const start = parseDate(startDate)
  const days = []
  for (let i = 0; i < totalDays; i += 1) {
    const dateObj = addDays(start, i)
    const date = formatDate(dateObj)
    const weekday = dateObj.getDay()
    const weekNum = Math.floor(i / 7) + 1
    const phase = phases.find((item) => weekNum >= item.startWeek && weekNum <= item.endWeek)
    const deload = totalDays >= 14 && i >= totalDays - 7
    const isTrainingDay = Object.prototype.hasOwnProperty.call(weekdaySession, weekday)
    const workout = isTrainingDay
      ? buildWorkout({
        session: weekdaySession[weekday],
        profile,
        weekNum,
        deload,
        equipment,
        injuries: profile.injuries,
        date
      })
      : null
    const meals = {}
    MEAL_KEYS.forEach((meal) => {
      const ratio = MEAL_RATIO[meal]
      meals[meal] = buildMeal(meal, profile.dietRestrictions, i, {
        kcal: round(phase.targets.kcal * ratio),
        protein: round(phase.targets.protein * ratio),
        carbs: round(phase.targets.carbs * ratio),
        fat: round(phase.targets.fat * ratio)
      })
    })
    days.push({
      date,
      weekday,
      dayIndex: i,
      weekNum,
      phaseIndex: phase.index,
      phaseName: phase.name,
      isTrainingDay,
      deload,
      targets: phase.targets,
      workout,
      meals
    })
  }
  const warnings = []
  const note = paceNote(profile)
  if (note) warnings.push(note)
  return {
    id: `plan_${startDate}_${profile.goalType}`,
    startDate,
    endDate: days[days.length - 1].date,
    goalType: profile.goalType,
    profile,
    bmr: round(bmr(profile)),
    tdee: round(maintenance),
    phases,
    days,
    warnings,
    createdAt: ''
  }
}

function swapWorkouts(plan, dateA, dateB) {
  if (dateA === dateB) return clone(plan)
  const next = clone(plan)
  const a = next.days.find((day) => day.date === dateA)
  const b = next.days.find((day) => day.date === dateB)
  if (!a || !b) return next
  const workout = a.workout
  const training = a.isTrainingDay
  a.workout = b.workout
  a.isTrainingDay = b.isTrainingDay
  b.workout = workout
  b.isTrainingDay = training
  return next
}

module.exports = {
  generatePlan,
  swapWorkouts,
  bmr,
  FOODS
}

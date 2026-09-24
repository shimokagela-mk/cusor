const { sortWeekdays } = require('../utils/date')

const HOME_EQUIPMENT = ['dumbbell', 'band', 'pullup']
const GYM_EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'cable', 'band', 'pullup']

function num(value) {
  if (value === '' || value == null) return NaN
  return Number(value)
}

function optionalNum(value) {
  if (value === '' || value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeProfile(input) {
  const venue = input.venue === 'home' ? 'home' : 'gym'
  const equipment = venue === 'gym'
    ? GYM_EQUIPMENT.slice()
    : HOME_EQUIPMENT.filter((item) => (input.equipment || []).includes(item))
  return {
    gender: input.gender === 'male' ? 'male' : 'female',
    age: num(input.age),
    heightCm: num(input.heightCm),
    weightKg: num(input.weightKg),
    bodyFatPct: optionalNum(input.bodyFatPct),
    goalType: input.goalType === 'bulk' ? 'bulk' : 'cut',
    targetWeightKg: optionalNum(input.targetWeightKg),
    targetBodyFatPct: optionalNum(input.targetBodyFatPct),
    weeks: Math.round(num(input.weeks)),
    trainingWeekdays: sortWeekdays(
      [...new Set((input.trainingWeekdays || []).map(Number))].filter((day) => day >= 0 && day <= 6)
    ),
    experience: input.experience === 'intermediate' ? 'intermediate' : 'beginner',
    venue,
    equipment,
    injuries: (input.injuries || []).slice(),
    dietRestrictions: (input.dietRestrictions || []).slice()
  }
}

function validateProfile(profile) {
  const errors = []
  if (profile.gender !== 'male' && profile.gender !== 'female') errors.push('请选择性别')
  if (!(profile.age >= 16 && profile.age <= 80)) errors.push('年龄请填写 16–80')
  if (!(profile.heightCm >= 120 && profile.heightCm <= 230)) errors.push('身高请填写 120–230 厘米')
  if (!(profile.weightKg >= 30 && profile.weightKg <= 250)) errors.push('体重请填写 30–250 公斤')
  if (profile.bodyFatPct != null && !(profile.bodyFatPct >= 3 && profile.bodyFatPct <= 60)) {
    errors.push('体脂请填写 3–60，或留空')
  }
  if (profile.targetWeightKg == null && profile.targetBodyFatPct == null) {
    errors.push('请填写目标体重或目标体脂')
  }
  if (profile.targetWeightKg != null && !(profile.targetWeightKg >= 30 && profile.targetWeightKg <= 250)) {
    errors.push('目标体重请填写 30–250 公斤')
  }
  if (profile.targetBodyFatPct != null && !(profile.targetBodyFatPct >= 3 && profile.targetBodyFatPct <= 60)) {
    errors.push('目标体脂请填写 3–60')
  }
  if (!(profile.weeks >= 4 && profile.weeks <= 52)) errors.push('周期请填写 4–52 周')
  if (!profile.trainingWeekdays.length) errors.push('请至少选择一个训练日')
  return errors
}

module.exports = { normalizeProfile, validateProfile, HOME_EQUIPMENT, GYM_EQUIPMENT }

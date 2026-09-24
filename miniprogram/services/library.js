const { EXERCISES, EQUIPMENT_LABELS, INJURY_LABELS } = require('../data/exercises')

function listExercises({ query, onlyDoable, equipment, injuries }) {
  const q = (query || '').trim()
  const equipmentSet = new Set(equipment || [])
  equipmentSet.add('bodyweight')
  return EXERCISES.filter((exercise) => {
    if (q && !exercise.name.includes(q) && !exercise.muscles.includes(q)) return false
    if (onlyDoable) {
      if ((exercise.avoid || []).some((flag) => (injuries || []).includes(flag))) return false
      if (!(exercise.equipment || []).some((item) => equipmentSet.has(item))) return false
    }
    return true
  }).map((exercise) => ({
    ...exercise,
    equipmentText: (exercise.equipment || []).map((item) => EQUIPMENT_LABELS[item] || item).join('、'),
    avoidText: (exercise.avoid || []).map((item) => INJURY_LABELS[item] || item).join('、')
  }))
}

module.exports = { listExercises }

const { FOODS, foodById } = require('../data/foods')
const { round, round1, uid } = require('../utils/clone')

function searchFoods(query, foods) {
  const source = foods || FOODS
  const q = (query || '').trim().toLowerCase()
  if (!q) return []
  const scored = []
  source.forEach((food) => {
    const names = [food.name].concat(food.aliases || [])
    let score = 0
    names.forEach((name) => {
      const text = name.toLowerCase()
      if (text === q) score = Math.max(score, 100)
      else if (text.startsWith(q)) score = Math.max(score, 80)
      else if (text.includes(q)) score = Math.max(score, 50)
    })
    if (score) scored.push({ food, score })
  })
  scored.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length)
  return scored.map((item) => item.food)
}

function nutritionOf(items) {
  return items.reduce((total, item) => {
    const food = item.food || foodById(item.foodId)
    const ratio = item.grams / 100
    total.kcal += food.per100g.kcal * ratio
    total.protein += food.per100g.protein * ratio
    total.carbs += food.per100g.carbs * ratio
    total.fat += food.per100g.fat * ratio
    return total
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

function sumEntries(entries) {
  return (entries || []).reduce((total, entry) => ({
    kcal: total.kcal + Number(entry.kcal || 0),
    protein: total.protein + Number(entry.protein || 0),
    carbs: total.carbs + Number(entry.carbs || 0),
    fat: total.fat + Number(entry.fat || 0)
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
}

function presentNutrition(total) {
  return {
    kcal: round(total.kcal),
    protein: round(total.protein),
    carbs: round(total.carbs),
    fat: round(total.fat)
  }
}

function entryFromFood(food, grams, source) {
  const safeGrams = Math.max(1, round(grams || food.defaultGrams || 100))
  const ratio = safeGrams / 100
  return {
    id: uid('food'),
    foodId: food.id,
    name: food.name,
    grams: safeGrams,
    kcal: round(food.per100g.kcal * ratio),
    protein: round1(food.per100g.protein * ratio),
    carbs: round1(food.per100g.carbs * ratio),
    fat: round1(food.per100g.fat * ratio),
    per100g: food.per100g,
    source: source || 'search',
    unitHint: food.unitHint || ''
  }
}

function entryFromManual(input) {
  const grams = Math.max(1, round(input.grams))
  const kcal = Number(input.kcal) || 0
  const protein = Number(input.protein) || 0
  const carbs = Number(input.carbs) || 0
  const fat = Number(input.fat) || 0
  return {
    id: uid('food'),
    foodId: '',
    name: String(input.name || '').trim(),
    grams,
    kcal: round(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
    per100g: {
      kcal: round(kcal * 100 / grams),
      protein: round1(protein * 100 / grams),
      carbs: round1(carbs * 100 / grams),
      fat: round1(fat * 100 / grams)
    },
    source: 'manual',
    unitHint: ''
  }
}

function rescaleEntry(entry, grams) {
  const safeGrams = Math.max(1, round(grams))
  if (entry.per100g) {
    const ratio = safeGrams / 100
    return {
      ...entry,
      grams: safeGrams,
      kcal: round(entry.per100g.kcal * ratio),
      protein: round1(entry.per100g.protein * ratio),
      carbs: round1(entry.per100g.carbs * ratio),
      fat: round1(entry.per100g.fat * ratio)
    }
  }
  const ratio = safeGrams / (entry.grams || safeGrams)
  return {
    ...entry,
    grams: safeGrams,
    kcal: round(entry.kcal * ratio),
    protein: round1(entry.protein * ratio),
    carbs: round1(entry.carbs * ratio),
    fat: round1(entry.fat * ratio)
  }
}

function entryFromPlanItem(item) {
  return {
    id: uid('food'),
    foodId: item.foodId,
    name: item.name,
    grams: item.grams,
    kcal: item.kcal,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    per100g: item.per100g,
    source: 'plan',
    unitHint: item.unitHint || ''
  }
}

module.exports = {
  searchFoods,
  nutritionOf,
  sumEntries,
  presentNutrition,
  entryFromFood,
  entryFromManual,
  rescaleEntry,
  entryFromPlanItem
}

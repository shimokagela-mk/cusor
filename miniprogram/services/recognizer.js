const { FOODS } = require('../data/foods')
const { searchFoods } = require('./nutrition')

const MEAL_FALLBACK = {
  breakfast: ['燕麦片', '鸡蛋', '牛奶', '包子', '小米粥'],
  lunch: ['鸡胸肉', '米饭', '牛肉盖饭', '番茄炒蛋', '轻食沙拉碗'],
  dinner: ['鸡胸肉', '红薯', '豆腐', '虾仁', '蛋炒饭'],
  snack: ['无糖希腊酸奶', '苹果', '混合坚果', '香蕉']
}

function suggestFoods(mealType, foods) {
  const names = MEAL_FALLBACK[mealType] || MEAL_FALLBACK.lunch
  const picked = []
  names.forEach((name) => {
    const found = (foods || FOODS).find((food) => food.name === name)
    if (found) picked.push(found)
  })
  return picked
}

function recognizeFood({ hint, mealType, foods }) {
  const catalog = foods || FOODS
  const text = (hint || '').trim()
  if (!text) {
    return {
      confident: false,
      message: '照片已保存。输入你看到的菜名就能匹配热量，也可以从下面选一个接近的。',
      items: suggestFoods(mealType, catalog)
    }
  }
  const found = searchFoods(text, catalog)
  const exact = found.find((food) => food.name === text || (food.aliases || []).includes(text))
  if (exact) {
    return {
      confident: true,
      message: `匹配到「${exact.name}」，确认份量后记入。`,
      items: [exact].concat(found.filter((food) => food.id !== exact.id)).slice(0, 8)
    }
  }
  if (found.length) {
    return {
      confident: false,
      message: '找到了相近食物，请点选确认。',
      items: found.slice(0, 8)
    }
  }
  return {
    confident: false,
    message: '食物库里没有这个名字，可以手动填写热量。',
    items: []
  }
}

module.exports = { recognizeFood, suggestFoods }

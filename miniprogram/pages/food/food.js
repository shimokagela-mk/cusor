const { FOODS } = require('../../data/foods')
const { searchFoods, entryFromFood, entryFromManual } = require('../../services/nutrition')
const { appendMeal, emptyLog } = require('../../services/logs')

Page({
  data: { mode: 'search', query: '', results: [], recent: [], manual: { name: '', grams: '', kcal: '', protein: '', carbs: '', fat: '' }, picked: null, grams: 100 },
  onLoad(query) {
    this.date = query.date
    this.meal = query.meal
    const recent = getApp().store.getRecentFoods()
    this.setData({ mode: query.mode || 'search', recent, results: FOODS.slice(0, 8) })
  },
  onMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode })
  },
  onQuery(e) {
    const query = e.detail.value
    const results = query ? searchFoods(query) : FOODS.slice(0, 8)
    this.setData({ query, results })
  },
  onPick(e) {
    const food = FOODS.find((item) => item.id === e.currentTarget.dataset.id) || this.data.recent.find((item) => item.name === e.currentTarget.dataset.name)
    if (!food) return
    this.setData({ picked: food, grams: food.defaultGrams || food.grams || 100 })
  },
  onGrams(e) {
    this.setData({ grams: Number(e.detail.value) })
  },
  onManual(e) {
    this.setData({ [`manual.${e.currentTarget.dataset.field}`]: e.detail.value })
  },
  save(entry) {
    const store = getApp().store
    const log = store.getLog(this.date) || emptyLog(this.date)
    store.saveLog(appendMeal(log, this.meal, entry))
    store.pushRecent(entry)
    wx.navigateBack()
  },
  onSavePicked() {
    const picked = this.data.picked
    const catalog = FOODS.find((item) => item.id === (picked.id || picked.foodId))
    const food = catalog || {
      id: picked.foodId || '',
      name: picked.name,
      per100g: picked.per100g,
      unitHint: picked.unitHint || '',
      defaultGrams: picked.grams
    }
    if (!food.per100g) {
      wx.showToast({ title: '请重新选择食物', icon: 'none' })
      return
    }
    this.save(entryFromFood(food, this.data.grams, 'search'))
  },
  onSaveManual() {
    const manual = this.data.manual
    if (!manual.name || !(Number(manual.grams) > 0)) {
      wx.showToast({ title: '请填写名称和份量', icon: 'none' })
      return
    }
    this.save(entryFromManual(manual))
  }
})

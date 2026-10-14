const { formatDate } = require('../utils/date')
const { presentDay } = require('./day-presenter')
const { emptyLog, appendMeal, replaceMeal, removeMealItem, updateMealItem, setMealSkipped, setWeight } = require('./logs')
const { entryFromPlanItem, rescaleEntry } = require('./nutrition')

function createDayPage(lockToday) {
  return {
    data: { ready: false, hasPlan: false, vm: null },
    onLoad(query) {
      this.fixedDate = lockToday ? '' : (query.date || '')
    },
    onShow() {
      this.reload()
    },
    currentDate() {
      return lockToday ? formatDate(new Date()) : this.fixedDate
    },
    reload() {
      const store = getApp().store
      const plan = store.getPlan()
      if (!plan) {
        this.setData({ ready: true, hasPlan: false, vm: null })
        return
      }
      const date = this.currentDate()
      const log = store.getLog(date)
      const vm = presentDay({ plan, date, log, today: formatDate(new Date()) })
      if (!lockToday) wx.setNavigationBarTitle({ title: vm.dateLabel })
      this.setData({ ready: true, hasPlan: true, vm })
    },
    mutate(updater) {
      const date = this.currentDate()
      const store = getApp().store
      const log = store.getLog(date) || emptyLog(date)
      store.saveLog(updater(log))
      this.reload()
    },
    guard() {
      if (this.data.vm && this.data.vm.canLog) return true
      wx.showToast({ title: '到了当天再打卡', icon: 'none' })
      return false
    },
    onWeightInput(e) {
      this.weightDraft = e.detail.value
    },
    onSaveWeight() {
      if (!this.guard()) return
      const value = Number(this.weightDraft != null ? this.weightDraft : this.data.vm.weightKg)
      if (!(value > 0)) {
        wx.showToast({ title: '请填写体重', icon: 'none' })
        return
      }
      this.mutate((log) => setWeight(log, Math.round(value * 10) / 10))
    },
    onUsePlan(e) {
      if (!this.guard()) return
      const meal = e.currentTarget.dataset.meal
      const plan = getApp().store.getPlan()
      const day = plan.days.find((item) => item.date === this.currentDate())
      const entries = (day.meals[meal].items || []).map(entryFromPlanItem)
      this.mutate((log) => replaceMeal(log, meal, entries))
    },
    onSkipMeal(e) {
      if (!this.guard()) return
      const meal = e.currentTarget.dataset.meal
      const skipped = e.currentTarget.dataset.skipped === true || e.currentTarget.dataset.skipped === 'true'
      this.mutate((log) => setMealSkipped(log, meal, !skipped))
    },
    onDeleteFood(e) {
      if (!this.guard()) return
      const { meal, id } = e.currentTarget.dataset
      this.mutate((log) => removeMealItem(log, meal, id))
    },
    onStep(e) {
      if (!this.guard()) return
      const { meal, id, delta } = e.currentTarget.dataset
      this.mutate((log) => {
        const item = (log.meals[meal] || []).find((entry) => entry.id === id)
        if (!item) return log
        return updateMealItem(log, meal, id, rescaleEntry(item, item.grams + Number(delta)))
      })
    },
    onSearch(e) {
      if (!this.guard()) return
      wx.navigateTo({ url: `/pages/food/food?date=${this.currentDate()}&meal=${e.currentTarget.dataset.meal}&mode=search` })
    },
    onManual(e) {
      if (!this.guard()) return
      wx.navigateTo({ url: `/pages/food/food?date=${this.currentDate()}&meal=${e.currentTarget.dataset.meal}&mode=manual` })
    },
    onPhoto(e) {
      if (!this.guard()) return
      wx.navigateTo({ url: `/pages/photo/photo?date=${this.currentDate()}&meal=${e.currentTarget.dataset.meal}` })
    },
    onOpenWorkout() {
      wx.navigateTo({ url: `/pages/workout/workout?date=${this.currentDate()}` })
    },
    onCreate() {
      wx.navigateTo({ url: '/pages/wizard/wizard' })
    }
  }
}

module.exports = { createDayPage }

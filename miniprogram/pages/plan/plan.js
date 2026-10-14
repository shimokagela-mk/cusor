const { weekdayLabel } = require('../../utils/date')

Page({
  data: { ready: false, hasPlan: false },
  onShow() {
    const plan = getApp().store.getPlan()
    if (!plan) {
      this.setData({ ready: true, hasPlan: false })
      return
    }
    const order = [1, 2, 3, 4, 5, 6, 0]
    const rhythm = order.map((weekday) => {
      const sample = plan.days.find((day) => day.weekday === weekday)
      const title = sample && sample.isTrainingDay && sample.workout ? sample.workout.title.replace(' · 减量周', '') : '休息'
      return `${weekdayLabel(weekday)} ${title}`
    })
    this.setData({
      ready: true,
      hasPlan: true,
      goal: plan.goalType === 'cut' ? '减脂' : '增肌',
      range: `${plan.startDate} 至 ${plan.endDate}`,
      weeks: plan.profile.weeks,
      tdee: plan.tdee,
      phases: plan.phases,
      rhythm,
      warnings: plan.warnings,
      weekNum: this.currentWeek(plan)
    })
  },
  currentWeek(plan) {
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const day = plan.days.find((item) => item.date === iso)
    return day ? day.weekNum : 1
  },
  onCreate() {
    wx.navigateTo({ url: '/pages/wizard/wizard' })
  }
})

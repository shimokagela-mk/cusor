const { formatDate, parseDate, addDays, startOfWeek, weekdayLabel } = require('../../utils/date')
const { evaluateDay, emptyLog, swapWorkoutLogs } = require('../../services/logs')
const { swapWorkouts } = require('../../services/plan-engine')

Page({
  data: { ready: false, hasPlan: false, label: '', days: [] },
  onShow() {
    if (!this.anchor) this.anchor = formatDate(new Date())
    this.reload()
  },
  reload() {
    const plan = getApp().store.getPlan()
    if (!plan) {
      this.setData({ ready: true, hasPlan: false, days: [] })
      return
    }
    const start = startOfWeek(parseDate(this.anchor))
    const today = formatDate(new Date())
    const logs = getApp().store.getAllLogs()
    const days = []
    for (let i = 0; i < 7; i += 1) {
      const date = formatDate(addDays(start, i))
      const day = plan.days.find((item) => item.date === date)
      const check = day ? evaluateDay(day, logs[date] || emptyLog(date)) : null
      let status = '不在周期'
      if (day && date > today) status = '未到'
      else if (day && check.complete) status = '已打卡'
      else if (day && date < today) status = '未完成'
      else if (day) status = '进行中'
      days.push({
        date,
        label: `${date.slice(5)} ${weekdayLabel(addDays(start, i).getDay())}`,
        title: day ? (day.isTrainingDay && day.workout ? day.workout.title : '休息') : '不在周期内',
        kcal: day ? day.targets.kcal : '',
        status,
        inPlan: !!day
      })
    }
    this.setData({
      ready: true,
      hasPlan: true,
      label: `${formatDate(start).slice(5)} - ${formatDate(addDays(start, 6)).slice(5)}`,
      days
    })
  },
  onPrev() {
    this.anchor = formatDate(addDays(parseDate(this.anchor), -7))
    this.reload()
  },
  onNext() {
    this.anchor = formatDate(addDays(parseDate(this.anchor), 7))
    this.reload()
  },
  onOpen(e) {
    wx.navigateTo({ url: `/pages/day-view/day-view?date=${e.currentTarget.dataset.date}` })
  },
  onSwap(e) {
    const date = e.currentTarget.dataset.date
    const others = this.data.days.filter((day) => day.inPlan && day.date !== date)
    if (!others.length) return
    wx.showActionSheet({
      itemList: others.map((day) => `${day.label} · ${day.title}`),
      success: (res) => {
        const target = others[res.tapIndex]
        const store = getApp().store
        store.savePlan(swapWorkouts(store.getPlan(), date, target.date))
        const [a, b] = swapWorkoutLogs(store.getLog(date), store.getLog(target.date), date, target.date)
        store.saveLog(a)
        store.saveLog(b)
        wx.showToast({ title: '已调换，后续日期不顺延', icon: 'none' })
        this.reload()
      }
    })
  },
  onCreate() {
    wx.navigateTo({ url: '/pages/wizard/wizard' })
  }
})

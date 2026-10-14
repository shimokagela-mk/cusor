const { hydrateWorkout, saveWorkoutState, emptyLog, lastWeight } = require('../../services/logs')

Page({
  data: { ready: false, workout: null, restLeft: 0, canLog: true },
  timer: null,
  onLoad(query) {
    this.date = query.date
  },
  onShow() {
    const plan = getApp().store.getPlan()
    const day = plan && plan.days.find((item) => item.date === this.date)
    const today = new Date()
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const log = getApp().store.getLog(this.date) || emptyLog(this.date)
    const workout = hydrateWorkout(day, log)
    const logs = getApp().store.getAllLogs()
    if (workout) {
      workout.exercises = workout.exercises.map((exercise) => ({
        ...exercise,
        last: lastWeight(logs, exercise.exerciseId)
      }))
    }
    this.setData({ ready: true, workout, canLog: this.date <= iso, title: day && day.workout ? day.workout.title : '训练' })
    if (day && day.workout) wx.setNavigationBarTitle({ title: day.workout.title })
  },
  persist(workout) {
    const store = getApp().store
    const log = store.getLog(this.date) || emptyLog(this.date)
    store.saveLog(saveWorkoutState(log, workout))
    this.setData({ workout })
  },
  onField(e) {
    if (!this.data.canLog) return
    const { index, setIndex, field } = e.currentTarget.dataset
    const workout = this.data.workout
    workout.exercises[index].loggedSets[setIndex][field] = e.detail.value
    this.persist(workout)
  },
  onToggle(e) {
    if (!this.data.canLog) return
    const { index, setIndex } = e.currentTarget.dataset
    const workout = this.data.workout
    const set = workout.exercises[index].loggedSets[setIndex]
    set.completed = !set.completed
    this.persist(workout)
    if (set.completed) this.startRest(workout.exercises[index].restSec)
  },
  onManual() {
    if (!this.data.canLog) return
    const workout = this.data.workout
    workout.completedManual = true
    workout.exercises.forEach((exercise) => {
      exercise.loggedSets.forEach((set) => { set.completed = true })
    })
    this.persist(workout)
  },
  startRest(seconds) {
    if (!seconds) return
    this.clearTimer()
    this.setData({ restLeft: seconds })
    this.timer = setInterval(() => {
      if (this.data.restLeft <= 1) {
        this.clearTimer()
        this.setData({ restLeft: 0 })
        wx.vibrateShort({ type: 'light' })
      } else {
        this.setData({ restLeft: this.data.restLeft - 1 })
      }
    }, 1000)
  },
  clearTimer() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  },
  onUnload() {
    this.clearTimer()
  },
  onLibrary() {
    wx.navigateTo({ url: '/pages/library/library' })
  }
})

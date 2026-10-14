Page({
  data: { ready: false, nickname: '', users: [], bars: [], nicknameDraft: '' },
  onShow() {
    const store = getApp().store
    const user = store.ensureUser()
    const logs = store.getAllLogs()
    const points = Object.keys(logs)
      .filter((date) => logs[date].weightKg)
      .sort()
      .slice(-12)
      .map((date) => ({ date: date.slice(5), weight: logs[date].weightKg }))
    const max = points.reduce((m, item) => Math.max(m, item.weight), 0)
    const min = points.reduce((m, item) => Math.min(m, item.weight), max || 0)
    const span = Math.max(1, max - min)
    this.setData({
      ready: true,
      nickname: user.nickname,
      nicknameDraft: user.nickname,
      users: store.listUsers().map((item) => ({ ...item, current: item.id === user.id })),
      bars: points.map((item) => ({ ...item, height: Math.max(12, Math.round(((item.weight - min) / span) * 100)) }))
    })
  },
  onNick(e) {
    this.setData({ nicknameDraft: e.detail.value })
  },
  onSaveNick() {
    const name = (this.data.nicknameDraft || '').trim() || '我'
    getApp().store.renameUser(name)
    this.onShow()
  },
  onSwitch(e) {
    getApp().store.switchUser(e.currentTarget.dataset.id)
    this.onShow()
  },
  onCreateUser() {
    const name = (this.data.nicknameDraft || '').trim() || '新用户'
    const user = getApp().store.createUser(name)
    getApp().store.switchUser(user.id)
    this.onShow()
  },
  onLibrary() {
    wx.navigateTo({ url: '/pages/library/library' })
  },
  onPlan() {
    wx.navigateTo({ url: '/pages/wizard/wizard' })
  }
})

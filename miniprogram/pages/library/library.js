const { listExercises } = require('../../services/library')

Page({
  data: { query: '', onlyDoable: false, items: [] },
  onShow() {
    this.reload()
  },
  reload() {
    const plan = getApp().store.getPlan()
    const profile = plan && plan.profile
    this.setData({
      items: listExercises({
        query: this.data.query,
        onlyDoable: this.data.onlyDoable,
        equipment: profile ? profile.equipment : [],
        injuries: profile ? profile.injuries : []
      })
    })
  },
  onQuery(e) {
    this.setData({ query: e.detail.value })
    this.reload()
  },
  onToggle() {
    this.setData({ onlyDoable: !this.data.onlyDoable })
    this.reload()
  }
})

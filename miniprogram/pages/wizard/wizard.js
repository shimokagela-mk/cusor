const { formatDate } = require('../../utils/date')
const { generatePlan } = require('../../services/plan-engine')

const WEEKDAYS = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 0, label: '周日' }
]

Page({
  data: {
    step: 0,
    error: '',
    weekdays: WEEKDAYS,
    injuries: [
      { id: 'knee', label: '膝盖' },
      { id: 'lower_back', label: '腰' },
      { id: 'shoulder', label: '肩' },
      { id: 'wrist', label: '手腕' }
    ],
    restrictions: [
      { id: 'vegetarian', label: '素食' },
      { id: 'seafood', label: '不吃海鲜' },
      { id: 'pork', label: '不吃猪肉' },
      { id: 'beef', label: '不吃牛肉' },
      { id: 'lactose', label: '乳糖不耐' },
      { id: 'spicy', label: '不吃辣' }
    ],
    equipments: [
      { id: 'dumbbell', label: '哑铃' },
      { id: 'band', label: '弹力带' },
      { id: 'pullup', label: '引体向上杆' }
    ],
    form: {
      goalType: 'cut',
      gender: 'female',
      age: '',
      heightCm: '',
      weightKg: '',
      bodyFatPct: '',
      targetWeightKg: '',
      targetBodyFatPct: '',
      weeks: '12',
      trainingWeekdays: [1, 3, 5],
      experience: 'beginner',
      venue: 'gym',
      equipment: [],
      injuries: [],
      dietRestrictions: []
    }
  },
  onPick(e) {
    const { field, value } = e.currentTarget.dataset
    this.setData({ [`form.${field}`]: value, error: '' })
  },
  onInput(e) {
    this.setData({ [`form.${e.currentTarget.dataset.field}`]: e.detail.value, error: '' })
  },
  onToggle(e) {
    const field = e.currentTarget.dataset.field
    const value = field === 'trainingWeekdays' ? Number(e.currentTarget.dataset.value) : e.currentTarget.dataset.value
    const list = this.data.form[field].slice()
    const index = list.indexOf(value)
    if (index >= 0) list.splice(index, 1)
    else list.push(value)
    this.setData({ [`form.${field}`]: list, error: '' })
  },
  onNext() {
    const error = this.validate()
    if (error) {
      this.setData({ error })
      return
    }
    if (this.data.step < 4) {
      this.setData({ step: this.data.step + 1, error: '' })
      return
    }
    try {
      const plan = generatePlan(this.data.form, formatDate(new Date()))
      plan.createdAt = new Date().toISOString()
      getApp().store.savePlan(plan)
      wx.switchTab({ url: '/pages/plan/plan' })
    } catch (err) {
      this.setData({ error: err.message })
    }
  },
  onBack() {
    if (this.data.step === 0) {
      wx.navigateBack({ delta: 1 })
      return
    }
    this.setData({ step: this.data.step - 1, error: '' })
  },
  validate() {
    const form = this.data.form
    if (this.data.step === 0 && !form.goalType) return '请选择目标'
    if (this.data.step === 1) {
      if (!(Number(form.age) >= 16)) return '请填写年龄'
      if (!(Number(form.heightCm) >= 120)) return '请填写身高'
      if (!(Number(form.weightKg) >= 30)) return '请填写体重'
    }
    if (this.data.step === 2) {
      if (!form.targetWeightKg && !form.targetBodyFatPct) return '请填写目标体重或目标体脂'
      if (!(Number(form.weeks) >= 4)) return '周期至少 4 周'
    }
    if (this.data.step === 3 && !form.trainingWeekdays.length) return '请至少选择一天训练'
    return ''
  }
})

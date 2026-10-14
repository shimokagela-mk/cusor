const config = require('../../config')
const { recognizeFood } = require('../../services/recognizer')
const { entryFromFood } = require('../../services/nutrition')
const { appendMeal, emptyLog } = require('../../services/logs')
const { FOODS } = require('../../data/foods')

Page({
  data: { photo: '', hint: '', message: '', items: [], grams: 200, pickedId: '' },
  onLoad(query) {
    this.date = query.date
    this.meal = query.meal
    const local = recognizeFood({ hint: '', mealType: this.meal })
    this.setData({ message: local.message, items: local.items })
  },
  onChoose() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        this.setData({ photo: res.tempFilePaths[0] })
      }
    })
  },
  onHint(e) {
    this.setData({ hint: e.detail.value })
  },
  onGrams(e) {
    this.setData({ grams: Number(e.detail.value) })
  },
  applyResult(result) {
    this.setData({
      message: result.message,
      items: result.items,
      pickedId: result.confident && result.items[0] ? result.items[0].id : ''
    })
  },
  onMatch() {
    if (config.recognizeUrl && this.data.photo) {
      wx.getFileSystemManager().readFile({
        filePath: this.data.photo,
        encoding: 'base64',
        success: (file) => {
          wx.request({
            url: config.recognizeUrl,
            method: 'POST',
            data: { imageBase64: file.data, hint: this.data.hint, mealType: this.meal },
            success: (res) => {
              if (res.data && res.data.items) this.applyResult(res.data)
              else this.applyResult(recognizeFood({ hint: this.data.hint, mealType: this.meal }))
            },
            fail: () => this.applyResult(recognizeFood({ hint: this.data.hint, mealType: this.meal }))
          })
        }
      })
      return
    }
    this.applyResult(recognizeFood({ hint: this.data.hint, mealType: this.meal }))
  },
  onPick(e) {
    this.setData({ pickedId: e.currentTarget.dataset.id })
  },
  onSave() {
    const food = FOODS.find((item) => item.id === this.data.pickedId)
    if (!food) {
      wx.showToast({ title: '请先点选一个食物', icon: 'none' })
      return
    }
    const entry = entryFromFood(food, this.data.grams || food.defaultGrams, 'photo')
    entry.photo = this.data.photo
    const store = getApp().store
    const log = store.getLog(this.date) || emptyLog(this.date)
    store.saveLog(appendMeal(log, this.meal, entry))
    store.pushRecent(entry)
    wx.navigateBack()
  }
})

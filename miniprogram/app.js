const { createStore, createWxStorage } = require('./services/store')

App({
  onLaunch() {
    this.store = createStore(createWxStorage())
    this.store.ensureUser()
  }
})

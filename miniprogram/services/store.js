const { clone, uid } = require('../utils/clone')

const KEY_USERS = 'fitplan:v1:users'
const KEY_CURRENT = 'fitplan:v1:current'

function userKey(id) {
  return `fitplan:v1:user:${id}`
}

function blankState() {
  return { plan: null, logs: {}, recentFoods: [] }
}

function createStore(storage) {
  function readUsers() {
    return storage.get(KEY_USERS) || []
  }
  function writeUsers(users) {
    storage.set(KEY_USERS, users)
  }
  function readState(id) {
    return storage.get(userKey(id)) || blankState()
  }
  function writeState(id, state) {
    storage.set(userKey(id), state)
  }
  function currentId() {
    return storage.get(KEY_CURRENT)
  }

  return {
    ensureUser() {
      const users = readUsers()
      let id = currentId()
      if (!id || !users.some((user) => user.id === id)) {
        const user = { id: uid('user'), nickname: '我', createdAt: Date.now() }
        writeUsers(users.concat(user))
        storage.set(KEY_CURRENT, user.id)
        writeState(user.id, blankState())
        return user
      }
      return users.find((user) => user.id === id)
    },
    getCurrentUser() {
      const id = currentId()
      return readUsers().find((user) => user.id === id) || null
    },
    listUsers() {
      return readUsers()
    },
    createUser(nickname) {
      const user = { id: uid('user'), nickname: nickname || '新用户', createdAt: Date.now() }
      writeUsers(readUsers().concat(user))
      writeState(user.id, blankState())
      return user
    },
    switchUser(id) {
      if (!readUsers().some((user) => user.id === id)) return null
      storage.set(KEY_CURRENT, id)
      return this.getCurrentUser()
    },
    renameUser(nickname) {
      const id = currentId()
      const users = readUsers().map((user) => (user.id === id ? { ...user, nickname } : user))
      writeUsers(users)
      return users.find((user) => user.id === id)
    },
    getPlan() {
      return readState(currentId()).plan
    },
    savePlan(plan) {
      const state = readState(currentId())
      state.plan = clone(plan)
      writeState(currentId(), state)
    },
    clearPlan() {
      const state = readState(currentId())
      state.plan = null
      writeState(currentId(), state)
    },
    getLog(date) {
      return readState(currentId()).logs[date] || null
    },
    saveLog(log) {
      const state = readState(currentId())
      state.logs[log.date] = clone(log)
      writeState(currentId(), state)
    },
    getAllLogs() {
      return readState(currentId()).logs || {}
    },
    getRecentFoods() {
      return readState(currentId()).recentFoods || []
    },
    pushRecent(entry) {
      const state = readState(currentId())
      const recent = (state.recentFoods || []).filter((item) => item.name !== entry.name)
      recent.unshift({
        foodId: entry.foodId,
        name: entry.name,
        grams: entry.grams,
        per100g: entry.per100g,
        unitHint: entry.unitHint || ''
      })
      state.recentFoods = recent.slice(0, 12)
      writeState(currentId(), state)
    }
  }
}

function createMemoryStorage() {
  const map = new Map()
  return {
    get(key) {
      if (!map.has(key)) return null
      return clone(map.get(key))
    },
    set(key, value) {
      map.set(key, clone(value))
    }
  }
}

function createWxStorage() {
  return {
    get(key) {
      try {
        const value = wx.getStorageSync(key)
        return value === '' || value == null ? null : value
      } catch (error) {
        return null
      }
    },
    set(key, value) {
      wx.setStorageSync(key, value)
    }
  }
}

module.exports = { createStore, createMemoryStorage, createWxStorage }

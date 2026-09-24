function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function uid(prefix) {
  return `${prefix || 'id'}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function round(value) {
  return Math.round(value)
}

function round1(value) {
  return Math.round(value * 10) / 10
}

module.exports = { clone, uid, round, round1 }

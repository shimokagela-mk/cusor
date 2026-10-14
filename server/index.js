const http = require('http')
const { recognizeFood } = require('../miniprogram/services/recognizer')

async function visionHint(imageBase64) {
  const url = process.env.FOOD_VISION_URL
  const key = process.env.FOOD_VISION_API_KEY
  if (!url || !key || !imageBase64) return ''
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.FOOD_VISION_MODEL || 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '识别图中的主要食物。只返回 JSON：{"name":"中文菜名","grams":估计克数}。不要其他文字。' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }]
    })
  })
  if (!response.ok) return ''
  const payload = await response.json()
  const text = payload.choices && payload.choices[0] && payload.choices[0].message && payload.choices[0].message.content
  if (!text) return ''
  try {
    const parsed = JSON.parse(text)
    return parsed.name || ''
  } catch (error) {
    return ''
  }
}

async function handleRecognize(body) {
  let hint = (body && body.hint) || ''
  if (!hint && body && body.imageBase64) hint = await visionHint(body.imageBase64)
  const result = recognizeFood({ hint, mealType: body && body.mealType })
  return { ok: true, hint, grams: body && body.grams ? body.grams : null, ...result }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 4 * 1024 * 1024) {
        reject(new Error('图片过大'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })
}

function createServer() {
  return http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method === 'POST' && req.url === '/api/food/recognize') {
      try {
        const body = await readBody(req)
        const result = await handleRecognize(body)
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(result))
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify({ ok: false, message: error.message || '识别失败' }))
      }
      return
    }
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: false, message: '未找到接口' }))
  })
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787)
  createServer().listen(port, () => {
    process.stdout.write(`food recognize server listening on ${port}\n`)
  })
}

module.exports = { handleRecognize, createServer, visionHint }

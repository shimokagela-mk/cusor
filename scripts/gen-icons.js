const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const CRC_TABLE = (() => {
  const table = []
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function createPNG(size, draw) {
  const pixels = Buffer.alloc(size * size * 4)
  draw(pixels, size)
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1)
    raw[row] = 0
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function set(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return
  const i = (y * size + x) * 4
  pixels[i] = color[0]
  pixels[i + 1] = color[1]
  pixels[i + 2] = color[2]
  pixels[i + 3] = color[3]
}

function disc(pixels, size, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) {
    for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(pixels, size, x, y, color)
    }
  }
}

function rect(pixels, size, x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) set(pixels, size, x, y, color)
  }
}

const MUTED = [122, 113, 106, 255]
const ON = [31, 122, 77, 255]

const drawers = {
  day: (pixels, size, color) => {
    disc(pixels, size, 40, 40, 22, color)
    disc(pixels, size, 40, 40, 10, [255, 252, 248, 255])
  },
  week: (pixels, size, color) => {
    ;[[22, 22], [44, 22], [22, 44], [44, 44]].forEach(([x, y]) => rect(pixels, size, x, y, x + 14, y + 14, color))
  },
  plan: (pixels, size, color) => {
    rect(pixels, size, 18, 22, 62, 30, color)
    rect(pixels, size, 18, 36, 50, 44, color)
    rect(pixels, size, 18, 50, 40, 58, color)
  },
  mine: (pixels, size, color) => {
    disc(pixels, size, 40, 26, 12, color)
    for (let y = 44; y <= 66; y += 1) {
      const reach = Math.round(18 * Math.sin(((y - 44) / 22) * Math.PI))
      rect(pixels, size, 40 - reach, y, 40 + reach, y, color)
    }
  }
}

const dir = path.join(__dirname, '../miniprogram/assets')
fs.mkdirSync(dir, { recursive: true })
Object.keys(drawers).forEach((name) => {
  fs.writeFileSync(path.join(dir, `tab-${name}.png`), createPNG(81, (pixels, size) => drawers[name](pixels, size, MUTED)))
  fs.writeFileSync(path.join(dir, `tab-${name}-on.png`), createPNG(81, (pixels, size) => drawers[name](pixels, size, ON)))
})

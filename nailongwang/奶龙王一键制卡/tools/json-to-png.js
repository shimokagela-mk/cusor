const fs = require('fs');
const path = require('path');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ROOT = path.resolve(__dirname, '..');
const CARD_METADATA_KEYS = new Set(['chara', 'ccv3', 'card', 'character']);

function printUsage() {
  console.log('用法: node tools/json-to-png.js <角色卡JSON路径> <封面PNG路径> [输出PNG路径]');
  console.log('示例: node tools/json-to-png.js output/latest/角色卡.json projects/角色卡/assets/cover.png projects/角色卡/release/角色卡.png');
  console.log('默认输出路径: output/latest/<角色卡名>.png');
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || '角色卡';
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`读取 JSON 失败: ${filePath}\n${error.message}`);
  }

  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`JSON 解析失败: ${filePath}\n${error.message}`);
  }
}

function readPng(filePath) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`读取 PNG 失败: ${filePath}\n${error.message}`);
  }

  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('输入封面不是有效 PNG 文件');
  }

  return buffer;
}

function inferOutputPath(card, jsonPath) {
  const dataRoot = card && card.data && typeof card.data === 'object' ? card.data : card;
  const cardName = dataRoot && dataRoot.name ? dataRoot.name : path.basename(jsonPath, path.extname(jsonPath));
  return path.join(ROOT, 'output', 'latest', `${sanitizeFileName(cardName)}.png`);
}

function parseChunks(buffer) {
  const chunks = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const crcEnd = dataEnd + 4;

    if (dataEnd > buffer.length || crcEnd > buffer.length) {
      throw new Error(`PNG chunk 长度异常: ${type}`);
    }

    chunks.push({
      type,
      data: Buffer.from(buffer.subarray(dataStart, dataEnd)),
      raw: Buffer.from(buffer.subarray(offset, crcEnd))
    });

    offset = crcEnd;
    if (type === 'IEND') break;
  }

  if (chunks.length === 0 || chunks[chunks.length - 1].type !== 'IEND') {
    throw new Error('PNG 缺少 IEND chunk');
  }

  return chunks;
}

function getTextKeyword(chunk) {
  if (!['tEXt', 'zTXt', 'iTXt'].includes(chunk.type)) {
    return null;
  }

  const separator = chunk.data.indexOf(0);
  if (separator <= 0) {
    return null;
  }

  return chunk.data.subarray(0, separator).toString('latin1').toLowerCase();
}

function isOldCardMetadataChunk(chunk) {
  const keyword = getTextKeyword(chunk);
  return keyword ? CARD_METADATA_KEYS.has(keyword) : false;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < table.length; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunkData = Buffer.isBuffer(data) ? data : Buffer.from(data || '');
  const output = Buffer.alloc(12 + chunkData.length);

  output.writeUInt32BE(chunkData.length, 0);
  typeBuffer.copy(output, 4);
  chunkData.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, chunkData])), 8 + chunkData.length);

  return output;
}

function createTextChunk(keyword, text) {
  return createChunk('tEXt', Buffer.concat([
    Buffer.from(keyword, 'latin1'),
    Buffer.from([0]),
    Buffer.from(text, 'latin1')
  ]));
}

function writePngWithCardMetadata(sourceBuffer, card, outputPath) {
  const chunks = parseChunks(sourceBuffer);
  const cardBase64 = Buffer.from(JSON.stringify(card), 'utf-8').toString('base64');
  const cardChunk = createTextChunk('chara', cardBase64);
  const outputParts = [PNG_SIGNATURE];
  let removedCount = 0;

  for (const chunk of chunks) {
    if (chunk.type === 'IEND') {
      outputParts.push(cardChunk, chunk.raw);
      continue;
    }

    if (isOldCardMetadataChunk(chunk)) {
      removedCount += 1;
      continue;
    }

    outputParts.push(chunk.raw);
  }

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, Buffer.concat(outputParts));
  return removedCount;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.length < 2) {
    printUsage();
    throw new Error('缺少角色卡 JSON 路径或封面 PNG 路径');
  }

  const jsonPath = path.resolve(process.cwd(), args[0]);
  const pngPath = path.resolve(process.cwd(), args[1]);
  const card = readJson(jsonPath);
  const png = readPng(pngPath);
  const outputPath = args[2]
    ? path.resolve(process.cwd(), args[2])
    : inferOutputPath(card, jsonPath);

  const removedCount = writePngWithCardMetadata(png, card, outputPath);
  const dataRoot = card && card.data && typeof card.data === 'object' ? card.data : card;

  console.log(`已封装 PNG 角色卡: ${dataRoot.name || path.basename(jsonPath)}`);
  console.log(`写入字段: chara`);
  console.log(`已删除旧角色卡元数据字段数: ${removedCount}`);
  console.log(`输出 PNG: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

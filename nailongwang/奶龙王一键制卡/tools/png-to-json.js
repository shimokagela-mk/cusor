const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ROOT = path.resolve(__dirname, '..');

function printUsage() {
  console.log('用法: node tools/png-to-json.js <角色卡PNG路径> [输出JSON路径]');
  console.log('示例: node tools/png-to-json.js 角色卡.png output/latest/角色卡.json');
  console.log('默认输出路径: output/latest/<PNG文件名>.json');
}

function sanitizeFileName(value) {
  const cleaned = String(value || '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || '角色卡';
}

function inferOutputPath(inputPath, card) {
  const dataRoot = card && card.data && typeof card.data === 'object' ? card.data : card;
  const cardName = dataRoot && dataRoot.name ? dataRoot.name : path.basename(inputPath, path.extname(inputPath));
  return path.join(ROOT, 'output', 'latest', `${sanitizeFileName(cardName)}.json`);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readPng(filePath) {
  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`读取 PNG 失败: ${filePath}\n${error.message}`);
  }

  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('输入文件不是有效 PNG 文件');
  }

  return buffer;
}

function parseTextChunk(data) {
  const separator = data.indexOf(0);
  if (separator <= 0) return null;

  return {
    keyword: data.subarray(0, separator).toString('latin1'),
    text: data.subarray(separator + 1).toString('latin1')
  };
}

function parseCompressedTextChunk(data) {
  const separator = data.indexOf(0);
  if (separator <= 0 || separator + 2 > data.length) return null;

  const compressionMethod = data[separator + 1];
  if (compressionMethod !== 0) return null;

  try {
    return {
      keyword: data.subarray(0, separator).toString('latin1'),
      text: zlib.inflateSync(data.subarray(separator + 2)).toString('latin1')
    };
  } catch (error) {
    throw new Error(`zTXt 解压失败: ${error.message}`);
  }
}

function parseInternationalTextChunk(data) {
  const keywordEnd = data.indexOf(0);
  if (keywordEnd <= 0 || keywordEnd + 2 >= data.length) return null;

  const keyword = data.subarray(0, keywordEnd).toString('latin1');
  const compressionFlag = data[keywordEnd + 1];
  const compressionMethod = data[keywordEnd + 2];
  let offset = keywordEnd + 3;

  const languageEnd = data.indexOf(0, offset);
  if (languageEnd < 0) return null;
  offset = languageEnd + 1;

  const translatedKeywordEnd = data.indexOf(0, offset);
  if (translatedKeywordEnd < 0) return null;
  offset = translatedKeywordEnd + 1;

  const textBuffer = data.subarray(offset);
  if (compressionFlag === 0) {
    return { keyword, text: textBuffer.toString('utf-8') };
  }

  if (compressionFlag === 1 && compressionMethod === 0) {
    try {
      return { keyword, text: zlib.inflateSync(textBuffer).toString('utf-8') };
    } catch (error) {
      throw new Error(`iTXt 解压失败: ${error.message}`);
    }
  }

  return null;
}

function extractPngTextChunks(buffer) {
  const chunks = [];
  let offset = PNG_SIGNATURE.length;

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;

    if (dataEnd > buffer.length || nextOffset > buffer.length) {
      throw new Error(`PNG chunk 长度异常: ${type}`);
    }

    const data = buffer.subarray(dataStart, dataEnd);
    let parsed = null;
    if (type === 'tEXt') parsed = parseTextChunk(data);
    else if (type === 'zTXt') parsed = parseCompressedTextChunk(data);
    else if (type === 'iTXt') parsed = parseInternationalTextChunk(data);

    if (parsed && parsed.keyword) chunks.push(parsed);
    offset = nextOffset;

    if (type === 'IEND') break;
  }

  return chunks;
}

function decodeMaybeBase64Json(text) {
  const value = String(text || '').trim();
  const candidates = [value];

  try {
    candidates.push(Buffer.from(value, 'base64').toString('utf-8'));
  } catch (_) {
    // Keep the raw candidate only.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.replace(/^\uFEFF/, ''));
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
      // Try the next representation.
    }
  }

  return null;
}

function extractCardJson(chunks) {
  const preferredKeys = ['chara', 'ccv3', 'card', 'character'];
  const ordered = [
    ...preferredKeys.flatMap((key) => chunks.filter((chunk) => chunk.keyword.toLowerCase() === key)),
    ...chunks.filter((chunk) => !preferredKeys.includes(chunk.keyword.toLowerCase()))
  ];

  for (const chunk of ordered) {
    const card = decodeMaybeBase64Json(chunk.text);
    if (card && (card.spec === 'chara_card_v3' || card.data || card.name)) {
      return { card, keyword: chunk.keyword };
    }
  }

  return null;
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const inputPath = path.resolve(process.cwd(), args[0]);
  const buffer = readPng(inputPath);
  const chunks = extractPngTextChunks(buffer);
  const result = extractCardJson(chunks);

  if (!result) {
    const keys = chunks.map((chunk) => chunk.keyword).join(', ') || '无文本字段';
    throw new Error(`未找到可解析的角色卡 JSON。PNG 文本字段: ${keys}`);
  }

  const outputPath = args[1]
    ? path.resolve(process.cwd(), args[1])
    : inferOutputPath(inputPath, result.card);

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, JSON.stringify(result.card, null, 2), 'utf-8');

  const dataRoot = result.card.data && typeof result.card.data === 'object' ? result.card.data : result.card;
  console.log(`已提取 PNG 角色卡: ${dataRoot.name || path.basename(inputPath)}`);
  console.log(`来源字段: ${result.keyword}`);
  console.log(`输出 JSON: ${outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}

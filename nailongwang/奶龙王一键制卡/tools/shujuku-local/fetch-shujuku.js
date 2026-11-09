'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REF = 'main';
const DEFAULT_CACHE_DIR = path.join(ROOT, 'output', 'cache', 'shujuku');
const FILES = [
  { name: 'bundle', remote: 'dist/index.bundle.js', local: 'index.bundle.js', required: true },
  { name: 'manifest', remote: 'dist/extension/manifest.json', local: 'manifest.json', required: false }
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeRef(ref) {
  return String(ref || DEFAULT_REF).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function encodeGitHubPath(filePath) {
  return String(filePath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function fetchText(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'nailongwang-shujuku-local-test',
        ...headers
      }
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchText(response.headers.location, headers).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`下载失败 ${response.statusCode}: ${url}`));
        return;
      }
      const chunks = [];
      response.setEncoding('utf8');
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(chunks.join('')));
    }).on('error', reject);
  });
}

async function fetchTextFromGitHubApiRaw(ref, remotePath) {
  const apiUrl = `https://api.github.com/repos/AlbusKen/shujuku/contents/${encodeGitHubPath(remotePath)}?ref=${encodeURIComponent(ref)}`;
  return fetchText(apiUrl, {
    Accept: 'application/vnd.github.raw'
  });
}

async function fetchTextFromGitHubContentsApi(ref, remotePath) {
  const apiUrl = `https://api.github.com/repos/AlbusKen/shujuku/contents/${encodeGitHubPath(remotePath)}?ref=${encodeURIComponent(ref)}`;
  const jsonText = await fetchText(apiUrl);
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`GitHub Contents API 返回的不是合法 JSON: ${apiUrl}\n${error.message}`);
  }

  if (!payload || payload.type !== 'file' || typeof payload.content !== 'string') {
    throw new Error(`GitHub Contents API 未返回文件内容: ${apiUrl}`);
  }

  const encoding = String(payload.encoding || '').toLowerCase();
  if (encoding !== 'base64') {
    throw new Error(`GitHub Contents API 返回了不支持的编码 ${payload.encoding || '(empty)'}: ${apiUrl}`);
  }

  return Buffer.from(payload.content.replace(/\s+/g, ''), 'base64').toString('utf8');
}

function fetchTextFromGitClone(ref, remotePath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shujuku-git-'));
  try {
    execFileSync('git', [
      'clone',
      '--depth', '1',
      '--branch', ref,
      'https://github.com/AlbusKen/shujuku.git',
      tempDir
    ], {
      stdio: 'pipe',
      timeout: 120000
    });

    const filePath = path.join(tempDir, remotePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`git clone 成功但仓库内缺少文件: ${remotePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function downloadFile(ref, file, targetPath) {
  const url = `https://raw.githubusercontent.com/AlbusKen/shujuku/${encodeURIComponent(ref)}/${file.remote}`;
  const attempts = [];
  let text;

  try {
    text = await fetchText(url);
    attempts.push({ source: 'raw.githubusercontent.com', url });
  } catch (rawError) {
    attempts.push({ source: 'raw.githubusercontent.com', url, error: rawError.message });
    try {
      text = await fetchTextFromGitHubApiRaw(ref, file.remote);
      attempts.push({ source: 'api.github.com raw media' });
    } catch (apiRawError) {
      attempts.push({ source: 'api.github.com raw media', error: apiRawError.message });
      try {
        text = await fetchTextFromGitHubContentsApi(ref, file.remote);
        attempts.push({ source: 'api.github.com contents' });
      } catch (apiError) {
        attempts.push({ source: 'api.github.com contents', error: apiError.message });
        try {
          text = fetchTextFromGitClone(ref, file.remote);
          attempts.push({ source: 'git clone' });
        } catch (gitError) {
          attempts.push({ source: 'git clone', error: gitError.message });
          throw new Error(`所有 GitHub 下载路径均失败: ${file.remote}\n${attempts.map((attempt) => `${attempt.source}: ${attempt.error || attempt.url || 'ok'}`).join('\n')}`);
        }
      }
    }
  }

  fs.writeFileSync(targetPath, text, 'utf8');
  return { url, bytes: Buffer.byteLength(text, 'utf8'), attempts };
}

async function loadShujukuBundle(options = {}) {
  const ref = options.ref || process.env.SHUJUKU_REF || DEFAULT_REF;
  const refresh = options.refresh || process.env.SHUJUKU_REFRESH === '1';
  const cacheRoot = options.cacheDir || process.env.SHUJUKU_CACHE_DIR || DEFAULT_CACHE_DIR;
  const cacheDir = path.resolve(ROOT, cacheRoot, sanitizeRef(ref));
  ensureDir(cacheDir);

  const manifest = {
    ref,
    cacheDir,
    fetchedAt: null,
    files: {}
  };

  for (const file of FILES) {
    const targetPath = path.join(cacheDir, file.local);
    if (refresh || !fs.existsSync(targetPath)) {
      try {
        const downloaded = await downloadFile(ref, file, targetPath);
        manifest.files[file.name] = { path: targetPath, ...downloaded, cached: false };
      } catch (error) {
        if (file.required) {
          throw new Error(`无法下载 shujuku ${file.remote}。可设置 SHUJUKU_REF 或检查网络。\n${error.message}`);
        }
        manifest.files[file.name] = { path: targetPath, error: error.message, cached: false };
      }
    } else {
      manifest.files[file.name] = {
        path: targetPath,
        bytes: fs.statSync(targetPath).size,
        cached: true
      };
    }
  }

  manifest.fetchedAt = new Date().toISOString();
  fs.writeFileSync(path.join(cacheDir, 'fetch-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return {
    ref,
    cacheDir,
    bundlePath: manifest.files.bundle.path,
    manifestPath: manifest.files.manifest && manifest.files.manifest.path,
    fetchManifest: manifest
  };
}

module.exports = {
  loadShujukuBundle,
  fetchText,
  fetchTextFromGitHubApiRaw,
  fetchTextFromGitHubContentsApi
};

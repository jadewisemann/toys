const express = require('express');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif'];

function isImageFile(filename) {
  return IMAGE_EXTENSIONS.includes(path.extname(filename).toLowerCase());
}

// macOS 폴더 선택 다이얼로그
app.get('/api/pick-folder', (req, res) => {
  exec(`osascript -e 'POSIX path of (choose folder)'`, { encoding: 'utf8' }, (err, stdout) => {
    if (err || !stdout || !stdout.trim()) {
      return res.status(400).json({ error: '취소됨' });
    }
    res.json({ folderPath: stdout.trim() });
  });
});

// 폴더 경로를 받아 이미지 파일 목록 반환
app.post('/api/open-folder', (req, res) => {
  const { folderPath } = req.body;
  if (!folderPath) return res.status(400).json({ error: '폴더 경로가 필요합니다.' });

  const absPath = path.resolve(folderPath);
  if (!fs.existsSync(absPath)) {
    return res.status(404).json({ error: '폴더를 찾을 수 없습니다: ' + absPath });
  }

  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    return res.status(400).json({ error: '경로가 디렉토리가 아닙니다.' });
  }

  try {
    const files = fs.readdirSync(absPath)
      .filter(isImageFile)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    res.json({ folderPath: absPath, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 이미지 파일 서빙
app.get('/api/image', (req, res) => {
  const imagePath = req.query.path;
  if (!imagePath) return res.status(400).send('path 파라미터가 필요합니다.');

  const absPath = path.resolve(imagePath);
  if (!fs.existsSync(absPath)) return res.status(404).send('파일을 찾을 수 없습니다.');

  res.sendFile(absPath);
});

// 이미지 메타데이터(크기) 반환
app.get('/api/image-meta', async (req, res) => {
  const imagePath = req.query.path;
  if (!imagePath) return res.status(400).json({ error: 'path 파라미터가 필요합니다.' });

  try {
    const absPath = path.resolve(imagePath);
    const meta = await sharp(absPath).metadata();
    res.json({ width: meta.width, height: meta.height });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단일 이미지 크롭 저장
app.post('/api/crop', async (req, res) => {
  const { imagePath, topPx, bottomPx, leftPx, rightPx, outputPath } = req.body;
  if (!imagePath) return res.status(400).json({ error: 'imagePath가 필요합니다.' });

  try {
    const absPath = path.resolve(imagePath);
    const meta = await sharp(absPath).metadata();
    const { width, height } = meta;

    const top    = Math.max(0, Math.round(topPx    || 0));
    const bottom = Math.max(0, Math.round(bottomPx || 0));
    const left   = Math.max(0, Math.round(leftPx   || 0));
    const right  = Math.max(0, Math.round(rightPx  || 0));
    const cropH  = height - top - bottom;
    const cropW  = width  - left - right;

    if (cropH <= 0 || cropW <= 0) {
      return res.status(400).json({ error: '크롭 후 이미지 크기가 0 이하입니다.' });
    }

    // outputPath 지정 시 사용, 없으면 소스 폴더/output/
    const outDir = outputPath
      ? path.resolve(outputPath)
      : path.join(path.dirname(absPath), 'output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const outFile = path.join(outDir, path.basename(absPath));
    await sharp(absPath)
      .extract({ left, top, width: cropW, height: cropH })
      .toFile(outFile);

    res.json({ success: true, outputPath: outFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전체 이미지 일괄 크롭 저장 (프로그레스 SSE 스트리밍)
app.post('/api/crop-all', async (req, res) => {
  const { folderPath, files, topPx, bottomPx, leftPx, rightPx, outputPath } = req.body;
  if (!folderPath || !files || !files.length) {
    return res.status(400).json({ error: 'folderPath와 files가 필요합니다.' });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  function send(data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const outDir = outputPath
    ? path.resolve(outputPath)
    : path.join(path.resolve(folderPath), 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const total   = files.length;
  let saved = 0;
  const errors  = [];

  for (let i = 0; i < total; i++) {
    const filename = files[i];
    const absPath  = path.join(path.resolve(folderPath), filename);
    try {
      const meta = await sharp(absPath).metadata();
      const { width, height } = meta;
      const top    = Math.max(0, Math.round(topPx    || 0));
      const bottom = Math.max(0, Math.round(bottomPx || 0));
      const left   = Math.max(0, Math.round(leftPx   || 0));
      const right  = Math.max(0, Math.round(rightPx  || 0));
      const cropH  = height - top - bottom;
      const cropW  = width  - left - right;

      if (cropH <= 0 || cropW <= 0) {
        errors.push({ filename, error: '크롭 후 크기가 0 이하' });
        send({ current: i + 1, total, filename, status: 'error' });
        continue;
      }

      const outFile = path.join(outDir, filename);
      await sharp(absPath)
        .extract({ left, top, width: cropW, height: cropH })
        .toFile(outFile);

      saved++;
      send({ current: i + 1, total, filename, status: 'ok' });
    } catch (err) {
      errors.push({ filename, error: err.message });
      send({ current: i + 1, total, filename, status: 'error', message: err.message });
    }
  }

  send({ done: true, saved, errors });
  res.end();
});

app.listen(PORT, () => {
  console.log(`✅ 서버 실행 중: http://localhost:${PORT}`);
});

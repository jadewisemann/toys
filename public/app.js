/* ═══════════════════════════════════════════
   캡처 이미지 커터 — app.js
   ═══════════════════════════════════════════ */

'use strict';

// ── DOM 참조 ──────────────────────────────────
const pickBtn       = document.getElementById('pick-btn');
const pickOutBtn    = document.getElementById('pick-out-btn');
const outputInput   = document.getElementById('output-input');
const folderInput   = document.getElementById('folder-input');
const loadBtn       = document.getElementById('load-btn');
const folderStatus  = document.getElementById('folder-status');
const fileListEl    = document.getElementById('file-list');
const previewImg    = document.getElementById('preview-img');
const previewWrapper= document.getElementById('preview-wrapper');
const previewCont   = document.getElementById('preview-container');
const overlayTop    = document.getElementById('overlay-top');
const overlayBottom = document.getElementById('overlay-bottom');
const overlayLeft   = document.getElementById('overlay-left');
const overlayRight  = document.getElementById('overlay-right');
const handleTop     = document.getElementById('handle-top');
const handleBottom  = document.getElementById('handle-bottom');
const handleLeft    = document.getElementById('handle-left');
const handleRight   = document.getElementById('handle-right');
const imageCounter  = document.getElementById('image-counter');
const prevBtn       = document.getElementById('prev-btn');
const nextBtn       = document.getElementById('next-btn');
const saveOneBtn    = document.getElementById('save-one-btn');
const saveAllBtn    = document.getElementById('save-all-btn');
const topPxInput    = document.getElementById('top-px');
const bottomPxInput = document.getElementById('bottom-px');
const leftPxInput   = document.getElementById('left-px');
const rightPxInput  = document.getElementById('right-px');
const lrSyncCheck   = document.getElementById('lr-sync');
const magnifier     = document.getElementById('magnifier');
const toast         = document.getElementById('toast');
const progressOverlay = document.getElementById('progress-overlay');
const progressBar   = document.getElementById('progress-bar');
const progressText  = document.getElementById('progress-text');
const progressFile  = document.getElementById('progress-file');

// ── 상태 ──────────────────────────────────────
const state = {
  folderPath: '',
  files: [],
  currentIndex: -1,
  imgNaturalW: 0,
  imgNaturalH: 0,
  topPx: 0,
  bottomPx: 0,
  leftPx: 0,
  rightPx: 0,
};

// ── 유틸 ──────────────────────────────────────
let toastTimer = null;
function showToast(msg, duration = 2500) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}
function setStatus(msg, type = '') {
  folderStatus.textContent = msg;
  folderStatus.className = 'status-msg ' + type;
}

// 실제 픽셀 → 화면 픽셀
function scaleY(realPx) {
  if (!state.imgNaturalH) return 0;
  return (realPx / state.imgNaturalH) * previewImg.clientHeight;
}
function scaleX(realPx) {
  if (!state.imgNaturalW) return 0;
  return (realPx / state.imgNaturalW) * previewImg.clientWidth;
}

// ── 폴더 선택 다이얼로그 ──────────────────────
pickBtn.addEventListener('click', async () => {
  pickBtn.disabled = true;
  pickBtn.textContent = '⏳ 선택 중…';
  try {
    const res = await fetch('/api/pick-folder');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    folderInput.value = data.folderPath;
    await loadFolder();
  } catch (err) {
    if (err.message !== '취소됨') setStatus('오류: ' + err.message, 'err');
  } finally {
    pickBtn.disabled = false;
    pickBtn.textContent = '📂 폴더 선택…';
  }
});

// 출력 폴더 선택 다이얼로그
pickOutBtn.addEventListener('click', async () => {
  pickOutBtn.disabled = true;
  pickOutBtn.textContent = '⏳ 선택 중…';
  try {
    const res = await fetch('/api/pick-folder');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    outputInput.value = data.folderPath;
  } catch (err) {
    if (err.message !== '취소됨') showToast('폴더 선택 오류: ' + err.message);
  } finally {
    pickOutBtn.disabled = false;
    pickOutBtn.textContent = '📂 출력 폴더 선택…';
  }
});

loadBtn.addEventListener('click', loadFolder);
folderInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadFolder(); });

async function loadFolder() {
  const fp = folderInput.value.trim();
  if (!fp) return;
  setStatus('폴더 탐색 중…');
  try {
    const res = await fetch('/api/open-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: fp }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.folderPath = data.folderPath;
    state.files = data.files;
    state.currentIndex = -1;
    setStatus(`${data.files.length}개 이미지 로드됨`, 'ok');
    renderFileList();
    if (data.files.length > 0) selectImage(0);
    else showToast('이미지 파일이 없습니다.');
  } catch (err) {
    setStatus('오류: ' + err.message, 'err');
  }
}

// ── 파일 목록 ─────────────────────────────────
function renderFileList() {
  fileListEl.innerHTML = '';
  state.files.forEach((name, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.textContent = name;
    item.title = name;
    item.addEventListener('click', () => selectImage(i));
    fileListEl.appendChild(item);
  });
}
function updateFileListActive() {
  [...fileListEl.querySelectorAll('.file-item')].forEach((el, i) => {
    el.classList.toggle('active', i === state.currentIndex);
  });
  fileListEl.querySelector('.file-item.active')?.scrollIntoView({ block: 'nearest' });
}

// ── 이미지 선택 ───────────────────────────────
async function selectImage(index) {
  if (index < 0 || index >= state.files.length) return;
  state.currentIndex = index;
  const filename = state.files[index];
  const imagePath = `${state.folderPath}/${filename}`;

  imageCounter.textContent = `${index + 1} / ${state.files.length}`;
  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === state.files.length - 1;
  saveOneBtn.disabled = false;
  saveAllBtn.disabled = false;
  updateFileListActive();

  previewImg.src = `/api/image?path=${encodeURIComponent(imagePath)}`;
  await new Promise(resolve => { previewImg.onload = resolve; previewImg.onerror = resolve; });

  state.imgNaturalW = previewImg.naturalWidth;
  state.imgNaturalH = previewImg.naturalHeight;
  applyPreviewMode();
  updateOverlays();
}

// ── 프리뷰 모드 ───────────────────────────────
document.querySelectorAll('input[name="preview-mode"]').forEach(r =>
  r.addEventListener('change', applyPreviewMode)
);
function applyPreviewMode() {
  const mode = document.querySelector('input[name="preview-mode"]:checked')?.value || 'fit-height';
  const wrapH = previewWrapper.clientHeight - 40;
  const wrapW = previewWrapper.clientWidth  - 40;
  switch (mode) {
    case 'fit-height':
      previewImg.style.height = wrapH + 'px'; previewImg.style.width = 'auto'; break;
    case 'fit-width':
      previewImg.style.width = wrapW + 'px';  previewImg.style.height = 'auto'; break;
    case 'actual':
      previewImg.style.width  = state.imgNaturalW + 'px';
      previewImg.style.height = state.imgNaturalH + 'px'; break;
  }
  updateOverlays();
}
window.addEventListener('resize', () => { applyPreviewMode(); updateOverlays(); });

// ── 오버레이 갱신 ─────────────────────────────
function updateOverlays() {
  const topH   = scaleY(state.topPx);
  const botH   = scaleY(state.bottomPx);
  const leftW  = scaleX(state.leftPx);
  const rightW = scaleX(state.rightPx);
  const imgH   = previewImg.clientHeight;
  const imgW   = previewImg.clientWidth;

  // 상하 오버레이
  overlayTop.style.height    = topH + 'px';
  overlayBottom.style.height = botH + 'px';
  handleTop.style.top        = (topH - 3) + 'px';
  handleBottom.style.top     = (imgH - botH - 3) + 'px';

  // 좌우 오버레이 (상하 크롭 영역 제외하여 겹침 방지)
  overlayLeft.style.width    = leftW + 'px';
  overlayLeft.style.top      = topH + 'px';
  overlayLeft.style.bottom   = botH + 'px';
  overlayRight.style.width   = rightW + 'px';
  overlayRight.style.top     = topH + 'px';
  overlayRight.style.bottom  = botH + 'px';

  // 좌우 핸들 (전체 높이, 상하 오버레이 위에 표시)
  handleLeft.style.left   = (leftW - 3) + 'px';
  handleLeft.style.top    = topH + 'px';
  handleLeft.style.bottom = botH + 'px';
  handleRight.style.left  = (imgW - rightW - 3) + 'px';
  handleRight.style.top   = topH + 'px';
  handleRight.style.bottom = botH + 'px';

  // 입력 필드 동기화
  topPxInput.value    = state.topPx;
  bottomPxInput.value = state.bottomPx;
  leftPxInput.value   = state.leftPx;
  rightPxInput.value  = state.rightPx;
}

// 입력 필드 → 상태
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

topPxInput.addEventListener('input', () => {
  state.topPx = clamp(parseInt(topPxInput.value) || 0, 0, state.imgNaturalH - state.bottomPx - 1);
  updateOverlays();
});
bottomPxInput.addEventListener('input', () => {
  state.bottomPx = clamp(parseInt(bottomPxInput.value) || 0, 0, state.imgNaturalH - state.topPx - 1);
  updateOverlays();
});
leftPxInput.addEventListener('input', () => {
  state.leftPx = clamp(parseInt(leftPxInput.value) || 0, 0, state.imgNaturalW - state.rightPx - 1);
  if (lrSyncCheck.checked) { state.rightPx = state.leftPx; }
  updateOverlays();
});
rightPxInput.addEventListener('input', () => {
  state.rightPx = clamp(parseInt(rightPxInput.value) || 0, 0, state.imgNaturalW - state.leftPx - 1);
  if (lrSyncCheck.checked) { state.leftPx = state.rightPx; }
  updateOverlays();
});

// ── 핸들 드래그 ───────────────────────────────
let dragging    = null;  // 'top' | 'bottom' | 'left' | 'right'
let dragStartPos = 0;    // clientY or clientX
let dragStartPx  = 0;

function onHandleDown(which, e) {
  if (!state.imgNaturalH) return;
  dragging    = which;
  dragStartPos = (which === 'left' || which === 'right') ? e.clientX : e.clientY;
  dragStartPx  = { top: state.topPx, bottom: state.bottomPx, left: state.leftPx, right: state.rightPx }[which];
  document.body.style.cursor = (which === 'left' || which === 'right') ? 'ew-resize' : 'ns-resize';
  e.preventDefault();
}

handleTop.addEventListener('mousedown',    e => onHandleDown('top', e));
handleBottom.addEventListener('mousedown', e => onHandleDown('bottom', e));
handleLeft.addEventListener('mousedown',   e => onHandleDown('left', e));
handleRight.addEventListener('mousedown',  e => onHandleDown('right', e));

document.addEventListener('mousemove', e => {
  if (!dragging) return;

  const isHoriz = dragging === 'left' || dragging === 'right';
  const imgH = previewImg.clientHeight;
  const imgW = previewImg.clientWidth;

  if (!isHoriz) {
    const delta   = e.clientY - dragStartPos;
    const realDelta = Math.round(delta * (state.imgNaturalH / imgH));
    if (dragging === 'top') {
      state.topPx = clamp(dragStartPx + realDelta, 0, state.imgNaturalH - state.bottomPx - 1);
    } else {
      state.bottomPx = clamp(dragStartPx - realDelta, 0, state.imgNaturalH - state.topPx - 1);
    }
  } else {
    const delta     = e.clientX - dragStartPos;
    const realDelta = Math.round(delta * (state.imgNaturalW / imgW));
    if (dragging === 'left') {
      state.leftPx = clamp(dragStartPx + realDelta, 0, state.imgNaturalW - state.rightPx - 1);
      if (lrSyncCheck.checked) state.rightPx = state.leftPx;
    } else {
      state.rightPx = clamp(dragStartPx - realDelta, 0, state.imgNaturalW - state.leftPx - 1);
      if (lrSyncCheck.checked) state.leftPx = state.rightPx;
    }
  }

  updateOverlays();
  showMagnifier(e);
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = null;
  document.body.style.cursor = '';
  hideMagnifier();
});

// ── 돋보기 ────────────────────────────────────
const MAG_SIZE     = 180;
const MAG_ZOOM     = 4;
const MAG_OFFSET_X = 20;
const magCtx = magnifier.getContext('2d');

function showMagnifier(e) {
  if (!previewImg.src || previewImg.naturalWidth === 0) return;
  const rect  = previewImg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (mx < 0 || my < 0 || mx > rect.width || my > rect.height) { hideMagnifier(); return; }

  const nx = (mx / rect.width)  * state.imgNaturalW;
  const ny = (my / rect.height) * state.imgNaturalH;
  const srcSize = MAG_SIZE / MAG_ZOOM;

  magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
  magCtx.save();
  magCtx.beginPath();
  magCtx.arc(MAG_SIZE / 2, MAG_SIZE / 2, MAG_SIZE / 2, 0, Math.PI * 2);
  magCtx.clip();
  magCtx.drawImage(previewImg, nx - srcSize / 2, ny - srcSize / 2, srcSize, srcSize, 0, 0, MAG_SIZE, MAG_SIZE);
  magCtx.restore();

  // 십자선
  magCtx.save();
  magCtx.strokeStyle = 'rgba(108,99,255,0.85)';
  magCtx.lineWidth = 1;
  magCtx.beginPath();
  magCtx.moveTo(MAG_SIZE/2, 0); magCtx.lineTo(MAG_SIZE/2, MAG_SIZE);
  magCtx.moveTo(0, MAG_SIZE/2); magCtx.lineTo(MAG_SIZE, MAG_SIZE/2);
  magCtx.stroke();
  magCtx.restore();

  // 좌표 텍스트
  const isHoriz = dragging === 'left' || dragging === 'right';
  magCtx.save();
  magCtx.fillStyle = 'rgba(0,0,0,0.55)';
  magCtx.fillRect(0, MAG_SIZE - 20, MAG_SIZE, 20);
  magCtx.fillStyle = '#fff';
  magCtx.font = '11px monospace';
  magCtx.textAlign = 'center';
  magCtx.fillText(isHoriz ? `x: ${Math.round(nx)}px` : `y: ${Math.round(ny)}px`, MAG_SIZE / 2, MAG_SIZE - 6);
  magCtx.restore();

  let posX = e.clientX + MAG_OFFSET_X;
  let posY = e.clientY - MAG_SIZE / 2;
  if (posX + MAG_SIZE > window.innerWidth)  posX = e.clientX - MAG_OFFSET_X - MAG_SIZE;
  if (posY < 0) posY = 0;
  if (posY + MAG_SIZE > window.innerHeight) posY = window.innerHeight - MAG_SIZE;

  magnifier.style.left    = posX + 'px';
  magnifier.style.top     = posY + 'px';
  magnifier.style.display = 'block';
}
function hideMagnifier() { magnifier.style.display = 'none'; }

// ── 이전/다음 ─────────────────────────────────
prevBtn.addEventListener('click', () => selectImage(state.currentIndex - 1));
nextBtn.addEventListener('click', () => selectImage(state.currentIndex + 1));
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevBtn.click();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown')  nextBtn.click();
});

// ── 저장 ──────────────────────────────────────
function cropParams() {
  return {
    topPx:    state.topPx,
    bottomPx: state.bottomPx,
    leftPx:   state.leftPx,
    rightPx:  state.rightPx,
    outputPath: outputInput.value.trim() || undefined,
  };
}

saveOneBtn.addEventListener('click', async () => {
  if (state.currentIndex < 0) return;
  const filename  = state.files[state.currentIndex];
  const imagePath = `${state.folderPath}/${filename}`;
  saveOneBtn.disabled = true;
  try {
    const res  = await fetch('/api/crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imagePath, ...cropParams() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast(`✅ 저장 완료: output/${filename}`);
  } catch (err) {
    showToast('❌ 오류: ' + err.message, 4000);
  } finally {
    saveOneBtn.disabled = false;
  }
});

saveAllBtn.addEventListener('click', async () => {
  if (!state.files.length) return;
  const p = cropParams();
  const destDesc = p.outputPath || `${state.folderPath}/output`;
  const confirmed = confirm(
    `${state.files.length}개 이미지를 모두 저장하시겠습니까?\n` +
    `위: ${p.topPx}px / 아래: ${p.bottomPx}px / 좌: ${p.leftPx}px / 우: ${p.rightPx}px\n` +
    `→ ${destDesc}`
  );
  if (!confirmed) return;

  saveAllBtn.disabled = true;

  // 프로그레스 오버레이 표시
  progressOverlay.classList.add('visible');
  progressBar.style.width = '0%';
  progressText.textContent = `0 / ${state.files.length}`;
  progressFile.textContent = '';

  try {
    const res = await fetch('/api/crop-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: state.folderPath, files: state.files, ...p }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalData = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 라인 파싱
      const lines = buffer.split('\n');
      buffer = lines.pop(); // 마지막 미완성 라인 보비

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const event = JSON.parse(line.slice(6));
        if (event.done) {
          finalData = event;
        } else {
          const pct = Math.round((event.current / event.total) * 100);
          progressBar.style.width = pct + '%';
          progressText.textContent = `${event.current} / ${event.total}`;
          progressFile.textContent = event.filename;
        }
      }
    }

    progressOverlay.classList.remove('visible');
    if (finalData) {
      let msg = `✅ ${finalData.saved}개 저장 완료`;
      if (finalData.errors?.length) msg += ` (실패 ${finalData.errors.length}개)`;
      showToast(msg, 4000);
    }
  } catch (err) {
    progressOverlay.classList.remove('visible');
    showToast('❌ 오류: ' + err.message, 4000);
  } finally {
    saveAllBtn.disabled = false;
  }
});

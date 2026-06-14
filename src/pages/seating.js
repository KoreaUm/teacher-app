(function () {
'use strict';

const SETTING_KEY = 'seating_data';
let rows = 5, cols = 6;
let assignments = []; // 길이 = rows*cols, 값 = studentId or null
let students = [];   // 우리 반 학생 목록
let selectedIdx = null; // 선택된 좌석 인덱스

// ── 초기화 ──────────────────────────────────────────────
async function render(c) {
  c.innerHTML = `
  <div class="page-wrap">
    <div class="page-header">
      <h1 class="page-header-title">🪑 자리 배치</h1>
      <div class="page-header-actions">
        <label style="font-size:13px;color:var(--text2)">행
          <input type="number" id="seat-rows" class="input" min="1" max="12" style="width:54px;margin:0 8px 0 4px">
        </label>
        <label style="font-size:13px;color:var(--text2)">열
          <input type="number" id="seat-cols" class="input" min="1" max="12" style="width:54px;margin:0 12px 0 4px">
        </label>
        <button class="btn btn-secondary" id="seat-resize">적용</button>
        <button class="btn btn-secondary" id="seat-random">🔀 랜덤 배치</button>
        <button class="btn btn-secondary" id="seat-reset">초기화</button>
        <button class="btn btn-primary" id="seat-img">📷 이미지 저장</button>
      </div>
    </div>
    <div id="seat-info" style="font-size:12px;color:var(--text3);margin-bottom:8px"></div>
    <div id="seat-wrap">
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-bottom:4px">↑ 교실 뒤쪽</div>
      <div id="seat-grid"></div>
      <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:4px">교사 시점 (칠판 쪽) ↓</div>
      <div id="seat-board">📋 칠판</div>
    </div>
  </div>`;
}

async function init() {
  // 우리 반 학생 로드
  const allStudents = await api.getStudents();
  const classYear   = await api.getSetting('class_year', '');
  const classNum    = await api.getSetting('class_num', '');
  const myClass     = (classYear && classNum) ? `${classYear}학년 ${classNum}반` : '';
  students = myClass
    ? allStudents.filter(s => !s.class_group || s.class_group === myClass)
    : allStudents;
  students.sort((a, b) => a.number - b.number);

  // 저장된 배치 불러오기
  try {
    const raw = await api.getSetting(SETTING_KEY, '');
    if (raw) {
      const d = JSON.parse(raw);
      rows = d.rows || 5;
      cols = d.cols || 6;
      assignments = d.assignments || [];
    }
  } catch (_) {}

  // 기본값
  if (!assignments.length) assignments = Array(rows * cols).fill(null);

  document.getElementById('seat-rows').value = rows;
  document.getElementById('seat-cols').value = cols;

  document.getElementById('seat-resize').onclick  = applySize;
  document.getElementById('seat-random').onclick  = randomize;
  document.getElementById('seat-reset').onclick   = resetSeats;
  document.getElementById('seat-img').onclick     = downloadImage;

  renderGrid();
  updateInfo();
}

// ── 크기 변경 ────────────────────────────────────────────
function applySize() {
  const newRows = Math.max(1, Math.min(12, parseInt(document.getElementById('seat-rows').value) || rows));
  const newCols = Math.max(1, Math.min(12, parseInt(document.getElementById('seat-cols').value) || cols));
  const newSize = newRows * newCols;
  const old = assignments.slice();
  assignments = Array(newSize).fill(null);
  for (let i = 0; i < Math.min(old.length, newSize); i++) assignments[i] = old[i];
  rows = newRows; cols = newCols;
  selectedIdx = null;
  renderGrid();
  updateInfo();
  save();
}

// ── 랜덤 배치 ────────────────────────────────────────────
function randomize() {
  const ids = students.map(s => s.id);
  // Fisher-Yates shuffle
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  assignments = Array(rows * cols).fill(null);
  ids.forEach((id, i) => { if (i < rows * cols) assignments[i] = id; });
  selectedIdx = null;
  renderGrid();
  updateInfo();
  save();
  toast('랜덤 배치 완료!', 'success');
}

// ── 초기화 ───────────────────────────────────────────────
function resetSeats() {
  if (!confirm('모든 자리 배치를 초기화하시겠습니까?')) return;
  assignments = Array(rows * cols).fill(null);
  selectedIdx = null;
  renderGrid();
  updateInfo();
  save();
}

// ── 교사 시점 표시 순서 (행 역순 + 열 역순 = 180° 회전) ──
function teacherViewOrder() {
  const order = [];
  for (let r = rows - 1; r >= 0; r--)
    for (let c = cols - 1; c >= 0; c--)
      order.push(r * cols + c);
  return order;
}

// ── 그리드 렌더 (교사 시점: 칠판 아래, 학생 위쪽부터) ───
function renderGrid() {
  const grid = document.getElementById('seat-grid');
  if (!grid) return;
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  for (const i of teacherViewOrder()) {
    const sid = assignments[i];
    const s   = sid ? studentMap[sid] : null;
    const div = document.createElement('div');
    div.className = 'seat-cell' + (selectedIdx === i ? ' selected' : '') + (s ? '' : ' empty');
    div.dataset.idx = i;
    div.innerHTML = s
      ? `<span class="seat-num">${s.number}번</span><span class="seat-name">${s.name}</span>`
      : `<span class="seat-empty">빈 자리</span>`;
    div.onclick = () => handleSeatClick(i);
    grid.appendChild(div);
  }
}

// ── 클릭: 선택 → 스왑 ────────────────────────────────────
function handleSeatClick(idx) {
  if (selectedIdx === null) {
    selectedIdx = idx;
  } else if (selectedIdx === idx) {
    selectedIdx = null;
  } else {
    // 스왑
    [assignments[selectedIdx], assignments[idx]] = [assignments[idx], assignments[selectedIdx]];
    selectedIdx = null;
    save();
  }
  renderGrid();
}

// ── 정보 표시 ────────────────────────────────────────────
function updateInfo() {
  const el = document.getElementById('seat-info');
  if (!el) return;
  const assigned = assignments.filter(Boolean).length;
  const total    = rows * cols;
  const unassigned = students.filter(s => !assignments.includes(s.id)).length;
  el.textContent = `총 ${total}자리 · 배치됨 ${assigned}명 · 미배치 ${unassigned}명 ${selectedIdx !== null ? '· 자리를 선택하면 스왑됩니다' : ''}`;
}

// ── 저장 ─────────────────────────────────────────────────
async function save() {
  await api.setSetting(SETTING_KEY, JSON.stringify({ rows, cols, assignments }));
}

// ── 이미지 저장 ──────────────────────────────────────────
async function downloadImage() {
  const classYear = await api.getSetting('class_year', '');
  const classNum  = await api.getSetting('class_num', '');
  const title     = (classYear && classNum) ? `${classYear}학년 ${classNum}반 자리 배치` : '자리 배치';

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]));
  const PAD  = 28, GAP = 10;
  const CW   = 90, CH = 54;   // 셀 크기
  const BOARD_H = 40, TITLE_H = 40;
  const W = PAD * 2 + cols * CW + (cols - 1) * GAP;
  // 위: 제목 / 중간: 학생 좌석 / 아래: 칠판 + 패딩
  const H = TITLE_H + GAP + rows * CH + (rows - 1) * GAP + GAP + BOARD_H + PAD;

  const canvas = document.createElement('canvas');
  const dpr    = 2; // 고해상도
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // 배경
  ctx.fillStyle = '#f8f9fa';
  ctx.fillRect(0, 0, W, H);

  // 제목
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 16px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 26);

  // 좌석 (교사 시점: 뒷줄 → 앞줄, 오른쪽→왼쪽)
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i   = r * cols + c;
      const sid = assignments[i];
      const s   = sid ? studentMap[sid] : null;
      // 화면상 위치: r=rows-1이 displayRow=0(맨 위), c=cols-1이 displayCol=0(맨 왼)
      const displayRow = (rows - 1 - r);
      const displayCol = (cols - 1 - c);
      const x   = PAD + displayCol * (CW + GAP);
      const y   = TITLE_H + GAP + displayRow * (CH + GAP);

      // 카드 배경
      ctx.fillStyle = s ? '#ffffff' : '#f0f0f0';
      roundRect(ctx, x, y, CW, CH, 6);

      // 카드 테두리
      ctx.strokeStyle = s ? '#4f80e1' : '#d0d0d0';
      ctx.lineWidth   = s ? 1.5 : 1;
      roundRectStroke(ctx, x, y, CW, CH, 6);

      if (s) {
        ctx.fillStyle = '#6b7280';
        ctx.font      = '11px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${s.number}번`, x + CW / 2, y + 18);
        ctx.fillStyle = '#111827';
        ctx.font      = 'bold 14px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.fillText(s.name, x + CW / 2, y + 36);
      } else {
        ctx.fillStyle = '#c0c0c0';
        ctx.font      = '12px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('빈 자리', x + CW / 2, y + CH / 2 + 4);
      }
    }
  }

  // 칠판 (이미지 맨 아래)
  const bx = PAD, bh = BOARD_H;
  const by = TITLE_H + GAP + rows * CH + (rows - 1) * GAP + GAP;
  const bw = W - PAD * 2;
  ctx.fillStyle = '#2d6a4f';
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📋 칠판', W / 2, by + bh / 2 + 5);

  // 다운로드
  const url = canvas.toDataURL('image/png');
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `자리배치_${title.replace(/\s/g, '_')}.png`;
  a.click();
  toast('이미지로 저장되었습니다!', 'success');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function roundRectStroke(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.stroke();
}

window.registerPage('seating', { render, init });
})();

(function () {
'use strict';

const DAYS = ['월', '화', '수', '목', '금'];
const MAX_PERIOD = 7;

let timetableData = {};
let selectedImage = null;
let autosaveTimer = null;

async function syncCloudIfPossible() {
  if (!window.syncCloudNow) return;
  try {
    await window.syncCloudNow();
  } catch (_) {}
}

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">시간표 관리</h1>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="tt-clear">초기화</button>
          <button class="btn btn-primary" id="tt-save">저장</button>
        </div>
      </div>

      <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
            <div style="font-size:13px;font-weight:700;color:var(--text)">AI 시간표 불러오기</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm" id="tt-image-pick">사진 선택</button>
              <button class="btn btn-secondary btn-sm" id="tt-ai-run">AI 분석 후 채우기</button>
            </div>
          </div>
          <input type="file" id="tt-image-input" accept="image/*" style="display:none">
          <div id="tt-image-name" style="font-size:12px;color:var(--text2)">시간표 사진을 선택하거나 아래에 메모를 붙여 넣어 주세요.</div>
          <textarea id="tt-ai-input" class="input" style="min-height:96px;resize:vertical" placeholder="사진이 없으면 텍스트로도 가능합니다. 예: 월 1 107음악 / 수 3 105음악"></textarea>
          <div id="tt-ai-status" style="font-size:12px;color:var(--text3)"></div>
        </div>

        <div style="overflow-x:auto">
          <table id="tt-table" style="width:100%;border-collapse:separate;border-spacing:4px">
            <thead>
              <tr>
                <th style="width:54px">교시</th>
                ${DAYS.map((day) => `<th style="min-width:160px">${day}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="tt-body"></tbody>
          </table>
        </div>

        <div style="font-size:12px;color:var(--text3)">장소는 따로 분리하지 않고, 사진에 보이는 셀 텍스트를 그대로 과목 칸에 저장합니다.</div>
      </div>
    </div>
  `;
}

async function init() {
  timetableData = {};
  selectedImage = null;

  const timetable = await api.getTimetable();
  for (const entry of timetable) {
    timetableData[`${entry.day_of_week}_${entry.period}`] = entry;
  }

  renderTable();
  bindEvents();
}

function bindEvents() {
  document.getElementById('tt-save').onclick = saveAll;
  document.getElementById('tt-clear').onclick = clearAll;
  document.getElementById('tt-ai-run').onclick = runTimetableAI;
  document.getElementById('tt-image-pick').onclick = () => document.getElementById('tt-image-input').click();
  document.getElementById('tt-image-input').onchange = onImageSelected;
  document.getElementById('tt-body')?.addEventListener('input', scheduleAutosave);
}

function renderTable() {
  const body = document.getElementById('tt-body');
  if (!body) return;

  body.innerHTML = Array.from({ length: MAX_PERIOD }, (_, index) => {
    const period = index + 1;
    return `
      <tr>
        <td style="text-align:center;font-weight:600;color:var(--text2)">${period}교시</td>
        ${DAYS.map((_, dayIndex) => {
          const cell = timetableData[`${dayIndex}_${period}`] || {};
          return `
            <td>
              <input
                class="input"
                id="ts-${dayIndex}-${period}"
                value="${escapeHtml(cell.subject || '')}"
                placeholder="과목"
                style="height:32px;font-size:12px;margin-bottom:4px"
              >
              <div style="font-size:11px;color:var(--primary);font-weight:600">내 수업</div>
            </td>
          `;
        }).join('')}
      </tr>
    `;
  }).join('');
}

async function clearAll() {
  if (!confirm('시간표를 초기화할까요?')) return;
  await api.replaceTimetable([]);
  timetableData = {};
  renderTable();
  setStatus('시간표를 초기화했습니다.', 'success');
}

async function saveAll() {
  await persistTimetable(readTableData());
  setStatus('시간표를 저장했습니다.', 'success');
}

function readTableData() {
  const next = [];
  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    for (let period = 1; period <= MAX_PERIOD; period += 1) {
      const subject = document.getElementById(`ts-${dayIndex}-${period}`).value.trim();
      if (!subject) continue;
      next.push({
        day_of_week: dayIndex,
        period,
        subject,
        room: '',
        is_my_class: true,
      });
    }
  }
  return next;
}

async function persistTimetable(cells, shouldRender = true) {
  await api.replaceTimetable(cells);
  const nextData = {};
  for (const cell of cells) {
    nextData[`${cell.day_of_week}_${cell.period}`] = cell;
  }
  timetableData = nextData;
  if (shouldRender) renderTable();
}

function scheduleAutosave() {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(async () => {
    autosaveTimer = null;
    await persistTimetable(readTableData(), false);
    setStatus('시간표를 자동 저장했습니다.', 'success');
  }, 500);
}

async function onImageSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) {
    selectedImage = null;
    updateImageLabel();
    return;
  }
  selectedImage = await fileToPayload(file);
  updateImageLabel();
  setStatus(`선택한 사진: ${file.name}`, 'default');
}

function updateImageLabel() {
  const label = document.getElementById('tt-image-name');
  if (!label) return;
  label.textContent = selectedImage
    ? `${selectedImage.name} 선택됨`
    : '시간표 사진을 선택하거나 아래에 메모를 붙여 넣어 주세요.';
}

async function runTimetableAI() {
  const apiKey = await api.getSetting('ai_api_key', '');
  if (!apiKey) {
    setStatus('설정에서 AI API 키를 먼저 입력해 주세요.', 'error');
    return;
  }

  const model = await api.getSetting('ai_model', 'claude-opus-4-5');
  const provider = await api.getSetting('ai_provider', 'claude');
  const text = document.getElementById('tt-ai-input').value.trim();
  const button = document.getElementById('tt-ai-run');

  if (!selectedImage && !text) {
    setStatus('시간표 사진을 선택하거나 텍스트를 입력해 주세요.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = '분석 중...';
  setStatus(selectedImage ? '시간표 사진을 분석하고 있습니다.' : '시간표 텍스트를 분석하고 있습니다.', 'default');

  let result;
  if (selectedImage) {
    result = await api.aiExtractTimetableImage(apiKey, model, provider, {
      mimeType: selectedImage.mimeType,
      data: selectedImage.data,
      name: selectedImage.name,
    });
  } else {
    result = await api.aiExtractTimetable(apiKey, model, provider, text);
  }

  button.disabled = false;
  button.textContent = 'AI 분석 후 채우기';

  if (result?.error) {
    setStatus(`오류: ${result.error}`, 'error');
    return;
  }

  const raw = result?.result || '';
  const parsed = parseTimetableAIResult(raw);
  if (!parsed.length) {
    const preview = raw ? `\nAI 응답: ${raw.slice(0, 160)}` : '';
    setStatus(`시간표를 읽지 못했습니다. 사진 상태를 확인하거나 텍스트로 다시 시도해 주세요.${preview}`, 'warning');
    return;
  }

  await persistTimetable(parsed);
  setStatus(`시간표 ${parsed.length}칸을 자동으로 채웠습니다. 필요한 칸은 아래에서 수정하세요.`, 'success');
}

function parseTimetableAIResult(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => Number.isInteger(item.day_of_week) && item.day_of_week >= 0 && item.day_of_week < 5)
      .filter((item) => Number.isInteger(item.period) && item.period >= 1 && item.period <= MAX_PERIOD)
      .map((item) => ({
        day_of_week: item.day_of_week,
        period: item.period,
        subject: String(item.subject || '').trim(),
        room: '',
        is_my_class: true,
      }))
      .filter((item) => item.subject);
  } catch (error) {
    return [];
  }
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',').pop() : '';
      resolve({
        name: file.name,
        mimeType: file.type || 'image/png',
        data: base64,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function setStatus(message, type) {
  const element = document.getElementById('tt-ai-status');
  if (!element) return;
  const colorMap = {
    default: 'var(--text3)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--danger)',
  };
  element.style.color = colorMap[type] || colorMap.default;
  element.textContent = message;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.registerPage('timetable', { render, init });
})();

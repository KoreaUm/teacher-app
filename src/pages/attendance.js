(function () {
'use strict';

let currentTab = 'daily';
let currentDate = today();
let students = [];

const CATEGORY_OPTIONS = ['출석', '출석인정', '미인정', '질병'];
const STATUS_OPTIONS = ['출석', '결석', '결과', '지각', '조퇴'];
const CATEGORY_COLORS = {
  출석: 'var(--success)',
  출석인정: 'var(--accent)',
  미인정: 'var(--danger)',
  질병: 'var(--warning)',
};
const STATUS_COLS = [
  { key: 'absent', label: '결석', status: '결석' },
  { key: 'result', label: '결과', status: '결과' },
  { key: 'late', label: '지각', status: '지각' },
  { key: 'early', label: '조퇴', status: '조퇴' },
];

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">출결 관리</h1>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="daily">일일 출결</button>
        <button class="tab-btn" data-tab="stats">월별 통계</button>
      </div>
      <div id="att-content"></div>
    </div>
  `;
}

async function init() {
  students = await api.getStudents();
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach((item) => item.classList.remove('active'));
      button.classList.add('active');
      currentTab = button.dataset.tab;
      renderTab();
    };
  });
  renderTab();
}

function renderTab() {
  const content = document.getElementById('att-content');
  if (!content) return;
  if (currentTab === 'daily') renderDaily(content);
  else renderStats(content);
}

async function renderDaily(container) {
  const attendance = await api.getAttendance(currentDate);
  const attendanceMap = Object.fromEntries(attendance.map((row) => [row.student_id, row]));

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <input type="date" class="input" id="att-date" value="${currentDate}" style="width:180px">
      <button class="btn btn-secondary btn-sm" id="att-all">전체 출석</button>
      <button class="btn btn-primary btn-sm" id="att-save">저장</button>
      <span id="att-saved-lbl" style="font-size:12px;color:var(--success);display:none">저장됨</span>
    </div>
    <div class="tbl-wrap">
      <table class="att-table" style="border-collapse:separate;border-spacing:0 4px">
        <thead>
          <tr>
            <th style="width:46px">번호</th>
            <th style="width:90px">이름</th>
            <th style="width:130px">범주</th>
            <th style="width:130px">상태</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody id="att-tbody"></tbody>
      </table>
    </div>
  `;

  buildDailyRows(students, attendanceMap);

  document.getElementById('att-date').onchange = async (event) => {
    currentDate = event.target.value;
    renderDaily(container);
  };

  document.getElementById('att-all').onclick = async () => {
    for (const student of students) {
      await api.setAttendance({
        student_id: student.id,
        date: currentDate,
        period: 0,
        category: '출석',
        status: '출석',
        reason: '',
      });
    }
    toast('전체 출석 처리 완료', 'success');
    renderDaily(container);
  };

  document.getElementById('att-save').onclick = async () => {
    await saveAll();
    const label = document.getElementById('att-saved-lbl');
    if (label) {
      label.style.display = '';
      setTimeout(() => {
        label.style.display = 'none';
      }, 2000);
    }
    toast('출결을 저장했습니다.', 'success');
  };
}

function buildDailyRows(studentList, attendanceMap) {
  const tbody = document.getElementById('att-tbody');
  if (!tbody) return;

  tbody.innerHTML = studentList.map((student) => {
    const row = attendanceMap[student.id] || {};
    const category = row.category || '출석';
    const status = row.status || '출석';
    return `
      <tr style="height:44px">
        <td style="text-align:center">${student.number}</td>
        <td style="font-weight:600">${escapeHtml(student.name)}</td>
        <td>
          <select class="input att-cat" data-id="${student.id}" style="height:36px;font-size:12px;border-color:${CATEGORY_COLORS[category] || 'var(--border)'}">
            ${CATEGORY_OPTIONS.map((option) => `<option value="${option}"${option === category ? ' selected' : ''}>${option}</option>`).join('')}
          </select>
        </td>
        <td>
          <select class="input att-stat" data-id="${student.id}" style="height:36px;font-size:12px">
            ${STATUS_OPTIONS.map((option) => `<option value="${option}"${option === status ? ' selected' : ''}>${option}</option>`).join('')}
          </select>
        </td>
        <td>
          <input class="input att-reason" data-id="${student.id}" style="height:36px;font-size:12px;width:100%" placeholder="사유 메모">
        </td>
      </tr>
    `;
  }).join('');

  studentList.forEach((student) => {
    const row = attendanceMap[student.id] || {};
    const input = tbody.querySelector(`.att-reason[data-id="${student.id}"]`);
    if (input) input.value = row.reason || '';
  });

  tbody.querySelectorAll('.att-cat').forEach((select) => {
    select.onchange = () => {
      const id = select.dataset.id;
      const statEl = tbody.querySelector(`.att-stat[data-id="${id}"]`);
      if (!statEl) return;
      if (select.value === '출석') statEl.value = '출석';
      else if (statEl.value === '출석') statEl.value = '결석';
      select.style.borderColor = CATEGORY_COLORS[select.value] || 'var(--border)';
      saveSingle(id, tbody);
    };
  });

  tbody.querySelectorAll('.att-stat').forEach((select) => {
    select.onchange = () => saveSingle(select.dataset.id, tbody);
  });

  tbody.querySelectorAll('.att-reason').forEach((input) => {
    let composing = false;
    let saveTimer = null;

    const queueSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!composing) saveSingle(input.dataset.id, tbody);
      }, 500);
    };

    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      queueSave();
    });
    input.addEventListener('input', queueSave);
    input.addEventListener('change', () => saveSingle(input.dataset.id, tbody));
    input.addEventListener('blur', () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveSingle(input.dataset.id, tbody);
    });
  });
}

async function saveSingle(studentId, tbody) {
  const catEl = tbody.querySelector(`.att-cat[data-id="${studentId}"]`);
  const statEl = tbody.querySelector(`.att-stat[data-id="${studentId}"]`);
  const reasonEl = tbody.querySelector(`.att-reason[data-id="${studentId}"]`);
  if (!catEl || !statEl || !reasonEl) return;

  await api.setAttendance({
    student_id: Number(studentId),
    date: currentDate,
    period: 0,
    category: catEl.value,
    status: statEl.value,
    reason: reasonEl.value.trim(),
  });
}

async function saveAll() {
  const tbody = document.getElementById('att-tbody');
  if (!tbody) return;
  if (document.activeElement && tbody.contains(document.activeElement)) {
    document.activeElement.blur();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const cats = tbody.querySelectorAll('.att-cat');
  for (const cat of cats) {
    await saveSingle(cat.dataset.id, tbody);
  }
}

async function renderStats(container) {
  const now = new Date();
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <input type="number" class="input" id="sy" value="${now.getFullYear()}" style="width:90px">년
      <select class="input" id="sm" style="width:80px">
        ${Array.from({ length: 12 }, (_, index) => `<option value="${index + 1}"${index + 1 === now.getMonth() + 1 ? ' selected' : ''}>${index + 1}월</option>`).join('')}
      </select>
      <button class="btn btn-primary btn-sm" id="sl">조회</button>
    </div>
    <div class="tbl-wrap">
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="width:46px">번호</th>
            <th style="width:90px">이름</th>
            ${STATUS_COLS.map((column) => `<th style="width:80px">${column.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="st-body"></tbody>
      </table>
    </div>
  `;

  async function load() {
    const year = Number(document.getElementById('sy').value);
    const month = Number(document.getElementById('sm').value);
    const stats = await api.getAttendanceStats(year, month);
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
    const records = await api.getAttendanceRange(start, end);
    const recordMap = {};

    records.forEach((record) => {
      if (!recordMap[record.student_id]) recordMap[record.student_id] = [];
      recordMap[record.student_id].push(record);
    });

    document.getElementById('st-body').innerHTML = stats.map((row) => {
      const cells = STATUS_COLS.map((column) => {
        const count = row[column.key] || 0;
        if (count === 0) {
          return `<td style="text-align:center"><span class="att-badge-num zero">0</span></td>`;
        }
        return `
          <td style="text-align:center">
            <button class="att-badge-num" data-sid="${row.student_id || row.id}" data-status="${column.status}" data-name="${escapeHtml(row.name)}" data-label="${column.label}" style="cursor:pointer">${count}</button>
          </td>
        `;
      }).join('');
      return `<tr><td style="text-align:center">${row.number}</td><td style="font-weight:600">${escapeHtml(row.name)}</td>${cells}</tr>`;
    }).join('');

    document.querySelectorAll('.att-badge-num[data-status]').forEach((button) => {
      button.onclick = () => {
        const sid = Number(button.dataset.sid);
        const status = button.dataset.status;
        const name = button.dataset.name;
        const label = button.dataset.label;
        const studentRecords = (recordMap[sid] || [])
          .filter((record) => record.status === status && record.category !== '출석')
          .sort((a, b) => a.date.localeCompare(b.date));

        const rows = studentRecords.length
          ? studentRecords.map((record, index) => `
              <tr style="border-bottom:1px solid var(--border);${index % 2 === 1 ? 'background:var(--bg2,#f8f9fa)' : ''}">
                <td style="padding:10px 12px;white-space:nowrap">${formatDate(record.date)}</td>
                <td style="padding:10px 12px">
                  <span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${CATEGORY_COLORS[record.category] || 'var(--border)'};color:#fff;font-size:12px;font-weight:600;white-space:nowrap">${record.category} ${record.status}</span>
                </td>
                <td style="padding:10px 12px;color:var(--text2);word-break:break-all">${escapeHtml(record.reason || '—')}</td>
              </tr>
            `).join('')
          : `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">기록 없음</td></tr>`;

        showModal(`
          <div class="modal-header">
            <h3 class="modal-title">${name} · ${label} 상세</h3>
            <button class="btn btn-secondary btn-sm" data-close>닫기</button>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed">
            <colgroup>
              <col style="width:110px">
              <col style="width:120px">
              <col>
            </colgroup>
            <thead>
              <tr style="background:var(--bg2,#f8f9fa);border-bottom:2px solid var(--border)">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text2);font-weight:600">날짜</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text2);font-weight:600">유형</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:var(--text2);font-weight:600">사유</th>
              </tr>
            </thead>
            <tbody style="font-size:13px">${rows}</tbody>
          </table>
        `);
      };
    });
  }

  document.getElementById('sl').onclick = load;
  await load();
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.registerPage('attendance', { render, init, refresh: init });
})();

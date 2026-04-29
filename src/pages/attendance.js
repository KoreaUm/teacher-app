(function () {
'use strict';

let currentTab = 'daily';
let currentDate = today();
let students = [];

// DB에는 '결과'로 저장, UI에는 '외출'로 표시
const STATUSES = [
  { val: '출석', label: '출석', color: '#22c55e' },
  { val: '지각', label: '지각', color: '#f59e0b' },
  { val: '조퇴', label: '조퇴', color: '#f97316' },
  { val: '결과', label: '외출', color: '#3b82f6' },
  { val: '결석', label: '결석', color: '#ef4444' },
];
const STATUS_MAP = Object.fromEntries(STATUSES.map((s) => [s.val, s]));

const CATEGORY_OPTIONS = ['출석인정', '미인정', '질병'];
const CATEGORY_COLORS = {
  출석: '#22c55e',
  출석인정: 'var(--accent)',
  미인정: '#ef4444',
  질병: '#f59e0b',
};

const STATUS_COLS = [
  { key: 'absent', label: '결석', status: '결석', color: '#ef4444' },
  { key: 'result', label: '외출', status: '결과', color: '#3b82f6' },
  { key: 'late',   label: '지각', status: '지각', color: '#f59e0b' },
  { key: 'early',  label: '조퇴', status: '조퇴', color: '#f97316' },
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

  // 상태 추적 맵
  const stateMap = {};
  students.forEach((s) => {
    const row = attendanceMap[s.id] || {};
    stateMap[s.id] = {
      status: row.status || '출석',
      category: row.category || '출석',
      reason: row.reason || '',
    };
  });

  function summaryHtml() {
    const counts = {};
    STATUSES.forEach((s) => { counts[s.val] = 0; });
    Object.values(stateMap).forEach((st) => {
      if (counts[st.status] !== undefined) counts[st.status]++;
    });
    return STATUSES.map((s) => `
      <div style="display:flex;align-items:center;gap:6px;background:${s.color}18;border:1px solid ${s.color}44;border-radius:20px;padding:4px 12px;font-size:12px">
        <span style="width:8px;height:8px;border-radius:50%;background:${s.color};flex-shrink:0"></span>
        <span style="color:var(--fg-2)">${s.label}</span>
        <strong id="sum-${s.val}" style="color:${s.color};min-width:14px;text-align:center">${counts[s.val]}</strong>
      </div>
    `).join('');
  }

  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap">
      <input type="date" class="input" id="att-date" value="${currentDate}" style="width:180px">
      <button class="btn btn-secondary btn-sm" id="att-all">전체 출석</button>
      <button class="btn btn-primary btn-sm" id="att-save">저장</button>
      <span id="att-saved-lbl" style="font-size:12px;color:var(--success);display:none">✓ 저장됨</span>
    </div>
    <div id="att-summary" style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">${summaryHtml()}</div>
    <div class="tbl-wrap">
      <table class="att-table" style="border-collapse:separate;border-spacing:0 3px">
        <thead>
          <tr>
            <th style="width:40px">번호</th>
            <th style="width:78px">이름</th>
            <th style="min-width:280px">출결 상태</th>
            <th style="width:110px">범주</th>
            <th>사유</th>
          </tr>
        </thead>
        <tbody id="att-tbody"></tbody>
      </table>
    </div>
  `;

  buildDailyRows(students, stateMap);

  function refreshSummary() {
    const counts = {};
    STATUSES.forEach((s) => { counts[s.val] = 0; });
    Object.values(stateMap).forEach((st) => {
      if (counts[st.status] !== undefined) counts[st.status]++;
    });
    STATUSES.forEach((s) => {
      const el = document.getElementById(`sum-${s.val}`);
      if (el) el.textContent = counts[s.val];
    });
  }

  // 상태 버튼 이벤트 위임
  const tbody = document.getElementById('att-tbody');
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('.att-status-btn');
    if (!btn) return;
    const id = btn.dataset.id;
    const val = btn.dataset.val;
    stateMap[id].status = val;
    if (val === '출석') stateMap[id].category = '출석';
    else if (stateMap[id].category === '출석') stateMap[id].category = '출석인정';

    // 버튼 스타일 업데이트
    tbody.querySelectorAll(`.att-status-btn[data-id="${id}"]`).forEach((b) => {
      const s = STATUS_MAP[b.dataset.val];
      const active = b.dataset.val === val;
      b.style.borderColor = active ? s.color : 'var(--border)';
      b.style.background = active ? s.color : 'transparent';
      b.style.color = active ? '#fff' : 'var(--fg-2)';
      b.style.fontWeight = active ? '600' : '400';
    });

    // 범주 select 표시/숨김
    const catEl = tbody.querySelector(`.att-cat[data-id="${id}"]`);
    if (catEl) {
      catEl.style.display = val !== '출석' ? '' : 'none';
      if (val !== '출석') catEl.value = stateMap[id].category;
    }

    refreshSummary();
    saveSingleFromState(id, stateMap[id]);
  });

  document.getElementById('att-date').onchange = async (event) => {
    currentDate = event.target.value;
    renderDaily(container);
  };

  document.getElementById('att-all').onclick = async () => {
    for (const student of students) {
      await api.setAttendance({ student_id: student.id, date: currentDate, period: 0, category: '출석', status: '출석', reason: '' });
    }
    toast('전체 출석 처리 완료', 'success');
    renderDaily(container);
  };

  document.getElementById('att-save').onclick = async () => {
    await saveAll(stateMap);
    const label = document.getElementById('att-saved-lbl');
    if (label) { label.style.display = ''; setTimeout(() => { label.style.display = 'none'; }, 2000); }
    toast('출결을 저장했습니다.', 'success');
  };
}

function buildDailyRows(studentList, stateMap) {
  const tbody = document.getElementById('att-tbody');
  if (!tbody) return;

  tbody.innerHTML = studentList.map((student) => {
    const st = stateMap[student.id];
    const statusBtns = STATUSES.map((s) => {
      const active = s.val === st.status;
      return `<button class="att-status-btn" data-id="${student.id}" data-val="${s.val}"
        style="padding:4px 9px;border-radius:16px;border:1.5px solid ${active ? s.color : 'var(--border)'};background:${active ? s.color : 'transparent'};color:${active ? '#fff' : 'var(--fg-2)'};font-size:12px;font-weight:${active ? '600' : '400'};cursor:pointer;transition:all 0.12s;white-space:nowrap"
      >${s.label}</button>`;
    }).join('');

    const catOpts = CATEGORY_OPTIONS.map((o) =>
      `<option value="${o}"${o === st.category ? ' selected' : ''}>${o}</option>`
    ).join('');

    return `
      <tr style="height:42px">
        <td style="text-align:center;font-size:13px">${student.number}</td>
        <td style="font-weight:600;font-size:13px">${escapeHtml(student.name)}</td>
        <td><div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap">${statusBtns}</div></td>
        <td>
          <select class="input att-cat" data-id="${student.id}"
            style="height:32px;font-size:12px;display:${st.status !== '출석' ? '' : 'none'};border-color:${CATEGORY_COLORS[st.category] || 'var(--border)'}">
            ${catOpts}
          </select>
        </td>
        <td>
          <input class="input att-reason" data-id="${student.id}"
            style="height:32px;font-size:12px;width:100%" placeholder="사유" value="${escapeHtml(st.reason)}">
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.att-cat').forEach((select) => {
    select.onchange = () => {
      stateMap[select.dataset.id].category = select.value;
      select.style.borderColor = CATEGORY_COLORS[select.value] || 'var(--border)';
      saveSingleFromState(select.dataset.id, stateMap[select.dataset.id]);
    };
  });

  tbody.querySelectorAll('.att-reason').forEach((input) => {
    let composing = false;
    let saveTimer = null;
    const queueSave = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (!composing) {
          stateMap[input.dataset.id].reason = input.value.trim();
          saveSingleFromState(input.dataset.id, stateMap[input.dataset.id]);
        }
      }, 500);
    };
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; queueSave(); });
    input.addEventListener('input', queueSave);
    input.addEventListener('blur', () => {
      if (saveTimer) clearTimeout(saveTimer);
      stateMap[input.dataset.id].reason = input.value.trim();
      saveSingleFromState(input.dataset.id, stateMap[input.dataset.id]);
    });
  });
}

async function saveSingleFromState(studentId, st) {
  await api.setAttendance({
    student_id: Number(studentId),
    date: currentDate,
    period: 0,
    category: st.status === '출석' ? '출석' : st.category,
    status: st.status,
    reason: st.reason,
  });
}

async function saveAll(stateMap) {
  const tbody = document.getElementById('att-tbody');
  if (tbody && document.activeElement && tbody.contains(document.activeElement)) {
    document.activeElement.blur();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  for (const [id, st] of Object.entries(stateMap)) {
    await saveSingleFromState(id, st);
  }
}

async function renderStats(container) {
  const now = new Date();
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
      <input type="number" class="input" id="sy" value="${now.getFullYear()}" style="width:90px">년
      <select class="input" id="sm" style="width:80px">
        ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === now.getMonth() + 1 ? ' selected' : ''}>${i + 1}월</option>`).join('')}
      </select>
      <button class="btn btn-primary btn-sm" id="sl">조회</button>
    </div>
    <div id="stats-summary" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap"></div>
    <div class="tbl-wrap">
      <table style="border-collapse:collapse;width:100%">
        <thead>
          <tr>
            <th style="width:46px">번호</th>
            <th style="width:90px">이름</th>
            ${STATUS_COLS.map((c) => `
              <th style="width:80px">
                <span style="display:inline-flex;align-items:center;gap:4px">
                  <span style="width:7px;height:7px;border-radius:50%;background:${c.color};display:inline-block"></span>
                  ${c.label}
                </span>
              </th>
            `).join('')}
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
    records.forEach((r) => {
      if (!recordMap[r.student_id]) recordMap[r.student_id] = [];
      recordMap[r.student_id].push(r);
    });

    // 전체 합계 카드
    const totals = {};
    STATUS_COLS.forEach((c) => { totals[c.key] = 0; });
    stats.forEach((row) => { STATUS_COLS.forEach((c) => { totals[c.key] += row[c.key] || 0; }); });

    document.getElementById('stats-summary').innerHTML = STATUS_COLS.map((c) => `
      <div style="background:${c.color}15;border:1.5px solid ${c.color}44;border-radius:12px;padding:10px 18px;text-align:center;min-width:72px">
        <div style="font-size:11px;color:var(--fg-2);margin-bottom:4px;font-weight:500">${c.label}</div>
        <div style="font-size:26px;font-weight:700;color:${c.color};line-height:1">${totals[c.key]}</div>
        <div style="font-size:10px;color:var(--fg-3);margin-top:3px">누계</div>
      </div>
    `).join('');

    document.getElementById('st-body').innerHTML = stats.map((row) => {
      const cells = STATUS_COLS.map((c) => {
        const count = row[c.key] || 0;
        if (count === 0) {
          return `<td style="text-align:center"><span style="font-size:13px;color:var(--fg-4,#ccc)">—</span></td>`;
        }
        return `
          <td style="text-align:center">
            <button class="att-badge-num" data-sid="${row.student_id || row.id}" data-status="${c.status}" data-name="${escapeHtml(row.name)}" data-label="${c.label}" data-color="${c.color}"
              style="cursor:pointer;background:${c.color}18;color:${c.color};border:1.5px solid ${c.color}55;border-radius:12px;padding:2px 10px;font-size:13px;font-weight:700;min-width:28px"
            >${count}</button>
          </td>
        `;
      }).join('');
      return `<tr>
        <td style="text-align:center">${row.number}</td>
        <td style="font-weight:600">${escapeHtml(row.name)}</td>
        ${cells}
      </tr>`;
    }).join('');

    document.querySelectorAll('.att-badge-num[data-status]').forEach((button) => {
      button.onclick = () => {
        const sid = Number(button.dataset.sid);
        const status = button.dataset.status;
        const name = button.dataset.name;
        const label = button.dataset.label;
        const color = button.dataset.color;
        const studentRecords = (recordMap[sid] || [])
          .filter((r) => r.status === status && r.category !== '출석')
          .sort((a, b) => a.date.localeCompare(b.date));

        const rows = studentRecords.length
          ? studentRecords.map((r, i) => `
              <tr style="border-bottom:1px solid var(--border);${i % 2 === 1 ? 'background:var(--bg2,#f8f9fa)' : ''}">
                <td style="padding:10px 12px;white-space:nowrap">${formatDate(r.date)}</td>
                <td style="padding:10px 12px">
                  <span style="display:inline-block;padding:3px 10px;border-radius:20px;background:${CATEGORY_COLORS[r.category] || color};color:#fff;font-size:12px;font-weight:600">${r.category} · ${label}</span>
                </td>
                <td style="padding:10px 12px;color:var(--text2);word-break:break-all">${escapeHtml(r.reason || '—')}</td>
              </tr>
            `).join('')
          : `<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:24px">기록 없음</td></tr>`;

        showModal(`
          <div class="modal-header">
            <h3 class="modal-title">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;vertical-align:middle"></span>
              ${name} · ${label} 내역
            </h3>
            <button class="btn btn-secondary btn-sm" data-close>닫기</button>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;table-layout:fixed">
            <colgroup><col style="width:110px"><col style="width:140px"><col></colgroup>
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

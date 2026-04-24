(function () {
let gradeColumns = [];
let gradeScores = {};
let students = [];

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap" style="max-width:none">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h1 class="page-header-title">성적관리</h1>
          <div class="settings-note" style="margin-top:4px">비밀코드로만 접근할 수 있는 페이지입니다.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="grades-export-btn">CSV 내보내기</button>
          <button class="btn btn-primary btn-sm" id="grades-add-column-btn">+ 시험 추가</button>
        </div>
      </div>

      <section class="card settings-card" style="padding:0;overflow:hidden">
        <div id="grades-table-wrap" style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 230px)"></div>
      </section>
    </div>
  `;
}

async function init() {
  try {
    [students, gradeColumns] = await Promise.all([
      api.getStudents(),
      api.getGradeColumns()
    ]);

    gradeScores = {};
    if (gradeColumns.length) {
      await Promise.all(gradeColumns.map(async (col) => {
        const scores = await api.getGradeScores(col.id);
        gradeScores[col.id] = {};
        scores.forEach(s => { gradeScores[col.id][s.student_id] = s.score; });
      }));
    }

    renderTable();

    document.getElementById('grades-add-column-btn')?.addEventListener('click', showAddColumnModal);
    document.getElementById('grades-export-btn')?.addEventListener('click', exportToCSV);
  } catch (err) {
    console.error('성적관리 초기화 실패', err);
    toast('성적 데이터를 불러오지 못했습니다.', 'error');
  }
}

function renderTable() {
  const wrap = document.getElementById('grades-table-wrap');
  if (!wrap) return;

  if (!students.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="icon">📝</div><p>학생 명단이 없습니다.<br>학생 명단 페이지에서 먼저 학생을 등록해 주세요.</p></div>`;
    return;
  }

  if (!gradeColumns.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:48px"><div class="icon">📊</div><p>성적 항목이 없습니다.<br>"시험 추가" 버튼을 눌러 과목·시험을 추가해 주세요.</p></div>`;
    return;
  }

  const STICKY_W1 = '44px';
  const STICKY_W2 = '80px';
  const thBase = 'padding:9px 10px;text-align:center;border-bottom:2px solid var(--border);border-right:1px solid var(--border);background:var(--card);white-space:nowrap';
  const tdFixed = 'padding:7px 10px;border-right:1px solid var(--border);background:var(--bg)';

  const studentRows = students.map(student => {
    const scores = gradeColumns.map(col => {
      const v = gradeScores[col.id]?.[student.id];
      return (v !== null && v !== undefined) ? v : null;
    });
    const valid = scores.filter(s => s !== null);
    const total = valid.reduce((a, b) => a + b, 0);
    const avg = valid.length ? total / valid.length : null;

    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="${tdFixed};text-align:center;color:var(--text2);position:sticky;left:0;z-index:1;min-width:${STICKY_W1}">${student.number}</td>
        <td style="${tdFixed};font-weight:500;position:sticky;left:${STICKY_W1};z-index:1;min-width:${STICKY_W2}">${escapeHtml(student.name)}</td>
        ${gradeColumns.map((col, ci) => `
          <td style="padding:4px 6px;text-align:center;border-right:1px solid var(--border)">
            <input type="number" class="grade-score-input"
              data-student-id="${student.id}" data-col-id="${col.id}"
              value="${scores[ci] !== null ? scores[ci] : ''}"
              min="0" max="${col.max_score || 100}" step="0.5"
              placeholder="-"
              style="width:72px;text-align:center;border:1px solid var(--border);border-radius:6px;padding:4px 6px;background:var(--input-bg,var(--bg));color:var(--text);font-size:13px;outline:none">
          </td>
        `).join('')}
        <td class="grade-total-cell" data-student-id="${student.id}" style="padding:7px 10px;text-align:center;border-right:1px solid var(--border);font-weight:600;color:var(--accent)">
          ${avg !== null ? total.toFixed(1) : '-'}
        </td>
        <td class="grade-avg-cell" data-student-id="${student.id}" style="padding:7px 10px;text-align:center;font-weight:600;color:var(--accent)">
          ${avg !== null ? avg.toFixed(1) : '-'}
        </td>
      </tr>`;
  }).join('');

  wrap.innerHTML = `
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead>
        <tr style="position:sticky;top:0;z-index:10">
          <th style="${thBase};position:sticky;left:0;z-index:11;min-width:${STICKY_W1}">번호</th>
          <th style="${thBase};text-align:left;position:sticky;left:${STICKY_W1};z-index:11;min-width:${STICKY_W2}">이름</th>
          ${gradeColumns.map(col => `
            <th style="${thBase};min-width:96px">
              <div style="font-weight:600;color:var(--text)">${escapeHtml(col.name)}</div>
              <div style="font-size:11px;color:var(--text3);font-weight:400;margin-top:2px">
                ${escapeHtml(col.subject || '')}${col.max_score ? ' / ' + col.max_score + '점' : ''}
              </div>
              <div style="display:flex;justify-content:center;gap:3px;margin-top:5px">
                <button class="grade-col-edit-btn btn btn-secondary" style="padding:1px 7px;font-size:10px;height:auto;line-height:1.6" data-col-id="${col.id}">수정</button>
                <button class="grade-col-delete-btn btn btn-danger" style="padding:1px 7px;font-size:10px;height:auto;line-height:1.6" data-col-id="${col.id}">삭제</button>
              </div>
            </th>
          `).join('')}
          <th style="${thBase};color:var(--accent);min-width:64px">합계</th>
          <th style="${thBase};color:var(--accent);border-right:none;min-width:64px">평균</th>
        </tr>
      </thead>
      <tbody>${studentRows}</tbody>
    </table>`;

  wrap.querySelectorAll('.grade-score-input').forEach(input => {
    input.addEventListener('change', handleScoreChange);
    input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
    input.addEventListener('blur', () => { input.style.borderColor = 'var(--border)'; });
  });

  wrap.querySelectorAll('.grade-col-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => showEditColumnModal(parseInt(btn.dataset.colId)));
  });

  wrap.querySelectorAll('.grade-col-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteColumn(parseInt(btn.dataset.colId)));
  });
}

async function handleScoreChange(event) {
  const input = event.target;
  const studentId = parseInt(input.dataset.studentId);
  const colId = parseInt(input.dataset.colId);
  const raw = input.value.trim();
  const score = raw === '' ? null : parseFloat(raw);

  try {
    await api.setGradeScore({ column_id: colId, student_id: studentId, score });
    if (!gradeScores[colId]) gradeScores[colId] = {};
    if (score === null) {
      delete gradeScores[colId][studentId];
    } else {
      gradeScores[colId][studentId] = score;
    }
    updateStudentTotals(studentId);
  } catch (err) {
    console.error('성적 저장 실패', err);
    toast('성적을 저장하지 못했습니다.', 'error');
  }
}

function updateStudentTotals(studentId) {
  const scores = gradeColumns.map(col => {
    const v = gradeScores[col.id]?.[studentId];
    return (v !== null && v !== undefined) ? v : null;
  });
  const valid = scores.filter(s => s !== null);
  const total = valid.reduce((a, b) => a + b, 0);
  const avg = valid.length ? total / valid.length : null;

  const totalEl = document.querySelector(`.grade-total-cell[data-student-id="${studentId}"]`);
  const avgEl = document.querySelector(`.grade-avg-cell[data-student-id="${studentId}"]`);
  if (totalEl) totalEl.textContent = avg !== null ? total.toFixed(1) : '-';
  if (avgEl) avgEl.textContent = avg !== null ? avg.toFixed(1) : '-';
}

function buildColumnModalBody(col) {
  const examTypes = ['중간', '기말', '수행', '기타'];
  return `
    <div class="form-row">
      <label>시험 이름 <span style="color:#d14343">*</span></label>
      <input class="input" id="gcol-name" placeholder="예: 1학기 중간고사" value="${escapeHtml(col?.name || '')}">
    </div>
    <div class="form-row">
      <label>과목</label>
      <input class="input" id="gcol-subject" placeholder="예: 국어 (선택)" value="${escapeHtml(col?.subject || '')}">
    </div>
    <div class="form-row">
      <label>시험 유형</label>
      <select class="input" id="gcol-type">
        ${examTypes.map(t => `<option value="${t}"${(col?.exam_type || '중간') === t ? ' selected' : ''}>${t}고사${t === '수행' || t === '기타' ? '' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <label>학기</label>
      <select class="input" id="gcol-semester">
        <option value="1"${(col?.semester || 1) === 1 ? ' selected' : ''}>1학기</option>
        <option value="2"${col?.semester === 2 ? ' selected' : ''}>2학기</option>
      </select>
    </div>
    <div class="form-row">
      <label>만점</label>
      <input class="input" id="gcol-max" type="number" min="1" value="${col?.max_score ?? 100}" placeholder="100">
    </div>
    <div class="form-row">
      <label>날짜</label>
      <input class="input" id="gcol-date" type="date" value="${col?.date || ''}">
    </div>`;
}

function collectColumnFields() {
  return {
    name: document.getElementById('gcol-name')?.value.trim() || '',
    subject: document.getElementById('gcol-subject')?.value.trim() || '',
    exam_type: document.getElementById('gcol-type')?.value || '중간',
    semester: parseInt(document.getElementById('gcol-semester')?.value) || 1,
    max_score: parseFloat(document.getElementById('gcol-max')?.value) || 100,
    date: document.getElementById('gcol-date')?.value || ''
  };
}

function showAddColumnModal() {
  showModal(`
    <div class="modal-header">
      <span class="modal-title">시험 추가</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      ${buildColumnModalBody(null)}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="gcol-save-btn">추가</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('gcol-name')?.focus();
    document.getElementById('gcol-save-btn')?.addEventListener('click', async () => {
      const data = collectColumnFields();
      if (!data.name) { toast('시험 이름을 입력해 주세요.', 'error'); return; }
      data.sort_order = gradeColumns.length;
      try {
        const id = await api.addGradeColumn(data);
        closeModal();
        gradeColumns.push(Object.assign({ id }, data));
        gradeScores[id] = {};
        renderTable();
        toast('시험을 추가했습니다.', 'success');
      } catch (err) {
        console.error(err);
        toast('시험을 추가하지 못했습니다.', 'error');
      }
    });
  }, 0);
}

function showEditColumnModal(colId) {
  const col = gradeColumns.find(c => c.id === colId);
  if (!col) return;

  showModal(`
    <div class="modal-header">
      <span class="modal-title">시험 수정</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      ${buildColumnModalBody(col)}
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="gcol-update-btn">저장</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('gcol-name')?.focus();
    document.getElementById('gcol-update-btn')?.addEventListener('click', async () => {
      const data = collectColumnFields();
      if (!data.name) { toast('시험 이름을 입력해 주세요.', 'error'); return; }
      data.sort_order = col.sort_order;
      try {
        await api.updateGradeColumn(colId, data);
        closeModal();
        Object.assign(col, data);
        renderTable();
        toast('시험 정보를 수정했습니다.', 'success');
      } catch (err) {
        console.error(err);
        toast('시험 정보를 수정하지 못했습니다.', 'error');
      }
    });
  }, 0);
}

async function deleteColumn(colId) {
  const col = gradeColumns.find(c => c.id === colId);
  if (!col) return;
  if (!confirm(`"${col.name}" 시험을 삭제할까요?\n모든 학생의 해당 성적도 함께 삭제됩니다.`)) return;
  try {
    await api.deleteGradeColumn(colId);
    gradeColumns = gradeColumns.filter(c => c.id !== colId);
    delete gradeScores[colId];
    renderTable();
    toast('시험을 삭제했습니다.', 'success');
  } catch (err) {
    console.error(err);
    toast('시험을 삭제하지 못했습니다.', 'error');
  }
}

function exportToCSV() {
  if (!students.length || !gradeColumns.length) {
    toast('내보낼 데이터가 없습니다.', 'error');
    return;
  }
  const header = ['번호', '이름', ...gradeColumns.map(c => c.name + (c.subject ? ' (' + c.subject + ')' : '')), '합계', '평균'];
  const rows = students.map(student => {
    const scores = gradeColumns.map(col => {
      const v = gradeScores[col.id]?.[student.id];
      return (v !== null && v !== undefined) ? v : '';
    });
    const valid = scores.filter(s => s !== '');
    const total = valid.reduce((a, b) => a + b, 0);
    const avg = valid.length ? (total / valid.length).toFixed(1) : '';
    return [student.number, student.name, ...scores, valid.length ? total.toFixed(1) : '', avg];
  });

  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '성적관리_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV 파일로 내보냈습니다.', 'success');
}

function escapeHtml(v) {
  return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.registerPage('grades', { render, init });
})();

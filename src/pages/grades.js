(function () {
'use strict';

let records = [];
let quickLinks = [];
let unlocked = false;
let searchText = '';

window.appGradesLock = function () {
  unlocked = false;
  document.removeEventListener('keydown', handleGradesShortcutKeys);
};

const TEMPLATE_HEADERS = [
  '졸업년도', '이름', '학번', '학년반', '평균내신', '출결요약',
  '자격증', '희망회사', '희망직무', '취업회사', '취업직무', '지역', '비고'
];

function hasAccess() {
  return !!(window.appGradesCanUse && window.appGradesCanUse());
}

async function render(container) {
  if (!hasAccess()) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:920px">
        <div class="page-header"><h1 class="page-header-title">취업 데이터 관리</h1></div>
        <section class="card settings-card">
          <div class="settings-title">접근 권한이 없습니다.</div>
          <div class="settings-note" style="margin-top:6px">관리자가 성적관리 권한을 부여한 교사만 사용할 수 있습니다.</div>
        </section>
      </div>`;
    return;
  }

  if (!unlocked) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:520px">
        <div class="page-header"><h1 class="page-header-title">취업 데이터 관리</h1></div>
        <section class="card settings-card">
          <div class="settings-title">보안 확인</div>
          <div class="settings-note" style="margin-top:6px">학생 성적, 자격증, 취업 정보가 포함되어 있습니다. 성적관리 비밀번호를 입력해야 열람할 수 있습니다.</div>
          <div class="form-row" style="margin-top:16px">
            <label>성적관리 비밀번호</label>
            <input class="input" id="grades-password-input" type="password" autocomplete="current-password" placeholder="비밀번호 입력">
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button class="btn btn-primary btn-sm" id="grades-password-submit">입장</button>
            <span id="grades-password-status" class="settings-note"></span>
          </div>
        </section>
      </div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-wrap" style="max-width:none">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <h1 class="page-header-title">취업 데이터 관리</h1>
          <div class="settings-note" style="margin-top:4px">졸업생 성적, 자격증, 취업처를 모아 올해 학생의 취업 가능성을 조회합니다.</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="career-template-btn">CSV 양식 다운로드</button>
          <button class="btn btn-secondary btn-sm" id="career-import-btn">CSV 올리기</button>
          <button class="btn btn-secondary btn-sm" id="career-export-btn">CSV 내려받기</button>
          <button class="btn btn-primary btn-sm" id="career-add-btn">+ 학생 데이터 추가</button>
          <input type="file" id="career-import-input" accept=".csv" style="display:none">
        </div>
      </div>

      <section class="card settings-card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div class="settings-title">온라인 빠른 바로가기</div>
            <div class="settings-note" style="margin-top:4px">성적관리 페이지 안에서만 열 수 있는 온라인 링크입니다.</div>
          </div>
          <button class="btn btn-primary btn-sm" id="quick-link-add-btn">+ 링크 추가</button>
        </div>
        <div id="quick-link-list" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:12px"></div>
      </section>

      <section class="card settings-card" style="margin-bottom:16px">
        <div class="settings-title">학생 취업 가능성 조회</div>
        <div class="settings-note" style="margin:4px 0 14px">현재 학생의 내신/자격증/희망회사를 입력하면, 졸업생 데이터 기반으로 필요한 자격증과 내신 목표를 계산합니다.</div>
        <div class="form-row row-2">
          <div><label>학생 이름</label><input class="input" id="rec-name" placeholder="예: 홍길동"></div>
          <div><label>현재 평균 내신</label><input class="input" id="rec-grade" type="number" step="0.01" placeholder="예: 3.2"></div>
        </div>
        <div class="form-row row-2">
          <div><label>보유 자격증</label><input class="input" id="rec-certs" placeholder="예: 전기기능사, 승강기기능사"></div>
          <div><label>희망 회사/분야</label><input class="input" id="rec-company" placeholder="예: A회사 또는 전기"></div>
        </div>
        <button class="btn btn-primary btn-sm" id="rec-run-btn">졸업생 데이터로 조회</button>
        <div id="recommendation-result" style="margin-top:14px"></div>
      </section>

      <section class="card settings-card">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px">
          <div>
            <div class="settings-title">졸업생/재학생 데이터</div>
            <div class="settings-note">검색, 수정, 삭제가 가능합니다. 자격증은 쉼표로 구분합니다.</div>
          </div>
          <input class="input" id="career-search" style="max-width:260px" placeholder="이름, 회사, 자격증 검색">
        </div>
        <div id="career-table-wrap" style="overflow:auto;max-height:560px"></div>
      </section>
    </div>`;
}

async function init() {
  if (!hasAccess()) return;
  if (!unlocked) {
    bindPasswordGate();
    return;
  }
  await loadRecords();
  await loadQuickLinks();
  bindActions();
  renderQuickLinks();
  renderTable();
}

function bindPasswordGate() {
  const input = document.getElementById('grades-password-input');
  const button = document.getElementById('grades-password-submit');
  const status = document.getElementById('grades-password-status');
  const submit = async () => {
    const typed = String(input?.value || '').trim();
    if (!typed) {
      if (status) status.textContent = '비밀번호를 입력해 주세요.';
      return;
    }
    try {
      await window.appGradesVerifyPassword(typed);
      unlocked = true;
      await render(document.getElementById('page-content'));
      await init();
    } catch (error) {
      if (status) status.textContent = formatPasswordError(error);
    }
  };
  input?.focus();
  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submit();
  });
  button?.addEventListener('click', submit);
}

function formatPasswordError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '');
  if (code.includes('not-found') || message.includes('not-found')) {
    return '성적관리 보안 설정을 찾지 못했습니다. Firestore 규칙을 게시했는지 확인해 주세요.';
  }
  if (code.includes('permission-denied')) return '비밀번호가 맞지 않거나 성적관리 권한이 없습니다.';
  if (code.includes('unauthenticated')) return (message || '로그인이 필요합니다. 앱을 완전히 종료한 뒤 다시 로그인해 주세요.') + ' / 코드: ' + code;
  return message || '비밀번호 확인에 실패했습니다.';
}

async function loadRecords() {
  records = await window.appCareerListRecords();
}

async function loadQuickLinks() {
  quickLinks = window.appCareerListLinks ? await window.appCareerListLinks() : [];
}

function bindActions() {
  document.removeEventListener('keydown', handleGradesShortcutKeys);
  document.addEventListener('keydown', handleGradesShortcutKeys);
  document.getElementById('career-template-btn')?.addEventListener('click', downloadTemplate);
  document.getElementById('career-export-btn')?.addEventListener('click', exportRecords);
  document.getElementById('career-import-btn')?.addEventListener('click', () => document.getElementById('career-import-input')?.click());
  document.getElementById('career-import-input')?.addEventListener('change', (event) => importCSV(event.target.files?.[0]));
  document.getElementById('career-add-btn')?.addEventListener('click', () => openRecordModal());
  document.getElementById('quick-link-add-btn')?.addEventListener('click', () => openQuickLinkModal());
  document.getElementById('rec-run-btn')?.addEventListener('click', runRecommendation);
  document.getElementById('career-search')?.addEventListener('input', (event) => {
    searchText = event.target.value || '';
    renderTable();
  });
}

function renderQuickLinks() {
  const root = document.getElementById('quick-link-list');
  if (!root) return;
  if (!quickLinks.length) {
    root.innerHTML = '<div class="settings-note">등록된 온라인 바로가기가 없습니다. 자주 쓰는 온라인 성적/취업 자료 링크를 추가해 주세요.</div>';
    return;
  }
  root.innerHTML = quickLinks.map((link) => `
    <div class="menu-group-card" style="padding:12px 14px">
      <div style="font-weight:800;color:var(--text);margin-bottom:4px">${escapeHtml(link.title)}</div>
      ${link.note ? `<div class="settings-note" style="margin-bottom:8px">${escapeHtml(link.note)}</div>` : ''}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm quick-link-open-btn" data-url="${escapeHtml(link.url)}">열기</button>
        <button class="btn btn-secondary btn-sm quick-link-edit-btn" data-id="${escapeHtml(link.id)}">수정</button>
        <button class="btn btn-danger btn-sm quick-link-delete-btn" data-id="${escapeHtml(link.id)}">삭제</button>
      </div>
    </div>
  `).join('');

  root.querySelectorAll('.quick-link-open-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const url = button.dataset.url || '';
      if (window.api?.openUrl) window.api.openUrl(url);
      else window.open(url, '_blank');
    });
  });
  root.querySelectorAll('.quick-link-edit-btn').forEach((button) => {
    button.addEventListener('click', () => openQuickLinkModal(quickLinks.find((link) => link.id === button.dataset.id)));
  });
  root.querySelectorAll('.quick-link-delete-btn').forEach((button) => {
    button.addEventListener('click', () => deleteQuickLink(button.dataset.id));
  });
}

function openQuickLinkModal(link) {
  const isEdit = !!link;
  showModal(`
    <div class="modal-header">
      <span class="modal-title">${isEdit ? '온라인 바로가기 수정' : '온라인 바로가기 추가'}</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="form-row"><label>이름</label><input class="input" id="quick-link-title" value="${escapeHtml(link?.title || '')}" placeholder="예: 취업 포털"></div>
      <div class="form-row"><label>주소</label><input class="input" id="quick-link-url" value="${escapeHtml(link?.url || '')}" placeholder="https://..."></div>
      <div class="form-row"><label>메모</label><input class="input" id="quick-link-note" value="${escapeHtml(link?.note || '')}" placeholder="예: 졸업생 취업처 확인용"></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="quick-link-save-btn">저장</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('quick-link-title')?.focus();
    document.getElementById('quick-link-save-btn')?.addEventListener('click', async () => {
      const data = {
        id: link?.id,
        title: document.getElementById('quick-link-title')?.value.trim() || '',
        url: document.getElementById('quick-link-url')?.value.trim() || '',
        note: document.getElementById('quick-link-note')?.value.trim() || '',
        sortOrder: link?.sortOrder || Date.now()
      };
      try {
        await window.appCareerSaveLink(data);
        closeModal();
        await loadQuickLinks();
        renderQuickLinks();
        toast('온라인 바로가기를 저장했습니다.', 'success');
      } catch (error) {
        toast(error?.message || '온라인 바로가기를 저장하지 못했습니다.', 'error');
      }
    });
  }, 0);
}

async function deleteQuickLink(id) {
  if (!confirm('이 온라인 바로가기를 삭제할까요?')) return;
  await window.appCareerDeleteLink(id);
  await loadQuickLinks();
  renderQuickLinks();
  toast('온라인 바로가기를 삭제했습니다.', 'success');
}

function handleGradesShortcutKeys(event) {
  if (!unlocked) return;
  if (!event.altKey) return;
  const tag = String(event.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  const key = String(event.key || '').toLowerCase();
  if (key === 'r') {
    event.preventDefault();
    document.getElementById('rec-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => document.getElementById('rec-name')?.focus(), 250);
  } else if (key === 'a') {
    event.preventDefault();
    openRecordModal();
  } else if (key === 'l') {
    event.preventDefault();
    document.getElementById('career-table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('career-search')?.focus(), 250);
  }
}

function renderTable() {
  const wrap = document.getElementById('career-table-wrap');
  if (!wrap) return;
  const q = normalize(searchText);
  const filtered = records.filter((row) => {
    if (!q) return true;
    return normalize([
      row.graduationYear, row.name, row.schoolNumber, row.className, row.gradeAverage,
      (row.certificates || []).join(','), row.desiredCompany, row.desiredRole,
      row.employmentCompany, row.employmentRole, row.region, row.note
    ].join(' ')).includes(q);
  });

  if (!filtered.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:36px"><div class="icon">?</div><p>표시할 데이터가 없습니다.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="position:sticky;top:0;background:var(--card);z-index:1">
          ${['졸업년도','이름','학번','학년반','내신','자격증','희망','취업처','직무','지역','관리'].map((h) => `<th style="padding:9px;border-bottom:2px solid var(--border);text-align:left;white-space:nowrap">${h}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${filtered.map((row) => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.graduationYear)}</td>
            <td style="padding:8px;font-weight:700;white-space:nowrap">${escapeHtml(row.name)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.schoolNumber)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.className)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.gradeAverage)}</td>
            <td style="padding:8px;min-width:180px">${escapeHtml((row.certificates || []).join(', '))}</td>
            <td style="padding:8px;min-width:140px">${escapeHtml([row.desiredCompany, row.desiredRole].filter(Boolean).join(' / '))}</td>
            <td style="padding:8px;font-weight:700;min-width:140px">${escapeHtml(row.employmentCompany)}</td>
            <td style="padding:8px;min-width:100px">${escapeHtml(row.employmentRole)}</td>
            <td style="padding:8px;white-space:nowrap">${escapeHtml(row.region)}</td>
            <td style="padding:8px;white-space:nowrap">
              <button class="btn btn-secondary btn-sm career-edit-btn" data-id="${escapeHtml(row.id)}">수정</button>
              <button class="btn btn-danger btn-sm career-del-btn" data-id="${escapeHtml(row.id)}">삭제</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  wrap.querySelectorAll('.career-edit-btn').forEach((button) => {
    button.addEventListener('click', () => openRecordModal(records.find((row) => row.id === button.dataset.id)));
  });
  wrap.querySelectorAll('.career-del-btn').forEach((button) => {
    button.addEventListener('click', () => deleteRecord(button.dataset.id));
  });
}

function openRecordModal(record) {
  const isEdit = !!record;
  showModal(`
    <div class="modal-header">
      <span class="modal-title">${isEdit ? '학생 데이터 수정' : '학생 데이터 추가'}</span>
      <button class="modal-close" data-close>×</button>
    </div>
    <div class="modal-body" style="display:grid;gap:12px">
      <div class="form-row row-2">
        <div><label>졸업년도</label><input class="input" id="career-year" type="number" value="${escapeHtml(record?.graduationYear || new Date().getFullYear())}"></div>
        <div><label>평균 내신</label><input class="input" id="career-grade" type="number" step="0.01" value="${escapeHtml(record?.gradeAverage || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>이름</label><input class="input" id="career-name" value="${escapeHtml(record?.name || '')}"></div>
        <div><label>학번</label><input class="input" id="career-number" value="${escapeHtml(record?.schoolNumber || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>학년반</label><input class="input" id="career-class" value="${escapeHtml(record?.className || '')}" placeholder="예: 3-1"></div>
        <div><label>출결요약</label><input class="input" id="career-attendance" value="${escapeHtml(record?.attendance || '')}"></div>
      </div>
      <div class="form-row"><label>자격증</label><input class="input" id="career-certs" value="${escapeHtml((record?.certificates || []).join(', '))}" placeholder="쉼표로 구분"></div>
      <div class="form-row row-2">
        <div><label>희망 회사</label><input class="input" id="career-desired-company" value="${escapeHtml(record?.desiredCompany || '')}"></div>
        <div><label>희망 직무</label><input class="input" id="career-desired-role" value="${escapeHtml(record?.desiredRole || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>취업 회사</label><input class="input" id="career-company" value="${escapeHtml(record?.employmentCompany || '')}"></div>
        <div><label>취업 직무</label><input class="input" id="career-role" value="${escapeHtml(record?.employmentRole || '')}"></div>
      </div>
      <div class="form-row row-2">
        <div><label>지역</label><input class="input" id="career-region" value="${escapeHtml(record?.region || '')}"></div>
        <div><label>비고</label><input class="input" id="career-note" value="${escapeHtml(record?.note || '')}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" data-close>취소</button>
      <button class="btn btn-primary" id="career-save-btn">저장</button>
    </div>`);

  setTimeout(() => {
    document.getElementById('career-name')?.focus();
    document.getElementById('career-save-btn')?.addEventListener('click', async () => {
      const next = collectModalRecord(record?.id);
      if (!next.name) return toast('이름을 입력해 주세요.', 'error');
      await window.appCareerSaveRecord(next);
      closeModal();
      await loadRecords();
      renderTable();
      toast('저장했습니다.', 'success');
    });
  }, 0);
}

function collectModalRecord(id) {
  return {
    id,
    graduationYear: Number(document.getElementById('career-year')?.value || new Date().getFullYear()),
    name: document.getElementById('career-name')?.value.trim() || '',
    schoolNumber: document.getElementById('career-number')?.value.trim() || '',
    className: document.getElementById('career-class')?.value.trim() || '',
    gradeAverage: Number(document.getElementById('career-grade')?.value || 0),
    attendance: document.getElementById('career-attendance')?.value.trim() || '',
    certificates: splitList(document.getElementById('career-certs')?.value || ''),
    desiredCompany: document.getElementById('career-desired-company')?.value.trim() || '',
    desiredRole: document.getElementById('career-desired-role')?.value.trim() || '',
    employmentCompany: document.getElementById('career-company')?.value.trim() || '',
    employmentRole: document.getElementById('career-role')?.value.trim() || '',
    region: document.getElementById('career-region')?.value.trim() || '',
    note: document.getElementById('career-note')?.value.trim() || ''
  };
}

async function deleteRecord(id) {
  if (!confirm('이 학생 데이터를 삭제할까요?')) return;
  await window.appCareerDeleteRecord(id);
  await loadRecords();
  renderTable();
  toast('삭제했습니다.', 'success');
}

function runRecommendation() {
  const name = document.getElementById('rec-name')?.value.trim() || '현재 학생';
  const grade = Number(document.getElementById('rec-grade')?.value || 0);
  const certs = splitList(document.getElementById('rec-certs')?.value || '');
  const target = document.getElementById('rec-company')?.value.trim() || '';
  const result = analyzeCareer(name, grade, certs, target);
  document.getElementById('recommendation-result').innerHTML = result;
}

function analyzeCareer(name, grade, certs, target) {
  const employed = records.filter((row) => row.employmentCompany);
  const targetRows = target
    ? employed.filter((row) => normalize([row.employmentCompany, row.employmentRole, row.desiredCompany, row.desiredRole, row.region].join(' ')).includes(normalize(target)))
    : employed;
  const pool = targetRows.length ? targetRows : employed;
  if (!pool.length) return '<div class="settings-note">분석할 졸업생 취업 데이터가 아직 없습니다.</div>';

  const avgGrade = average(pool.map((row) => Number(row.gradeAverage)).filter((value) => value > 0));
  const certStats = countCertificates(pool);
  const missingCerts = certStats.slice(0, 5).map((item) => item.name).filter((cert) => !certs.some((own) => normalize(own) === normalize(cert)));
  const similar = employed.map((row) => ({
    row,
    score: similarityScore(row, grade, certs, target)
  })).sort((a, b) => b.score - a.score).slice(0, 8);
  const gradeAdvice = grade && avgGrade
    ? (grade > avgGrade ? `희망 조건 합격자 평균은 ${avgGrade.toFixed(2)}등급입니다. 현재 ${grade.toFixed(2)}등급이면 약 ${(grade - avgGrade).toFixed(2)}등급 정도 올리는 것을 목표로 잡을 수 있습니다.` : `희망 조건 합격자 평균(${avgGrade.toFixed(2)}등급)보다 현재 내신이 유리합니다.`)
    : '내신 데이터가 부족해 내신 목표는 계산하지 못했습니다.';

  return `
    <div class="menu-group-card" style="padding:14px 16px">
      <div style="font-weight:800;color:var(--text);margin-bottom:8px">${escapeHtml(name)} 분석 결과</div>
      <div class="settings-note">${escapeHtml(gradeAdvice)}</div>
      <div style="margin-top:10px"><b>우선 준비하면 좋은 자격증</b>: ${missingCerts.length ? escapeHtml(missingCerts.join(', ')) : '현재 보유 자격증과 주요 합격자 자격증이 비슷합니다.'}</div>
      <div style="margin-top:10px"><b>데이터상 가능성이 있는 취업처</b></div>
      <div style="display:grid;gap:8px;margin-top:8px">
        ${similar.map(({ row, score }) => `
          <div style="padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--bg)">
            <b>${escapeHtml(row.employmentCompany || '-')}</b>
            <span class="settings-note"> ${escapeHtml(row.employmentRole || '')} · ${escapeHtml(row.graduationYear || '')}년 졸업 · 유사도 ${Math.round(score)}점</span>
            <div class="settings-note" style="margin-top:4px">내신 ${escapeHtml(row.gradeAverage || '-')} / 자격증 ${escapeHtml((row.certificates || []).join(', ') || '-')} / ${escapeHtml(row.name || '졸업생')}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function similarityScore(row, grade, certs, target) {
  let score = 30;
  const rowGrade = Number(row.gradeAverage);
  if (grade && rowGrade) score += Math.max(0, 30 - Math.abs(rowGrade - grade) * 12);
  const rowCerts = row.certificates || [];
  const overlap = rowCerts.filter((cert) => certs.some((own) => normalize(own) === normalize(cert))).length;
  score += overlap * 12;
  if (target && normalize([row.employmentCompany, row.employmentRole, row.desiredCompany, row.desiredRole].join(' ')).includes(normalize(target))) score += 25;
  return score;
}

function countCertificates(rows) {
  const map = {};
  rows.forEach((row) => (row.certificates || []).forEach((cert) => {
    const key = cert.trim();
    if (key) map[key] = (map[key] || 0) + 1;
  }));
  return Object.keys(map).map((name) => ({ name, count: map[name] })).sort((a, b) => b.count - a.count);
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function downloadTemplate() {
  downloadCSV('취업데이터_양식.csv', [
    TEMPLATE_HEADERS,
    ['2025', '홍길동', '30101', '3-1', '3.2', '결석0 지각1', '전기기능사, 승강기기능사', 'A회사', '전기설비', 'A회사', '전기설비', '청주', '예시 데이터']
  ]);
}

function exportRecords() {
  const rows = records.map(recordToCSVRow);
  downloadCSV('취업데이터_' + new Date().toISOString().slice(0, 10) + '.csv', [TEMPLATE_HEADERS, ...rows]);
}

async function importCSV(file) {
  if (!file) return;
  const text = await file.text();
  const rows = parseCSV(text);
  if (rows.length < 2) return toast('CSV 데이터가 비어 있습니다.', 'error');
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => String(cell || '').trim()));
  if (!dataRows.length) return toast('가져올 데이터가 없습니다.', 'error');
  if (!confirm(`${dataRows.length}건을 클라우드에 업로드할까요?`)) return;
  for (const row of dataRows) {
    await window.appCareerSaveRecord(csvRowToRecord(row));
  }
  await loadRecords();
  renderTable();
  toast(`${dataRows.length}건을 업로드했습니다.`, 'success');
}

function recordToCSVRow(row) {
  return [
    row.graduationYear || '', row.name || '', row.schoolNumber || '', row.className || '',
    row.gradeAverage || '', row.attendance || '', (row.certificates || []).join(', '),
    row.desiredCompany || '', row.desiredRole || '', row.employmentCompany || '',
    row.employmentRole || '', row.region || '', row.note || ''
  ];
}

function csvRowToRecord(row) {
  return {
    graduationYear: Number(row[0]) || new Date().getFullYear(),
    name: String(row[1] || '').trim(),
    schoolNumber: String(row[2] || '').trim(),
    className: String(row[3] || '').trim(),
    gradeAverage: Number(row[4]) || 0,
    attendance: String(row[5] || '').trim(),
    certificates: splitList(row[6] || ''),
    desiredCompany: String(row[7] || '').trim(),
    desiredRole: String(row[8] || '').trim(),
    employmentCompany: String(row[9] || '').trim(),
    employmentRole: String(row[10] || '').trim(),
    region: String(row[11] || '').trim(),
    note: String(row[12] || '').trim()
  };
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted && ch === '"' && next === '"') {
      cell += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function splitList(value) {
  return String(value || '').split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, '');
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('grades', { render, init });
})();

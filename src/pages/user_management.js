(function () {
let userList = [];
let searchKeyword = '';
let statusFilter = 'all';

async function render(container) {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) {
    container.innerHTML = `
      <div class="page-wrap" style="max-width:920px">
        <div class="page-header">
          <h1 class="page-header-title">회원 관리</h1>
        </div>
        <section class="card settings-card">
          <div class="settings-note">관리자만 접근할 수 있습니다.</div>
        </section>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page-wrap" style="max-width:920px">
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <h1 class="page-header-title">회원 관리</h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-secondary btn-sm" id="user-management-refresh">새로고침</button>
          <button class="btn btn-primary btn-sm" id="user-management-back">설정으로 돌아가기</button>
        </div>
      </div>

      <section class="card settings-card">
        <div class="settings-head">
          <div>
            <div class="settings-title">사용자 검색 및 관리</div>
            <div class="settings-note">문제가 있는 사용자만 중지하거나 삭제하면 됩니다. 삭제된 계정은 이 앱에서 다시 로그인할 수 없습니다.</div>
          </div>
        </div>

        <div class="form-row">
          <label>검색</label>
          <input class="input" id="user-management-search" placeholder="이름 또는 이메일 검색" value="${escapeHtml(searchKeyword)}">
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px">
          <button class="btn btn-sm user-filter-btn${statusFilter === 'all' ? ' btn-primary' : ' btn-secondary'}" data-filter="all">전체</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'active' ? ' btn-primary' : ' btn-secondary'}" data-filter="active">사용 중</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'blocked' ? ' btn-primary' : ' btn-secondary'}" data-filter="blocked">사용 중지</button>
          <button class="btn btn-sm user-filter-btn${statusFilter === 'deleted' ? ' btn-primary' : ' btn-secondary'}" data-filter="deleted">삭제됨</button>
        </div>

        <div id="user-management-summary" class="settings-note" style="margin-bottom:12px"></div>
        <div id="user-management-list" style="display:flex;flex-direction:column;gap:10px;max-height:560px;overflow:auto;padding-right:4px"></div>
      </section>
    </div>
  `;
}

async function init() {
  const authState = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!authState?.isAdmin) return;

  document.getElementById('user-management-back')?.addEventListener('click', () => {
    if (window.navigateTo) window.navigateTo('settings');
  });

  document.getElementById('user-management-refresh')?.addEventListener('click', async () => {
    await loadUsers(true);
  });

  document.getElementById('user-management-search')?.addEventListener('input', (event) => {
    searchKeyword = event.target.value || '';
    renderUserList();
  });

  document.querySelectorAll('.user-filter-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      statusFilter = button.dataset.filter || 'all';
      await render(document.getElementById('page-content'));
      await init();
    });
  });

  await loadUsers(false);
}

async function loadUsers(showToast) {
  const list = document.getElementById('user-management-list');
  if (list) {
    list.innerHTML = '<div class="settings-note">사용자 목록을 불러오는 중...</div>';
  }

  userList = await window.appAuthListUsers();
  renderUserList();
  if (showToast) toast('사용자 목록을 새로고침했습니다.', 'success');
}

function renderUserList() {
  const root = document.getElementById('user-management-list');
  const summary = document.getElementById('user-management-summary');
  const state = window.appAuthGetState ? window.appAuthGetState() : null;
  if (!root || !summary) return;

  const normalizedKeyword = String(searchKeyword || '').trim().toLowerCase();
  const filtered = userList.filter((user) => {
    if (statusFilter === 'active' && (!user.active || user.deleted)) return false;
    if (statusFilter === 'blocked' && (user.active || user.deleted)) return false;
    if (statusFilter === 'deleted' && !user.deleted) return false;

    if (!normalizedKeyword) return true;
    const haystack = `${user.displayName || ''} ${user.email || ''}`.toLowerCase();
    return haystack.indexOf(normalizedKeyword) >= 0;
  });

  const activeCount = userList.filter((user) => user.active && !user.deleted).length;
  const blockedCount = userList.filter((user) => !user.active && !user.deleted).length;
  const deletedCount = userList.filter((user) => user.deleted).length;
  summary.textContent = `전체 ${userList.length}명 중 사용 중 ${activeCount}명, 사용 중지 ${blockedCount}명, 삭제 ${deletedCount}명`;

  if (!filtered.length) {
    root.innerHTML = '<div class="settings-note">조건에 맞는 사용자가 없습니다.</div>';
    return;
  }

  root.innerHTML = filtered.map((user) => `
    <div class="menu-group-card" style="padding:14px 16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <div style="font-size:14px;font-weight:700;color:var(--text)">${escapeHtml(user.displayName || user.email)}</div>
          <div class="settings-note" style="margin-top:4px">${escapeHtml(user.email)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
            <span class="chip ${user.role === 'admin' ? 'primary' : ''}">${user.role === 'admin' ? '관리자' : '사용자'}</span>
            <span class="chip ${user.deleted ? 'danger' : (user.active ? 'success' : 'danger')}">${user.deleted ? '삭제됨' : (user.active ? '사용 중' : '사용 중지')}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${user.uid === state?.uid ? '<span class="settings-note">내 계정</span>' : ''}
          ${user.uid !== state?.uid && !user.deleted && user.active ? `<button class="btn btn-secondary btn-sm user-disable-btn" data-uid="${escapeHtml(user.uid)}">사용 중지</button>` : ''}
          ${user.uid !== state?.uid && !user.deleted && !user.active ? `<button class="btn btn-primary btn-sm user-enable-btn" data-uid="${escapeHtml(user.uid)}">다시 허용</button>` : ''}
          ${user.uid !== state?.uid && !user.deleted ? `<button class="btn btn-danger btn-sm user-delete-btn" data-uid="${escapeHtml(user.uid)}" data-name="${escapeHtml(user.displayName || user.email)}">계정 삭제</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  root.querySelectorAll('.user-disable-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { active: false });
      toast('사용자를 중지했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-enable-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { active: true });
      toast('다시 사용할 수 있게 했습니다.', 'success');
      await loadUsers(false);
    });
  });

  root.querySelectorAll('.user-delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetName = button.dataset.name || '이 사용자';
      const confirmed = window.confirm(`${targetName} 계정을 삭제할까요?\n\n삭제하면 이 앱에서 다시 로그인할 수 없고, 시간표/할 일 같은 연동 데이터도 함께 정리됩니다.`);
      if (!confirmed) return;
      await window.appAuthDeleteUser(button.dataset.uid);
      toast('계정이 삭제되었습니다.', 'success');
      await loadUsers(false);
    });
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.registerPage('user_management', { render, init });
})();

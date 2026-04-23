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
            <div class="settings-note">가입한 사용자는 바로 사용할 수 있습니다. 문제가 있을 때만 사용 중지하면 됩니다.</div>
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
    if (statusFilter === 'active' && !user.active) return false;
    if (statusFilter === 'blocked' && user.active) return false;

    if (!normalizedKeyword) return true;
    const haystack = `${user.displayName || ''} ${user.email || ''}`.toLowerCase();
    return haystack.indexOf(normalizedKeyword) >= 0;
  });

  const activeCount = userList.filter((user) => user.active).length;
  const blockedCount = userList.filter((user) => !user.active).length;
  summary.textContent = `전체 ${userList.length}명 · 사용 중 ${activeCount}명 · 사용 중지 ${blockedCount}명`;

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
            <span class="chip ${user.active ? 'success' : 'danger'}">${user.active ? '사용 중' : '사용 중지'}</span>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${user.uid === state?.uid ? '<span class="settings-note">내 계정</span>' : ''}
          ${user.uid !== state?.uid && user.active ? `<button class="btn btn-secondary btn-sm user-disable-btn" data-uid="${escapeHtml(user.uid)}">사용 중지</button>` : ''}
          ${user.uid !== state?.uid && !user.active ? `<button class="btn btn-primary btn-sm user-enable-btn" data-uid="${escapeHtml(user.uid)}">다시 허용</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  root.querySelectorAll('.user-disable-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      await window.appAuthUpdateUser(button.dataset.uid, { active: false });
      toast('사용을 중지했습니다.', 'success');
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

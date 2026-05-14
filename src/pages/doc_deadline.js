(function () {
'use strict';

var STORAGE_KEY = 'doc_deadline_list';

// D-day 색상
function getDdayColor(days) {
  if (days < 0)  return '#9ca3af'; // 지남
  if (days === 0) return '#ef4444'; // 오늘
  if (days <= 1)  return '#ef4444'; // D-1
  if (days <= 3)  return '#f59e0b'; // D-3
  return '#22c55e';
}

function getDdayLabel(days) {
  if (days < 0)  return '기한 지남';
  if (days === 0) return 'D-Day';
  return 'D-' + days;
}

function diffDays(dateStr) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = new Date(dateStr + 'T00:00:00');
  return Math.round((due - today) / 86400000);
}

async function loadDocs() {
  var raw = await api.getSetting(STORAGE_KEY, '');
  try { return raw ? JSON.parse(raw) : []; } catch (_) { return []; }
}

async function saveDocs(list) {
  await api.setSetting(STORAGE_KEY, JSON.stringify(list));
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body: body, icon: '' });
  }
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📬 공문 기한 추적</h1>
      </div>

      <!-- 요약 배너 -->
      <div id="dd-alert-banner" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#ef4444"></div>

      <!-- 필터 & 버튼 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
        <button class="btn btn-primary btn-sm" id="dd-add-btn">+ 공문 추가</button>
        <div style="display:flex;gap:4px;margin-left:auto">
          <button class="btn btn-sm dd-filter-btn active" data-filter="active">진행중</button>
          <button class="btn btn-sm dd-filter-btn" data-filter="done">완료</button>
          <button class="btn btn-sm dd-filter-btn" data-filter="all">전체</button>
        </div>
      </div>

      <!-- D-day 카드 목록 -->
      <div id="dd-list" style="display:flex;flex-direction:column;gap:10px"></div>
      <div id="dd-empty" style="display:none;text-align:center;padding:40px;color:var(--text3)">
        등록된 공문이 없습니다.<br><span style="font-size:12px">공문 추가 버튼으로 새 공문을 등록하세요.</span>
      </div>
    </div>

    <!-- 공문 추가/수정 모달 -->
    <div id="dd-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9000;align-items:center;justify-content:center">
      <div style="background:var(--bg1);border-radius:12px;padding:22px;width:440px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <strong id="dd-modal-title" style="font-size:15px">공문 추가</strong>
          <button class="btn btn-secondary btn-xs" id="dd-modal-close">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">공문 제목 *</label>
            <input class="input" id="dd-f-title" placeholder="예: 2026 학교폭력 예방 교육 결과 보고" style="font-size:13px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">공문 번호</label>
              <input class="input" id="dd-f-docnum" placeholder="예: 교육정책과-1234" style="font-size:13px">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">마감일 *</label>
              <input type="date" class="input" id="dd-f-due" style="font-size:13px">
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">담당자</label>
              <input class="input" id="dd-f-owner" placeholder="예: 홍길동" style="font-size:13px">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">우선순위</label>
              <select class="input" id="dd-f-priority" style="font-size:13px">
                <option value="high">🔴 높음</option>
                <option value="mid" selected>🟡 보통</option>
                <option value="low">🟢 낮음</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text3);display:block;margin-bottom:3px">메모</label>
            <textarea class="input" id="dd-f-memo" rows="2" placeholder="관련 사항, 제출 방법 등" style="font-size:13px;resize:none"></textarea>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="dd-f-gcal" style="width:16px;height:16px">
            <label for="dd-f-gcal" style="font-size:13px;cursor:pointer">Google Calendar에 마감일 등록</label>
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-secondary btn-sm" id="dd-modal-cancel">취소</button>
          <button class="btn btn-primary btn-sm" id="dd-modal-save">저장</button>
        </div>
      </div>
    </div>
  `;
}

async function init() {
  requestNotificationPermission();

  var docs   = await loadDocs();
  var filter = 'active';
  var editId = null;

  // D-1, D-3 알림 체크 (앱 시작 후 한 번)
  var today = new Date().toISOString().slice(0, 10);
  var notifCheckKey = 'doc_deadline_notif_' + today;
  var alreadyNotified = await api.getSetting(notifCheckKey, '');
  if (!alreadyNotified) {
    docs.filter(function (d) { return !d.done; }).forEach(function (d) {
      var days = diffDays(d.due);
      if (days === 1) sendNotification('⚠️ 공문 마감 D-1', d.title + ' — 내일 마감입니다.');
      if (days === 3) sendNotification('📬 공문 마감 D-3', d.title + ' — 3일 후 마감입니다.');
      if (days === 0) sendNotification('🚨 공문 마감 D-Day', d.title + ' — 오늘 마감입니다!');
    });
    await api.setSetting(notifCheckKey, '1');
  }

  function getFiltered() {
    return docs.filter(function (d) {
      if (filter === 'active') return !d.done;
      if (filter === 'done')   return d.done;
      return true;
    }).sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.due.localeCompare(b.due);
    });
  }

  var PRIORITY_LABEL = { high: '🔴 높음', mid: '🟡 보통', low: '🟢 낮음' };

  function renderList() {
    var filtered = getFiltered();
    var urgentDocs = docs.filter(function (d) {
      if (d.done) return false;
      var days = diffDays(d.due);
      return days >= 0 && days <= 3;
    });

    // 긴급 배너
    var banner = document.getElementById('dd-alert-banner');
    if (urgentDocs.length > 0) {
      banner.style.display = 'block';
      banner.innerHTML = '⚠️ <strong>마감 임박 공문 ' + urgentDocs.length + '건:</strong> ' +
        urgentDocs.map(function (d) {
          var days = diffDays(d.due);
          return d.title + ' (' + getDdayLabel(days) + ')';
        }).join(' · ');
    } else {
      banner.style.display = 'none';
    }

    var listEl = document.getElementById('dd-list');
    var emptyEl = document.getElementById('dd-empty');

    if (!filtered.length) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }
    emptyEl.style.display = 'none';

    listEl.innerHTML = filtered.map(function (doc) {
      var days = diffDays(doc.due);
      var ddColor = doc.done ? '#9ca3af' : getDdayColor(days);
      var ddLabel = doc.done ? '✅ 완료' : getDdayLabel(days);
      var gcalBadge = doc.gcal_event_id ? '<span style="font-size:10px;background:#e0f2fe;color:#0369a1;padding:1px 6px;border-radius:8px;margin-left:4px">📅 캘린더</span>' : '';

      return `<div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;${doc.done ? 'opacity:.6' : ''}">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <!-- D-day 배지 -->
          <div style="flex-shrink:0;min-width:54px;text-align:center">
            <div style="font-size:18px;font-weight:700;color:${ddColor}">${ddLabel}</div>
            <div style="font-size:11px;color:var(--text3)">${doc.due}</div>
          </div>
          <!-- 내용 -->
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
              <strong style="font-size:14px;${doc.done ? 'text-decoration:line-through' : ''}">${doc.title}</strong>
              ${gcalBadge}
              <span style="font-size:11px;color:var(--text3)">${PRIORITY_LABEL[doc.priority] || ''}</span>
            </div>
            <div style="font-size:12px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap">
              ${doc.docnum ? '<span>📄 ' + doc.docnum + '</span>' : ''}
              ${doc.owner  ? '<span>👤 ' + doc.owner  + '</span>' : ''}
            </div>
            ${doc.memo ? `<div style="font-size:12px;color:var(--text2);margin-top:5px;padding:6px 8px;background:var(--bg2);border-radius:6px">${doc.memo}</div>` : ''}
          </div>
          <!-- 버튼 -->
          <div style="flex-shrink:0;display:flex;flex-direction:column;gap:4px;align-items:flex-end">
            <button class="btn btn-primary btn-xs dd-done-btn" data-id="${doc.id}" style="${doc.done ? 'opacity:.5' : ''}">
              ${doc.done ? '↩ 취소' : '✅ 완료'}
            </button>
            <button class="btn btn-secondary btn-xs dd-edit-btn" data-id="${doc.id}">수정</button>
            <button class="btn btn-secondary btn-xs dd-del-btn" data-id="${doc.id}">삭제</button>
          </div>
        </div>
      </div>`;
    }).join('');

    // 이벤트 바인딩
    listEl.querySelectorAll('.dd-done-btn').forEach(function (btn) {
      btn.onclick = async function () {
        var id = parseInt(btn.getAttribute('data-id'));
        var doc = docs.find(function (d) { return d.id === id; });
        if (!doc) return;
        doc.done = !doc.done;
        if (doc.done && doc.gcal_event_id && window.deleteGoogleCalendarCustomEvent) {
          await window.deleteGoogleCalendarCustomEvent(doc.gcal_event_id).catch(function(){});
          doc.gcal_event_id = '';
        }
        await saveDocs(docs);
        renderList();
      };
    });

    listEl.querySelectorAll('.dd-edit-btn').forEach(function (btn) {
      btn.onclick = function () { openModal(parseInt(btn.getAttribute('data-id'))); };
    });

    listEl.querySelectorAll('.dd-del-btn').forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm('삭제할까요?')) return;
        var id = parseInt(btn.getAttribute('data-id'));
        var doc = docs.find(function (d) { return d.id === id; });
        if (doc && doc.gcal_event_id && window.deleteGoogleCalendarCustomEvent) {
          await window.deleteGoogleCalendarCustomEvent(doc.gcal_event_id).catch(function(){});
        }
        docs = docs.filter(function (d) { return d.id !== id; });
        await saveDocs(docs);
        renderList();
      };
    });
  }

  // 필터 버튼
  document.querySelectorAll('.dd-filter-btn').forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll('.dd-filter-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      filter = btn.getAttribute('data-filter');
      renderList();
    };
  });

  // 모달
  var modal = document.getElementById('dd-modal');

  function openModal(id) {
    editId = id || null;
    var doc = editId ? docs.find(function (d) { return d.id === editId; }) : null;
    document.getElementById('dd-modal-title').textContent = editId ? '공문 수정' : '공문 추가';
    document.getElementById('dd-f-title').value    = doc ? doc.title   : '';
    document.getElementById('dd-f-docnum').value   = doc ? doc.docnum  : '';
    document.getElementById('dd-f-due').value      = doc ? doc.due     : '';
    document.getElementById('dd-f-owner').value    = doc ? doc.owner   : '';
    document.getElementById('dd-f-priority').value = doc ? doc.priority : 'mid';
    document.getElementById('dd-f-memo').value     = doc ? doc.memo    : '';
    document.getElementById('dd-f-gcal').checked   = false;
    modal.style.display = 'flex';
    document.getElementById('dd-f-title').focus();
  }

  document.getElementById('dd-add-btn').onclick = function () { openModal(null); };
  document.getElementById('dd-modal-close').onclick  = function () { modal.style.display = 'none'; };
  document.getElementById('dd-modal-cancel').onclick = function () { modal.style.display = 'none'; };
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('dd-modal-save').onclick = async function () {
    var title    = document.getElementById('dd-f-title').value.trim();
    var docnum   = document.getElementById('dd-f-docnum').value.trim();
    var due      = document.getElementById('dd-f-due').value;
    var owner    = document.getElementById('dd-f-owner').value.trim();
    var priority = document.getElementById('dd-f-priority').value;
    var memo     = document.getElementById('dd-f-memo').value.trim();
    var useGcal  = document.getElementById('dd-f-gcal').checked;

    if (!title || !due) { alert('제목과 마감일은 필수입니다.'); return; }

    var btn = document.getElementById('dd-modal-save');
    btn.disabled = true; btn.textContent = '저장 중...';

    var gcalId = '';
    if (useGcal && window.addGoogleCalendarCustomEvent) {
      gcalId = await window.addGoogleCalendarCustomEvent({
        name: '📬 [공문마감] ' + title,
        date: due
      }).catch(function () { return ''; }) || '';
    }

    if (editId) {
      var idx = docs.findIndex(function (d) { return d.id === editId; });
      if (idx >= 0) {
        var existing = docs[idx];
        docs[idx] = Object.assign(existing, { title: title, docnum: docnum, due: due,
          owner: owner, priority: priority, memo: memo });
        if (gcalId) docs[idx].gcal_event_id = gcalId;
      }
    } else {
      docs.push({ id: Date.now(), title: title, docnum: docnum, due: due,
        owner: owner, priority: priority, memo: memo, done: false, gcal_event_id: gcalId });
    }

    await saveDocs(docs);
    modal.style.display = 'none';
    btn.disabled = false; btn.textContent = '저장';
    renderList();
  };

  renderList();
}

window.registerPage('doc_deadline', { render: render, init: init });
})();

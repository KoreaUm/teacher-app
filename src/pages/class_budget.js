(function () {
'use strict';

var STORAGE_KEY = 'class_budget_data';
var BUDGET_KEY  = 'class_budget_limit';

var CATEGORIES = ['교육활동비', '문구·소모품', '도서·자료', '행사·현장학습', '급식·간식', '기타'];

async function loadRecords() {
  var raw = await api.getSetting(STORAGE_KEY, '');
  try { return raw ? JSON.parse(raw) : []; } catch (_) { return []; }
}

async function saveRecords(list) {
  await api.setSetting(STORAGE_KEY, JSON.stringify(list));
}

async function loadBudget() {
  var raw = await api.getSetting(BUDGET_KEY, '');
  return parseFloat(raw) || 0;
}

async function saveBudget(val) {
  await api.setSetting(BUDGET_KEY, String(val));
}

function formatWon(n) {
  return Number(n).toLocaleString('ko-KR') + '원';
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">💰 학급운영비 관리</h1>
      </div>

      <!-- 예산 요약 -->
      <div id="cb-summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px"></div>

      <!-- 도구 모음 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn btn-primary btn-sm" id="cb-add-btn">+ 지출 추가</button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer" title="품의서·영수증 사진을 OCR로 자동 입력">
          📷 품의서 OCR
          <input type="file" id="cb-ocr-input" accept="image/*" style="display:none">
        </label>
        <button class="btn btn-secondary btn-sm" id="cb-budget-btn">🎯 예산 설정</button>
        <button class="btn btn-secondary btn-sm" id="cb-export-btn">⬇️ 에듀파인 CSV</button>
        <button class="btn btn-secondary btn-sm" id="cb-print-btn">🖨️ 인쇄</button>
        <div style="margin-left:auto;display:flex;gap:6px;align-items:center">
          <select class="input" id="cb-cat-filter" style="font-size:12px;padding:3px 6px;height:auto">
            <option value="">전체 카테고리</option>
            ${CATEGORIES.map(function(c){return `<option>${c}</option>`;}).join('')}
          </select>
          <input type="month" class="input" id="cb-month-filter" style="font-size:12px;padding:3px 6px;height:auto">
        </div>
      </div>

      <!-- 카테고리별 막대 그래프 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;margin-bottom:14px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">📊 카테고리별 지출</div>
        <div id="cb-chart"></div>
      </div>

      <!-- 지출 목록 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:auto">
        <div style="padding:10px 16px;font-weight:600;border-bottom:1px solid var(--border);font-size:13px">📋 지출 내역</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px" id="cb-table">
          <thead>
            <tr style="background:var(--bg2);border-bottom:1px solid var(--border)">
              <th style="padding:8px;text-align:left">날짜</th>
              <th style="padding:8px;text-align:left">항목</th>
              <th style="padding:8px;text-align:left">카테고리</th>
              <th style="padding:8px;text-align:right">금액</th>
              <th style="padding:8px;text-align:left">비고</th>
              <th style="padding:8px;text-align:center">관리</th>
            </tr>
          </thead>
          <tbody id="cb-tbody"></tbody>
        </table>
        <div id="cb-empty" style="display:none;text-align:center;padding:32px;color:var(--text3)">
          지출 내역이 없습니다. '+ 지출 추가' 버튼으로 추가하세요.
        </div>
      </div>
    </div>

    <!-- OCR 진행 상태 -->
    <div id="cb-ocr-status" style="display:none;position:fixed;bottom:20px;left:50%;transform:translateX(-50%);
      background:var(--bg1);border:1px solid var(--border);border-radius:8px;padding:10px 18px;
      font-size:13px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.2)"></div>

    <!-- 지출 추가/수정 모달 -->
    <div id="cb-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;align-items:center;justify-content:center">
      <div style="background:var(--bg1);border-radius:12px;border:1px solid var(--border);padding:22px;width:420px;box-shadow:0 20px 60px rgba(0,0,0,.35)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <strong id="cb-modal-title" style="font-size:15px">지출 추가</strong>
          <button class="btn btn-secondary btn-xs" id="cb-modal-close">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">날짜 *</label>
            <input type="date" class="input" id="cb-f-date" style="font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">항목명 *</label>
            <input class="input" id="cb-f-name" placeholder="예: A4용지 구매" style="font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">카테고리</label>
            <select class="input" id="cb-f-cat" style="font-size:13px">
              ${CATEGORIES.map(function(c){return `<option>${c}</option>`;}).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">금액(원) *</label>
            <input type="number" class="input" id="cb-f-amount" min="0" step="100" placeholder="0" style="font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">비고</label>
            <input class="input" id="cb-f-memo" placeholder="영수증 번호, 구매처 등" style="font-size:13px">
          </div>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
          <button class="btn btn-secondary btn-sm" id="cb-modal-cancel">취소</button>
          <button class="btn btn-primary btn-sm" id="cb-modal-save">저장</button>
        </div>
      </div>
    </div>

    <!-- 예산 설정 모달 -->
    <div id="cb-budget-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;align-items:center;justify-content:center">
      <div style="background:var(--bg1);border-radius:12px;border:1px solid var(--border);padding:22px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,.35)">
        <strong style="font-size:15px;display:block;margin-bottom:14px">🎯 예산 설정</strong>
        <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">총 예산(원)</label>
        <input type="number" class="input" id="cb-budget-input" min="0" step="10000" placeholder="예: 500000" style="font-size:13px;margin-bottom:14px">
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button class="btn btn-secondary btn-sm" id="cb-budget-cancel">취소</button>
          <button class="btn btn-primary btn-sm" id="cb-budget-save">저장</button>
        </div>
      </div>
    </div>
  `;
}

async function init() {
  var records = await loadRecords();
  var budget  = await loadBudget();
  var editId  = null;

  var today = new Date().toISOString().slice(0, 7);
  document.getElementById('cb-month-filter').value = today;

  function getFiltered() {
    var cat   = document.getElementById('cb-cat-filter').value;
    var month = document.getElementById('cb-month-filter').value;
    return records.filter(function (r) {
      if (cat && r.category !== cat) return false;
      if (month && !r.date.startsWith(month)) return false;
      return true;
    });
  }

  function renderAll() {
    var filtered = getFiltered();
    var totalSpent = filtered.reduce(function (s, r) { return s + r.amount; }, 0);
    var allSpent   = records.reduce(function (s, r) { return s + r.amount; }, 0);
    var remain     = budget - allSpent;
    var pct        = budget > 0 ? Math.min(100, Math.round(allSpent / budget * 100)) : 0;
    var pctColor   = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';

    // 요약 카드
    document.getElementById('cb-summary').innerHTML = `
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:700;color:var(--primary)">${formatWon(budget || 0)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">총 예산</div>
        ${budget > 0 ? `<div style="background:var(--bg2);border-radius:4px;height:6px;margin-top:8px;overflow:hidden">
          <div style="background:${pctColor};width:${pct}%;height:100%;border-radius:4px;transition:.3s"></div>
        </div>
        <div style="font-size:11px;color:${pctColor};margin-top:4px">${pct}% 사용</div>` : ''}
      </div>
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:700;color:#ef4444">${formatWon(allSpent)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">총 지출</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${records.length}건</div>
      </div>
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:14px">
        <div style="font-size:22px;font-weight:700;color:${budget > 0 && remain < 0 ? '#ef4444' : '#22c55e'}">${budget > 0 ? formatWon(remain) : '-'}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">잔액</div>
        ${filtered !== records ? `<div style="font-size:11px;color:var(--text3);margin-top:4px">필터: ${formatWon(totalSpent)}</div>` : ''}
      </div>`;

    // 카테고리 차트
    var byCat = {};
    CATEGORIES.forEach(function (c) { byCat[c] = 0; });
    filtered.forEach(function (r) { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
    var maxVal = Math.max(1, Math.max.apply(null, Object.values(byCat)));
    var COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7'];
    document.getElementById('cb-chart').innerHTML = CATEGORIES.map(function (cat, i) {
      var val = byCat[cat] || 0;
      var w = Math.round(val / maxVal * 100);
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:90px;font-size:11px;color:var(--text3);text-align:right;flex-shrink:0">${cat}</div>
        <div style="flex:1;background:var(--bg2);border-radius:4px;height:16px;overflow:hidden">
          <div style="background:${COLORS[i % COLORS.length]};width:${w}%;height:100%;border-radius:4px;transition:.4s"></div>
        </div>
        <div style="font-size:12px;font-weight:600;width:80px;flex-shrink:0">${val > 0 ? formatWon(val) : '-'}</div>
      </div>`;
    }).join('');

    // 테이블
    var tbody = document.getElementById('cb-tbody');
    if (!filtered.length) {
      tbody.innerHTML = '';
      document.getElementById('cb-empty').style.display = 'block';
      return;
    }
    document.getElementById('cb-empty').style.display = 'none';
    var sorted = filtered.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
    tbody.innerHTML = sorted.map(function (r) {
      return `<tr style="border-bottom:1px solid var(--border)" data-id="${r.id}">
        <td style="padding:8px">${r.date}</td>
        <td style="padding:8px">${r.name}</td>
        <td style="padding:8px"><span style="font-size:11px;background:var(--bg2);padding:2px 7px;border-radius:10px">${r.category}</span></td>
        <td style="padding:8px;text-align:right;font-weight:600">${formatWon(r.amount)}</td>
        <td style="padding:8px;font-size:12px;color:var(--text3)">${r.memo || ''}</td>
        <td style="padding:8px;text-align:center">
          <button class="btn btn-secondary btn-xs cb-edit-btn" data-id="${r.id}">수정</button>
          <button class="btn btn-secondary btn-xs cb-del-btn" data-id="${r.id}" style="margin-left:4px">삭제</button>
        </td>
      </tr>`;
    }).join('');

    // 수정·삭제
    tbody.querySelectorAll('.cb-edit-btn').forEach(function (btn) {
      btn.onclick = function () { openModal(parseInt(btn.getAttribute('data-id'))); };
    });
    tbody.querySelectorAll('.cb-del-btn').forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm('삭제할까요?')) return;
        var id = parseInt(btn.getAttribute('data-id'));
        records = records.filter(function (r) { return r.id !== id; });
        await saveRecords(records);
        renderAll();
      };
    });
  }

  // 모달
  var modal = document.getElementById('cb-modal');
  function openModal(id) {
    editId = id || null;
    document.getElementById('cb-modal-title').textContent = editId ? '지출 수정' : '지출 추가';
    var rec = editId ? records.find(function (r) { return r.id === editId; }) : null;
    document.getElementById('cb-f-date').value   = rec ? rec.date   : new Date().toISOString().slice(0, 10);
    document.getElementById('cb-f-name').value   = rec ? rec.name   : '';
    document.getElementById('cb-f-cat').value    = rec ? rec.category : CATEGORIES[0];
    document.getElementById('cb-f-amount').value = rec ? rec.amount : '';
    document.getElementById('cb-f-memo').value   = rec ? rec.memo   : '';
    modal.style.display = 'flex';
    document.getElementById('cb-f-name').focus();
  }

  document.getElementById('cb-add-btn').onclick = function () { openModal(null); };

  // ── 품의서 OCR ──────────────────────────────────────────
  document.getElementById('cb-ocr-input').onchange = async function (e) {
    var file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    var statusEl = document.getElementById('cb-ocr-status');
    function showStatus(msg) { statusEl.style.display = 'block'; statusEl.textContent = msg; }
    function hideStatus() { statusEl.style.display = 'none'; }

    showStatus('📷 Tesseract OCR 중... (첫 실행 시 1~2분 소요)');

    try {
      // 이미지 → base64
      var base64 = await new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var result = String(reader.result || '');
          resolve(result.replace(/^data:[^;]+;base64,/, ''));
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // 1단계: Tesseract OCR
      var ocrResult = await api.ocrImage(base64, 'kor+eng');
      if (ocrResult.error) { showStatus('OCR 오류: ' + ocrResult.error); setTimeout(hideStatus, 4000); return; }

      var ocrText = (ocrResult.text || '').trim();
      if (!ocrText) { showStatus('텍스트 추출 실패. 사진 화질을 확인하세요.'); setTimeout(hideStatus, 3000); return; }

      showStatus('✅ OCR 완료! 로컬 AI로 품목 분석 중...');

      // 2단계: Qwen으로 구조화
      var engine = await api.getSetting('ai_engine', 'local_lite');
      var localEngine = (engine === 'local_lite' || engine === 'local_basic' || engine === 'local_pro') ? engine : 'local_lite';

      var prompt = `다음은 품의서 또는 영수증을 OCR로 추출한 텍스트입니다.
이 문서에서 지출 정보를 추출하여 JSON 배열로 출력하세요.
각 항목: {"date":"YYYY-MM-DD","name":"품목명","category":"카테고리","amount":금액(숫자),"memo":"비고"}
- date는 문서에서 찾을 수 없으면 오늘 날짜로
- category는 다음 중 하나: 교육활동비, 문구·소모품, 도서·자료, 행사·현장학습, 급식·간식, 기타
- 코드블록 없이 JSON 배열만 출력

OCR 텍스트:
${ocrText}`;

      var aiResult = await api.aiLocalChat({ engine: localEngine, page: '학급운영비', question: prompt, context: '' });

      if (aiResult.error) {
        showStatus('AI 오류: ' + aiResult.error);
        setTimeout(hideStatus, 4000);
        // OCR 텍스트라도 모달에 표시
        openModal(null);
        document.getElementById('cb-f-memo').value = ocrText.slice(0, 200);
        return;
      }

      // JSON 파싱
      var raw = (aiResult.result || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
      var items = [];
      try { items = JSON.parse(raw); if (!Array.isArray(items)) items = [items]; } catch (_) { items = []; }

      if (!items.length) {
        showStatus('항목을 파악하지 못했습니다. 수동으로 입력해주세요.');
        setTimeout(hideStatus, 3000);
        openModal(null);
        document.getElementById('cb-f-memo').value = ocrText.slice(0, 200);
        return;
      }

      hideStatus();

      // 품목이 여러 개면 모두 추가, 하나면 모달로 확인
      if (items.length === 1) {
        var item = items[0];
        openModal(null);
        var today = new Date().toISOString().slice(0, 10);
        document.getElementById('cb-f-date').value   = item.date || today;
        document.getElementById('cb-f-name').value   = item.name || '';
        document.getElementById('cb-f-cat').value    = CATEGORIES.includes(item.category) ? item.category : CATEGORIES[0];
        document.getElementById('cb-f-amount').value = item.amount || '';
        document.getElementById('cb-f-memo').value   = item.memo || '';
      } else {
        // 복수 품목 확인 다이얼로그
        var list = items.map(function (it, i) { return (i + 1) + '. ' + it.name + ' ' + Number(it.amount || 0).toLocaleString() + '원'; }).join('\n');
        if (!confirm(items.length + '개 품목을 모두 추가할까요?\n\n' + list)) return;
        var today2 = new Date().toISOString().slice(0, 10);
        items.forEach(function (item) {
          records.push({
            id: Date.now() + Math.random(),
            date: item.date || today2,
            name: item.name || '품목',
            category: CATEGORIES.includes(item.category) ? item.category : CATEGORIES[0],
            amount: parseFloat(item.amount) || 0,
            memo: item.memo || ''
          });
        });
        await saveRecords(records);
        renderAll();
      }
    } catch (err) {
      showStatus('오류: ' + err.message);
      setTimeout(hideStatus, 4000);
    }
  };
  // ────────────────────────────────────────────────────────
  document.getElementById('cb-modal-close').onclick = function () { modal.style.display = 'none'; };
  document.getElementById('cb-modal-cancel').onclick = function () { modal.style.display = 'none'; };
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('cb-modal-save').onclick = async function () {
    var date   = document.getElementById('cb-f-date').value;
    var name   = document.getElementById('cb-f-name').value.trim();
    var cat    = document.getElementById('cb-f-cat').value;
    var amount = parseFloat(document.getElementById('cb-f-amount').value) || 0;
    var memo   = document.getElementById('cb-f-memo').value.trim();
    if (!date || !name || amount <= 0) { alert('날짜, 항목명, 금액을 입력하세요.'); return; }

    if (editId) {
      var idx = records.findIndex(function (r) { return r.id === editId; });
      if (idx >= 0) records[idx] = { id: editId, date: date, name: name, category: cat, amount: amount, memo: memo };
    } else {
      records.push({ id: Date.now(), date: date, name: name, category: cat, amount: amount, memo: memo });
    }
    await saveRecords(records);
    modal.style.display = 'none';
    renderAll();
  };

  // 예산 모달
  var bModal = document.getElementById('cb-budget-modal');
  document.getElementById('cb-budget-btn').onclick = function () {
    document.getElementById('cb-budget-input').value = budget || '';
    bModal.style.display = 'flex';
  };
  document.getElementById('cb-budget-cancel').onclick = function () { bModal.style.display = 'none'; };
  bModal.addEventListener('click', function (e) { if (e.target === bModal) bModal.style.display = 'none'; });
  document.getElementById('cb-budget-save').onclick = async function () {
    var val = parseFloat(document.getElementById('cb-budget-input').value) || 0;
    budget = val;
    await saveBudget(val);
    bModal.style.display = 'none';
    renderAll();
  };

  // 에듀파인 CSV 내보내기
  document.getElementById('cb-export-btn').onclick = function () {
    var filtered = getFiltered();
    if (!filtered.length) { alert('내보낼 데이터가 없습니다.'); return; }
    // 에듀파인 업로드 형식 (날짜, 지출과목, 금액, 적요)
    var rows = ['날짜,지출과목,금액,적요,비고'];
    filtered.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (r) {
      rows.push([r.date, r.category, r.amount, r.name, r.memo || ''].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(','));
    });
    // 합계행
    var total = filtered.reduce(function (s, r) { return s + r.amount; }, 0);
    rows.push(['"합계"', '""', '"' + total + '"', '""', '""'].join(','));

    var blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'edufine_budget_' + (document.getElementById('cb-month-filter').value || 'all') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 인쇄
  document.getElementById('cb-print-btn').onclick = function () {
    var filtered = getFiltered();
    var total = filtered.reduce(function (s, r) { return s + r.amount; }, 0);
    var rows = filtered.slice().sort(function (a, b) { return a.date.localeCompare(b.date); })
      .map(function (r) {
        return `<tr><td>${r.date}</td><td>${r.name}</td><td>${r.category}</td><td style="text-align:right">${formatWon(r.amount)}</td><td>${r.memo || ''}</td></tr>`;
      }).join('');
    var month = document.getElementById('cb-month-filter').value;
    var win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>학급운영비 내역</title>
      <style>body{font-family:'Malgun Gothic',sans-serif;padding:30px;font-size:13px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px 8px}
      th{background:#f5f5f5}tfoot td{font-weight:700}h2{text-align:center}</style></head>
      <body><h2>학급운영비 지출 내역 (${month})</h2>
      <table><thead><tr><th>날짜</th><th>항목</th><th>카테고리</th><th>금액</th><th>비고</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">합계</td><td style="text-align:right">${formatWon(total)}</td><td></td></tr></tfoot>
      </table><script>window.onload=function(){window.print()}<\/script></body></html>`);
    win.document.close();
  };

  document.getElementById('cb-cat-filter').onchange = renderAll;
  document.getElementById('cb-month-filter').onchange = renderAll;

  renderAll();
}

window.registerPage('class_budget', { render: render, init: init });
})();

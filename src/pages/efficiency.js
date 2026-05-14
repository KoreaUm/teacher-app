(function () {
'use strict';

// 기능별 기본 예상 절감 시간(분) 설정
var DEFAULT_CONFIG = {
  students:          { label: '학생 명단',   beforeMin: 5,  afterMin: 1 },
  attendance:        { label: '출석 관리',   beforeMin: 8,  afterMin: 2 },
  daily_memo:        { label: '학급 메모',   beforeMin: 5,  afterMin: 1 },
  timetable:         { label: '시간표 관리', beforeMin: 10, afterMin: 2 },
  counseling:        { label: '상담 일지',   beforeMin: 15, afterMin: 5 },
  observations:      { label: '관찰 기록',   beforeMin: 10, afterMin: 3 },
  lessons:           { label: '수업 지도',   beforeMin: 10, afterMin: 3 },
  assessments:       { label: '수행평가',    beforeMin: 12, afterMin: 4 },
  submissions:       { label: '제출물 관리', beforeMin: 8,  afterMin: 2 },
  statistics:        { label: '통계·출력',   beforeMin: 15, afterMin: 5 },
  ai_analysis:       { label: 'AI 분석',     beforeMin: 20, afterMin: 3 },
  todos:             { label: '할일 목록',   beforeMin: 5,  afterMin: 1 },
  official_document: { label: '공문서 작성', beforeMin: 20, afterMin: 5 },
  lesson_materials:  { label: '수업자료제작',beforeMin: 30, afterMin: 8 },
  school_calendar:   { label: '학사 일정',   beforeMin: 5,  afterMin: 1 },
  meal:              { label: '급식 메뉴',   beforeMin: 3,  afterMin: 0.5 }
};

var USAGE_PREFIX = 'usage_';
var CONFIG_KEY = 'efficiency_config';

function getYearMonth(date) {
  var d = date || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

async function loadConfig() {
  var raw = await api.getSetting(CONFIG_KEY, '');
  if (!raw) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  try {
    var saved = JSON.parse(raw);
    var merged = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    Object.keys(saved).forEach(function (k) {
      if (merged[k]) Object.assign(merged[k], saved[k]);
    });
    return merged;
  } catch (_) { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
}

async function saveConfig(cfg) {
  await api.setSetting(CONFIG_KEY, JSON.stringify(cfg));
}

async function loadUsage(ym) {
  var raw = await api.getSetting(USAGE_PREFIX + ym, '');
  if (!raw) return [];
  try { return JSON.parse(raw); } catch (_) { return []; }
}

async function loadUsageLast3Months() {
  var months = [];
  var now = new Date();
  for (var i = 0; i < 3; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(getYearMonth(d));
  }
  var results = await Promise.all(months.map(loadUsage));
  var combined = [];
  results.forEach(function (arr) { combined = combined.concat(arr); });
  return { months: months, byMonth: results };
}

function aggregateUsage(logs, config) {
  var stats = {};
  logs.forEach(function (entry) {
    if (!stats[entry.page]) stats[entry.page] = { count: 0, totalSec: 0 };
    stats[entry.page].count++;
    stats[entry.page].totalSec += (entry.durationSec || 0);
  });
  return stats;
}

function calcSaved(count, cfg) {
  return count * Math.max(0, cfg.beforeMin - cfg.afterMin);
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap" id="efficiency-root">
      <div class="page-header no-print">
        <h1 class="page-header-title">📊 업무 효율성 분석</h1>
      </div>

      <div class="no-print" style="display:flex;gap:8px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <select id="eff-month-sel" class="input" style="width:140px;font-size:13px">
        </select>
        <button class="btn btn-secondary btn-sm" id="eff-config-btn">⚙️ 시간 기준 설정</button>
        <button class="btn btn-primary btn-sm" id="eff-print-btn">🖨️ PDF 출력</button>
      </div>

      <div id="eff-content">
        <div style="color:var(--text3);text-align:center;padding:40px">불러오는 중...</div>
      </div>

      <!-- 설정 모달 -->
      <div id="eff-config-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9000;align-items:center;justify-content:center">
        <div style="background:var(--bg1);border-radius:12px;border:1px solid var(--border);padding:24px;width:560px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.35)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <strong style="font-size:15px">⚙️ 기능별 시간 기준 설정</strong>
            <button class="btn btn-secondary btn-xs" id="eff-config-close">✕</button>
          </div>
          <p style="font-size:12px;color:var(--text3);margin-bottom:12px">각 기능을 사용하기 전·후 예상 소요 시간을 분 단위로 입력하세요. 절감 시간 = (이전 - 이후) × 사용 횟수</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px" id="eff-config-table">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 4px">기능</th>
                <th style="text-align:center;padding:6px 4px">도입 전(분)</th>
                <th style="text-align:center;padding:6px 4px">도입 후(분)</th>
                <th style="text-align:center;padding:6px 4px">건당 절감</th>
              </tr>
            </thead>
            <tbody id="eff-config-tbody"></tbody>
          </table>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
            <button class="btn btn-secondary btn-sm" id="eff-config-reset">기본값 복원</button>
            <button class="btn btn-primary btn-sm" id="eff-config-save">저장</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function init() {
  var config = await loadConfig();

  // 월 선택 옵션 생성
  var sel = document.getElementById('eff-month-sel');
  var now = new Date();
  for (var i = 0; i < 6; i++) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    var ym = getYearMonth(d);
    var opt = document.createElement('option');
    opt.value = ym;
    opt.textContent = ym.replace('-', '년 ') + '월';
    sel.appendChild(opt);
  }

  async function renderContent() {
    var ym = sel.value;
    var logs = await loadUsage(ym);
    var stats = aggregateUsage(logs, config);

    var totalSavedMin = 0;
    var rows = Object.keys(DEFAULT_CONFIG).map(function (key) {
      var cfg = config[key] || DEFAULT_CONFIG[key];
      var s = stats[key] || { count: 0, totalSec: 0 };
      var saved = calcSaved(s.count, cfg);
      totalSavedMin += saved;
      var avgSec = s.count > 0 ? Math.round(s.totalSec / s.count) : 0;
      return { key: key, cfg: cfg, count: s.count, avgSec: avgSec, saved: saved };
    }).filter(function (r) { return r.count > 0 || true; });

    var totalUsed = Object.values(stats).reduce(function (a, s) { return a + s.count; }, 0);
    var totalSec = Object.values(stats).reduce(function (a, s) { return a + s.totalSec; }, 0);

    var el = document.getElementById('eff-content');

    // 인쇄용 헤더
    var printHeader = `
      <div class="print-only" style="margin-bottom:20px">
        <h2 style="text-align:center;font-size:18px;margin-bottom:4px">쌤포트 업무 효율성 분석 보고서</h2>
        <p style="text-align:center;font-size:13px;color:#666">${ym.replace('-', '년 ')}월 · 출력일: ${new Date().toLocaleDateString('ko-KR')}</p>
        <hr style="margin:12px 0">
      </div>`;

    // 요약 카드
    var summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px">
        <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:var(--primary)">${totalUsed}<span style="font-size:14px;font-weight:400">회</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">총 기능 사용 횟수</div>
        </div>
        <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#22c55e">${Math.round(totalSavedMin)}<span style="font-size:14px;font-weight:400">분</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">추정 절감 시간</div>
        </div>
        <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;text-align:center;padding:16px">
          <div style="font-size:28px;font-weight:700;color:#f59e0b">${Math.round(totalSavedMin / 60 * 10) / 10}<span style="font-size:14px;font-weight:400">시간</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:4px">월 절감 환산</div>
        </div>
      </div>`;

    // 기능별 상세 테이블
    var usedRows = rows.filter(function (r) { return r.count > 0; });
    var tableHtml = '';
    if (usedRows.length === 0) {
      tableHtml = `<div style="text-align:center;padding:32px;color:var(--text3)">이번 달 사용 기록이 없습니다.<br><span style="font-size:12px">앱을 사용하면 자동으로 기록됩니다.</span></div>`;
    } else {
      var tableRows = usedRows.sort(function (a, b) { return b.saved - a.saved; }).map(function (r) {
        var pct = totalSavedMin > 0 ? Math.round(r.saved / totalSavedMin * 100) : 0;
        var barW = Math.max(2, pct);
        var avgStr = r.avgSec >= 60
          ? Math.floor(r.avgSec / 60) + '분 ' + (r.avgSec % 60) + '초'
          : r.avgSec + '초';
        return `<tr style="border-bottom:1px solid var(--border)">
          <td style="padding:8px 6px;font-size:13px">${r.cfg.label}</td>
          <td style="padding:8px 6px;text-align:center;font-size:13px">${r.count}회</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px;color:var(--text3)">${r.count > 0 ? avgStr : '-'}</td>
          <td style="padding:8px 6px;text-align:center;font-size:12px;color:var(--text3)">${r.cfg.beforeMin}분→${r.cfg.afterMin}분</td>
          <td style="padding:8px 6px;text-align:center;font-size:13px;font-weight:600;color:#22c55e">${Math.round(r.saved)}분</td>
          <td style="padding:8px 6px;min-width:100px">
            <div style="background:var(--bg2);border-radius:4px;height:8px;overflow:hidden">
              <div style="background:var(--primary);width:${barW}%;height:100%;border-radius:4px"></div>
            </div>
          </td>
        </tr>`;
      }).join('');

      tableHtml = `
        <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:2px solid var(--border)">
                <th style="text-align:left;padding:8px 6px">기능</th>
                <th style="text-align:center;padding:8px 6px">사용 횟수</th>
                <th style="text-align:center;padding:8px 6px">평균 체류</th>
                <th style="text-align:center;padding:8px 6px">전·후 기준</th>
                <th style="text-align:center;padding:8px 6px">절감 시간</th>
                <th style="padding:8px 6px">비율</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
            <tfoot>
              <tr style="border-top:2px solid var(--border);background:var(--bg2)">
                <td colspan="4" style="padding:8px 6px;font-weight:600;font-size:13px">합계</td>
                <td style="padding:8px 6px;text-align:center;font-weight:700;color:#22c55e;font-size:14px">${Math.round(totalSavedMin)}분</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }

    // 도입 전·후 비교 섹션 (보고서용)
    var compareHtml = `
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;margin-top:16px;padding:16px">
        <div style="font-weight:600;font-size:14px;margin-bottom:12px">📋 도입 전·후 비교</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--bg2)">
              <th style="padding:8px;text-align:left;border:1px solid var(--border)">구분</th>
              <th style="padding:8px;text-align:center;border:1px solid var(--border)">도입 전</th>
              <th style="padding:8px;text-align:center;border:1px solid var(--border)">도입 후</th>
              <th style="padding:8px;text-align:center;border:1px solid var(--border)">절감</th>
            </tr>
          </thead>
          <tbody>
            ${usedRows.sort(function(a,b){return b.saved-a.saved;}).map(function(r){
              var totalBefore = r.count * r.cfg.beforeMin;
              var totalAfter = r.count * r.cfg.afterMin;
              return `<tr>
                <td style="padding:7px 8px;border:1px solid var(--border)">${r.cfg.label} (${r.count}회)</td>
                <td style="padding:7px 8px;text-align:center;border:1px solid var(--border);color:var(--text3)">${totalBefore}분</td>
                <td style="padding:7px 8px;text-align:center;border:1px solid var(--border)">${totalAfter}분</td>
                <td style="padding:7px 8px;text-align:center;border:1px solid var(--border);font-weight:600;color:#22c55e">▼ ${Math.round(r.saved)}분</td>
              </tr>`;
            }).join('')}
            <tr style="background:var(--bg2);font-weight:700">
              <td style="padding:8px;border:1px solid var(--border)">합계</td>
              <td style="padding:8px;text-align:center;border:1px solid var(--border);color:var(--text3)">${usedRows.reduce(function(a,r){return a+r.count*r.cfg.beforeMin;},0)}분</td>
              <td style="padding:8px;text-align:center;border:1px solid var(--border)">${usedRows.reduce(function(a,r){return a+r.count*r.cfg.afterMin;},0)}분</td>
              <td style="padding:8px;text-align:center;border:1px solid var(--border);color:#22c55e">▼ ${Math.round(totalSavedMin)}분 (${Math.round(totalSavedMin/60*10)/10}시간)</td>
            </tr>
          </tbody>
        </table>
        <p style="font-size:11px;color:var(--text3);margin-top:8px">※ 도입 전·후 소요 시간은 설정에서 조정 가능한 추정값입니다.</p>
      </div>`;

    el.innerHTML = printHeader + summaryHtml + tableHtml + (usedRows.length > 0 ? compareHtml : '');
  }

  sel.onchange = renderContent;
  await renderContent();

  // PDF 출력
  document.getElementById('eff-print-btn').onclick = function () {
    window.print();
  };

  // 설정 모달
  var modal = document.getElementById('eff-config-modal');
  document.getElementById('eff-config-btn').onclick = function () {
    renderConfigTable(config);
    modal.style.display = 'flex';
  };
  document.getElementById('eff-config-close').onclick = function () {
    modal.style.display = 'none';
  };
  modal.addEventListener('click', function (e) {
    if (e.target === modal) modal.style.display = 'none';
  });

  function renderConfigTable(cfg) {
    var tbody = document.getElementById('eff-config-tbody');
    tbody.innerHTML = Object.keys(DEFAULT_CONFIG).map(function (key) {
      var c = cfg[key] || DEFAULT_CONFIG[key];
      var saved = Math.max(0, c.beforeMin - c.afterMin);
      return `<tr data-key="${key}" style="border-bottom:1px solid var(--border)">
        <td style="padding:6px 4px;font-size:13px">${c.label}</td>
        <td style="padding:4px;text-align:center">
          <input type="number" class="input cfg-before" min="0" max="120" step="0.5" value="${c.beforeMin}" style="width:60px;text-align:center;font-size:13px;padding:3px 4px">
        </td>
        <td style="padding:4px;text-align:center">
          <input type="number" class="input cfg-after" min="0" max="120" step="0.5" value="${c.afterMin}" style="width:60px;text-align:center;font-size:13px;padding:3px 4px">
        </td>
        <td style="padding:4px;text-align:center;font-size:13px;color:#22c55e;font-weight:600" class="cfg-diff">${saved}분</td>
      </tr>`;
    }).join('');

    // 실시간 diff 업데이트
    tbody.querySelectorAll('input').forEach(function (inp) {
      inp.oninput = function () {
        var row = inp.closest('tr');
        var b = parseFloat(row.querySelector('.cfg-before').value) || 0;
        var a = parseFloat(row.querySelector('.cfg-after').value) || 0;
        row.querySelector('.cfg-diff').textContent = Math.max(0, b - a) + '분';
      };
    });
  }

  document.getElementById('eff-config-reset').onclick = function () {
    config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    renderConfigTable(config);
  };

  document.getElementById('eff-config-save').onclick = async function () {
    var tbody = document.getElementById('eff-config-tbody');
    tbody.querySelectorAll('tr[data-key]').forEach(function (row) {
      var key = row.getAttribute('data-key');
      if (!config[key]) config[key] = Object.assign({}, DEFAULT_CONFIG[key]);
      config[key].beforeMin = parseFloat(row.querySelector('.cfg-before').value) || 0;
      config[key].afterMin = parseFloat(row.querySelector('.cfg-after').value) || 0;
    });
    await saveConfig(config);
    modal.style.display = 'none';
    await renderContent();
  };
}

window.registerPage('efficiency', { render: render, init: init });
})();

(function () {
'use strict';

// ─── 나이스 CSV 컬럼 감지 헬퍼 ───────────────────────────────
var NEIS_COLUMN_ALIASES = {
  name:        ['이름', '성명', '학생이름', '학생성명'],
  number:      ['번호', '학번', '출석번호', '순번'],
  grade:       ['학년'],
  classNum:    ['반', '학급'],
  absences:    ['결석', '결석일수', '결석(일)', '결석일'],
  lates:       ['지각', '지각횟수', '지각(회)', '지각회'],
  earlyLeaves: ['조퇴', '조퇴횟수', '조퇴(회)', '조퇴회'],
  certified:   ['인정', '인정결석', '인정지각', '인정조퇴'],
  volunteerId: ['봉사활동번호', '봉사번호', 'id', 'ID', '연번'],
  volunteerName:['봉사활동명', '봉사명', '활동명'],
  volunteerDate:['봉사일', '활동일', '봉사일자', '활동일자'],
  volunteerHours:['봉사시간', '시간(h)', '시간'],
  volunteerOrg: ['봉사기관', '기관명', '기관']
};

function detectColumn(headers, aliases) {
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i].trim();
    for (var j = 0; j < aliases.length; j++) {
      if (h.includes(aliases[j])) return i;
    }
  }
  return -1;
}

function parseCSV(text) {
  var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
  if (!lines.length) return { headers: [], rows: [] };
  var headers = lines[0].split(',').map(function (h) { return h.replace(/^"|"$/g, '').trim(); });
  var rows = lines.slice(1).map(function (line) {
    var cols = [];
    var cur = '';
    var inQ = false;
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    cols.push(cur.trim());
    return cols;
  });
  return { headers: headers, rows: rows };
}

// ─── 분석 함수들 ─────────────────────────────────────────────

function analyzeAttendance(parsed) {
  var h = parsed.headers;
  var rows = parsed.rows;
  var colName    = detectColumn(h, NEIS_COLUMN_ALIASES.name);
  var colNumber  = detectColumn(h, NEIS_COLUMN_ALIASES.number);
  var colAbs     = detectColumn(h, NEIS_COLUMN_ALIASES.absences);
  var colLate    = detectColumn(h, NEIS_COLUMN_ALIASES.lates);
  var colEarly   = detectColumn(h, NEIS_COLUMN_ALIASES.earlyLeaves);

  if (colName < 0) return null;

  var issues = [];
  var stats = { total: rows.length, withAbsence: 0, withLate: 0, withEarly: 0, highRisk: 0 };

  rows.forEach(function (row, idx) {
    if (!row.length || row.every(function (c) { return !c; })) return;
    var name   = colName >= 0    ? (row[colName] || '') : '학생' + (idx + 1);
    var num    = colNumber >= 0  ? (row[colNumber] || '') : (idx + 1);
    var abs    = colAbs >= 0     ? parseInt(row[colAbs]) || 0 : 0;
    var late   = colLate >= 0    ? parseInt(row[colLate]) || 0 : 0;
    var early  = colEarly >= 0   ? parseInt(row[colEarly]) || 0 : 0;

    if (abs > 0) stats.withAbsence++;
    if (late > 0) stats.withLate++;
    if (early > 0) stats.withEarly++;

    // 오류 감지: 결석+지각+조퇴 합이 비정상적으로 많은 경우
    var total = abs + late + early;
    if (total > 30) {
      stats.highRisk++;
      issues.push({ type: 'high', name: name, num: num, abs: abs, late: late, early: early,
        msg: '출결 합계(' + total + '회)가 비정상적으로 많습니다.' });
    }
    // 결석이 등교일수보다 많은 경우 (학기당 100일 기준)
    if (abs > 100) {
      issues.push({ type: 'error', name: name, num: num, abs: abs, late: late, early: early,
        msg: '결석일수(' + abs + '일)가 학기 수업일수를 초과합니다.' });
    }
    // 지각·조퇴가 각각 50회 초과
    if (late > 50) {
      issues.push({ type: 'warn', name: name, num: num, abs: abs, late: late, early: early,
        msg: '지각(' + late + '회)이 50회를 초과합니다.' });
    }
    if (early > 50) {
      issues.push({ type: 'warn', name: name, num: num, abs: abs, late: late, early: early,
        msg: '조퇴(' + early + '회)가 50회를 초과합니다.' });
    }
  });

  return { type: 'attendance', stats: stats, issues: issues, headers: h, rows: rows,
    cols: { name: colName, number: colNumber, abs: colAbs, late: colLate, early: colEarly } };
}

function analyzeVolunteer(parsed) {
  var h = parsed.headers;
  var rows = parsed.rows;
  var colName  = detectColumn(h, NEIS_COLUMN_ALIASES.name);
  var colDate  = detectColumn(h, NEIS_COLUMN_ALIASES.volunteerDate);
  var colHours = detectColumn(h, NEIS_COLUMN_ALIASES.volunteerHours);
  var colOrg   = detectColumn(h, NEIS_COLUMN_ALIASES.volunteerOrg);

  if (colName < 0) return null;

  var issues = [];
  var byStudent = {};

  rows.forEach(function (row, idx) {
    if (!row.length || row.every(function (c) { return !c; })) return;
    var name  = row[colName] || '학생' + (idx + 1);
    var date  = colDate >= 0  ? row[colDate] : '';
    var hours = colHours >= 0 ? parseFloat(row[colHours]) || 0 : 0;
    var org   = colOrg >= 0   ? row[colOrg] : '';

    if (!byStudent[name]) byStudent[name] = [];
    byStudent[name].push({ date: date, hours: hours, org: org, rowIdx: idx });
  });

  // 중복 감지: 같은 날짜 + 같은 기관
  Object.keys(byStudent).forEach(function (name) {
    var entries = byStudent[name];
    var seen = {};
    entries.forEach(function (e) {
      var key = e.date + '|' + e.org;
      if (seen[key]) {
        issues.push({ type: 'error', name: name, date: e.date, org: e.org,
          msg: '중복 기재: ' + name + ' / ' + e.date + ' / ' + e.org });
      } else {
        seen[key] = true;
      }
    });
    // 하루 봉사 8시간 초과
    var byDate = {};
    entries.forEach(function (e) {
      byDate[e.date] = (byDate[e.date] || 0) + e.hours;
    });
    Object.keys(byDate).forEach(function (d) {
      if (byDate[d] > 8) {
        issues.push({ type: 'warn', name: name, date: d, org: '',
          msg: name + ' / ' + d + ' 하루 봉사 합계 ' + byDate[d] + 'h (8시간 초과)' });
      }
    });
  });

  var stats = {
    total: rows.length,
    students: Object.keys(byStudent).length,
    duplicates: issues.filter(function (i) { return i.type === 'error'; }).length,
    warnings: issues.filter(function (i) { return i.type === 'warn'; }).length
  };

  return { type: 'volunteer', stats: stats, issues: issues, headers: h, rows: rows, byStudent: byStudent };
}

function detectFileType(parsed) {
  var h = parsed.headers.join(' ');
  if (h.includes('봉사') || h.includes('봉사활동')) return 'volunteer';
  if (h.includes('결석') || h.includes('지각') || h.includes('출결')) return 'attendance';
  return 'unknown';
}

// ─── 렌더링 ─────────────────────────────────────────────────

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">🏫 나이스(NEIS) 데이터 도우미</h1>
      </div>

      <div class="sb-card" style="margin-bottom:16px;padding:16px">
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px">
          나이스에서 내려받은 <strong>출결 CSV</strong> 또는 <strong>봉사활동 CSV</strong> 파일을 불러오면 오류를 자동으로 검출합니다.
        </p>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label class="btn btn-primary btn-sm" style="cursor:pointer">
            📂 CSV 파일 불러오기
            <input type="file" id="neis-file-input" accept=".csv,.xls,.xlsx" style="display:none">
          </label>
          <span id="neis-file-name" style="font-size:12px;color:var(--text3)">파일을 선택하세요</span>
        </div>
        <div style="margin-top:10px;font-size:12px;color:var(--text3)">
          💡 나이스 → 학적 → 출결 → 학급별 출결현황 → CSV 저장 / 봉사활동 → 학급별 봉사활동 조회 → CSV 저장
        </div>
      </div>

      <div id="neis-result"></div>
    </div>
  `;
}

async function init() {
  var fileInput = document.getElementById('neis-file-input');
  var fileNameEl = document.getElementById('neis-file-name');
  var resultEl = document.getElementById('neis-result');

  fileInput.onchange = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    fileNameEl.textContent = file.name;
    var reader = new FileReader();
    reader.onload = function (ev) {
      var text = ev.target.result;
      processFile(text, file.name);
    };
    reader.readAsText(file, 'euc-kr');
  };

  function processFile(text, filename) {
    resultEl.innerHTML = '<div style="color:var(--text3);padding:16px">분석 중...</div>';
    setTimeout(function () {
      try {
        var parsed = parseCSV(text);
        if (!parsed.headers.length) {
          resultEl.innerHTML = '<div class="sb-card" style="color:#ef4444;padding:16px">CSV 파싱 실패: 파일 형식을 확인해주세요. (UTF-8 또는 EUC-KR 인코딩)</div>';
          return;
        }
        var fileType = detectFileType(parsed);
        var analysis = null;
        if (fileType === 'attendance') analysis = analyzeAttendance(parsed);
        else if (fileType === 'volunteer') analysis = analyzeVolunteer(parsed);

        if (!analysis) {
          // 자동 감지 실패 시 선택 UI
          resultEl.innerHTML = renderTypeSelect(parsed);
          document.getElementById('neis-type-attendance').onclick = function () {
            var a = analyzeAttendance(parsed);
            if (a) resultEl.innerHTML = renderAttendanceResult(a);
          };
          document.getElementById('neis-type-volunteer').onclick = function () {
            var a = analyzeVolunteer(parsed);
            if (a) resultEl.innerHTML = renderVolunteerResult(a);
          };
          return;
        }
        if (fileType === 'attendance') resultEl.innerHTML = renderAttendanceResult(analysis);
        else if (fileType === 'volunteer') resultEl.innerHTML = renderVolunteerResult(analysis);

        bindEditHandlers(analysis, parsed);
      } catch (err) {
        resultEl.innerHTML = '<div class="sb-card" style="color:#ef4444;padding:16px">오류: ' + err.message + '</div>';
      }
    }, 50);
  }

  function bindEditHandlers(analysis) {
    var exportBtn = document.getElementById('neis-export-btn');
    if (exportBtn) {
      exportBtn.onclick = function () { exportCSV(analysis); };
    }
  }
}

function renderTypeSelect(parsed) {
  return `
    <div class="sb-card" style="padding:16px">
      <p style="font-size:13px;margin-bottom:12px">파일 형식을 자동으로 감지하지 못했습니다. 분석 유형을 선택하세요.</p>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="neis-type-attendance">출결 분석</button>
        <button class="btn btn-secondary btn-sm" id="neis-type-volunteer">봉사활동 분석</button>
      </div>
      <div style="margin-top:12px;font-size:12px;color:var(--text3)">
        감지된 컬럼: ${parsed.headers.slice(0, 10).join(', ')}
      </div>
    </div>`;
}

function issueIcon(type) {
  return type === 'error' ? '🔴' : type === 'warn' ? '🟡' : '🟢';
}

function renderAttendanceResult(a) {
  var errorCount = a.issues.filter(function (i) { return i.type === 'error' || i.type === 'high'; }).length;
  var warnCount  = a.issues.filter(function (i) { return i.type === 'warn'; }).length;

  var summaryCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700">${a.stats.total}</div>
        <div style="font-size:11px;color:var(--text3)">전체 학생</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:#f59e0b">${a.stats.withAbsence}</div>
        <div style="font-size:11px;color:var(--text3)">결석 있음</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:#ef4444">${errorCount}</div>
        <div style="font-size:11px;color:var(--text3)">오류 감지</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:#f59e0b">${warnCount}</div>
        <div style="font-size:11px;color:var(--text3)">주의 항목</div>
      </div>
    </div>`;

  var issueHtml = '';
  if (a.issues.length === 0) {
    issueHtml = '<div class="sb-card" style="padding:16px;color:#22c55e;text-align:center;font-size:14px">✅ 오류가 감지되지 않았습니다.</div>';
  } else {
    issueHtml = `
      <div class="sb-card" style="margin-bottom:16px">
        <div style="padding:12px 16px;font-weight:600;border-bottom:1px solid var(--border)">⚠️ 감지된 문제 (${a.issues.length}건)</div>
        <div style="max-height:200px;overflow-y:auto">
          ${a.issues.map(function (issue) {
            return `<div style="padding:8px 16px;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:flex-start;gap:8px">
              <span>${issueIcon(issue.type)}</span>
              <span><strong>${issue.name}</strong> (${issue.num}번) — ${issue.msg}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // 전체 데이터 테이블 (수정 가능)
  var c = a.cols;
  var tableRows = a.rows.filter(function (r) { return r.length > 1; }).map(function (row, idx) {
    var name  = c.name >= 0   ? row[c.name] : '';
    var num   = c.number >= 0 ? row[c.number] : (idx + 1);
    var abs   = c.abs >= 0    ? parseInt(row[c.abs]) || 0 : 0;
    var late  = c.late >= 0   ? parseInt(row[c.late]) || 0 : 0;
    var early = c.early >= 0  ? parseInt(row[c.early]) || 0 : 0;
    var total = abs + late + early;
    var hasIssue = a.issues.some(function (i) { return i.name === name; });
    var bg = hasIssue ? 'background:#fff1f1' : '';
    return `<tr style="${bg}" data-idx="${idx}">
      <td style="padding:6px 8px;text-align:center;font-size:13px">${num}</td>
      <td style="padding:6px 8px;font-size:13px">${name}</td>
      <td style="padding:6px 8px;text-align:center">
        <input type="number" class="input neis-edit" data-col="${c.abs}" data-row="${idx}" value="${abs}" min="0" style="width:54px;text-align:center;font-size:12px;padding:2px 4px">
      </td>
      <td style="padding:6px 8px;text-align:center">
        <input type="number" class="input neis-edit" data-col="${c.late}" data-row="${idx}" value="${late}" min="0" style="width:54px;text-align:center;font-size:12px;padding:2px 4px">
      </td>
      <td style="padding:6px 8px;text-align:center">
        <input type="number" class="input neis-edit" data-col="${c.early}" data-row="${idx}" value="${early}" min="0" style="width:54px;text-align:center;font-size:12px;padding:2px 4px">
      </td>
      <td style="padding:6px 8px;text-align:center;font-size:13px;font-weight:600" class="neis-total">${total}</td>
    </tr>`;
  }).join('');

  var tableHtml = `
    <div class="sb-card" style="overflow:auto">
      <div style="padding:10px 16px;font-weight:600;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span>📋 출결 현황 (수정 가능)</span>
        <button class="btn btn-secondary btn-xs" id="neis-export-btn">⬇️ CSV 내보내기</button>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg2);border-bottom:1px solid var(--border)">
            <th style="padding:8px;text-align:center">번호</th>
            <th style="padding:8px;text-align:left">이름</th>
            <th style="padding:8px;text-align:center">결석(일)</th>
            <th style="padding:8px;text-align:center">지각(회)</th>
            <th style="padding:8px;text-align:center">조퇴(회)</th>
            <th style="padding:8px;text-align:center">합계</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  var html = summaryCards + issueHtml + tableHtml;

  setTimeout(function () {
    document.querySelectorAll('.neis-edit').forEach(function (inp) {
      inp.oninput = function () {
        var tr = inp.closest('tr');
        var inputs = tr.querySelectorAll('.neis-edit');
        var sum = 0;
        inputs.forEach(function (i) { sum += parseInt(i.value) || 0; });
        tr.querySelector('.neis-total').textContent = sum;
        // 수정된 행 하이라이트
        inp.style.background = '#fefce8';
      };
    });

    var exportBtn = document.getElementById('neis-export-btn');
    if (exportBtn) {
      exportBtn.onclick = function () {
        var rows = [a.headers.join(',')];
        document.querySelectorAll('tbody tr[data-idx]').forEach(function (tr, idx) {
          var origRow = a.rows[idx] ? a.rows[idx].slice() : [];
          tr.querySelectorAll('.neis-edit').forEach(function (inp) {
            var col = parseInt(inp.getAttribute('data-col'));
            if (col >= 0) origRow[col] = inp.value;
          });
          rows.push(origRow.join(','));
        });
        var blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a2 = document.createElement('a');
        a2.href = url;
        a2.download = 'neis_attendance_edited.csv';
        a2.click();
        URL.revokeObjectURL(url);
      };
    }
  }, 100);

  return html;
}

function renderVolunteerResult(a) {
  var html = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700">${a.stats.total}</div>
        <div style="font-size:11px;color:var(--text3)">전체 기록</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:var(--primary)">${a.stats.students}</div>
        <div style="font-size:11px;color:var(--text3)">학생 수</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:#ef4444">${a.stats.duplicates}</div>
        <div style="font-size:11px;color:var(--text3)">중복 기재</div>
      </div>
      <div class="sb-card" style="text-align:center;padding:12px">
        <div style="font-size:22px;font-weight:700;color:#f59e0b">${a.stats.warnings}</div>
        <div style="font-size:11px;color:var(--text3)">주의 항목</div>
      </div>
    </div>`;

  if (a.issues.length === 0) {
    html += '<div class="sb-card" style="padding:16px;color:#22c55e;text-align:center">✅ 중복 기재 및 오류가 없습니다.</div>';
  } else {
    html += `
      <div class="sb-card" style="margin-bottom:16px">
        <div style="padding:12px 16px;font-weight:600;border-bottom:1px solid var(--border)">⚠️ 감지된 문제 (${a.issues.length}건)</div>
        <div style="max-height:240px;overflow-y:auto">
          ${a.issues.map(function (issue) {
            return `<div style="padding:8px 16px;border-bottom:1px solid var(--border);font-size:13px;display:flex;gap:8px;align-items:flex-start">
              <span>${issueIcon(issue.type)}</span>
              <span>${issue.msg}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  // 학생별 집계 테이블
  var studentRows = Object.keys(a.byStudent).map(function (name) {
    var entries = a.byStudent[name];
    var totalHours = entries.reduce(function (s, e) { return s + e.hours; }, 0);
    var hasDup = a.issues.some(function (i) { return i.name === name && i.type === 'error'; });
    return `<tr style="${hasDup ? 'background:#fff1f1' : ''}">
      <td style="padding:7px 8px;font-size:13px">${name}</td>
      <td style="padding:7px 8px;text-align:center;font-size:13px">${entries.length}건</td>
      <td style="padding:7px 8px;text-align:center;font-size:13px;font-weight:600">${Math.round(totalHours * 10) / 10}h</td>
      <td style="padding:7px 8px;text-align:center;font-size:12px">${hasDup ? '🔴 중복' : '✅'}</td>
    </tr>`;
  }).join('');

  html += `
    <div class="sb-card" style="overflow:auto">
      <div style="padding:10px 16px;font-weight:600;border-bottom:1px solid var(--border)">👤 학생별 봉사활동 집계</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--bg2);border-bottom:1px solid var(--border)">
            <th style="padding:8px;text-align:left;font-size:13px">이름</th>
            <th style="padding:8px;text-align:center;font-size:13px">건수</th>
            <th style="padding:8px;text-align:center;font-size:13px">총 시간</th>
            <th style="padding:8px;text-align:center;font-size:13px">상태</th>
          </tr>
        </thead>
        <tbody>${studentRows}</tbody>
      </table>
    </div>`;

  return html;
}

window.registerPage('neis_helper', { render: render, init: init });
})();

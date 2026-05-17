(function () {
'use strict';

var SETTINGS_KEY = 'hwp_formatter_settings';

async function loadSettings() {
  var raw = await api.getSetting(SETTINGS_KEY, '');
  try { return raw ? JSON.parse(raw) : {}; } catch (_) { return {}; }
}

async function saveSettings(cfg) {
  await api.setSetting(SETTINGS_KEY, JSON.stringify(cfg));
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortPath(p) {
  if (!p) return '';
  var parts = String(p).split(/[\\/]/);
  return parts[parts.length - 1] || p;
}

async function render(container) {
  var cfg = await loadSettings();

  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📄 한글 자동 서식</h1>
        <p class="page-header-desc">학교 공문서 양식으로 자동 변환 (표지 + 본문 포맷)</p>
      </div>

      <!-- 사용법 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:18px">
        <div style="font-weight:600;margin-bottom:10px;font-size:14px">📋 사용 순서</div>
        <ol style="margin:0;padding-left:20px;line-height:2;color:var(--text2);font-size:13px">
          <li>한글에서 문서 작성 (첫 줄에 <b>문서 제목</b>)</li>
          <li><b>Ctrl+S</b>로 저장하고 한글을 <b>완전히 종료</b></li>
          <li>아래 <b>서식 적용</b> 클릭 → 저장한 파일 선택</li>
          <li>표지 + 본문 서식 자동 적용 후 한글에서 결과 확인</li>
        </ol>
      </div>

      <!-- 표지 설정 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:18px">
        <div style="font-weight:600;margin-bottom:14px;font-size:14px">🎨 표지 페이지 설정</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <!-- 좌측 상단 로고 -->
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">좌측 상단 로고</label>
            <div style="display:flex;gap:6px">
              <input type="text" id="hwpf-logo-left" class="input" readonly placeholder="선택 안 함"
                value="${escapeHtml(shortPath(cfg.logoLeft))}"
                data-fullpath="${escapeHtml(cfg.logoLeft || '')}"
                style="flex:1;font-size:12px;padding:6px 8px">
              <button class="btn btn-secondary btn-sm" data-pick="logoLeft">선택</button>
              <button class="btn btn-secondary btn-sm" data-clear="logoLeft">✕</button>
            </div>
          </div>

          <!-- 우측 상단 로고 -->
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">우측 상단 로고</label>
            <div style="display:flex;gap:6px">
              <input type="text" id="hwpf-logo-right" class="input" readonly placeholder="선택 안 함"
                value="${escapeHtml(shortPath(cfg.logoRight))}"
                data-fullpath="${escapeHtml(cfg.logoRight || '')}"
                style="flex:1;font-size:12px;padding:6px 8px">
              <button class="btn btn-secondary btn-sm" data-pick="logoRight">선택</button>
              <button class="btn btn-secondary btn-sm" data-clear="logoRight">✕</button>
            </div>
          </div>

          <!-- 하단 로고 -->
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">하단 중앙 로고 (예: 교육청)</label>
            <div style="display:flex;gap:6px">
              <input type="text" id="hwpf-logo-bottom" class="input" readonly placeholder="선택 안 함"
                value="${escapeHtml(shortPath(cfg.logoBottom))}"
                data-fullpath="${escapeHtml(cfg.logoBottom || '')}"
                style="flex:1;font-size:12px;padding:6px 8px">
              <button class="btn btn-secondary btn-sm" data-pick="logoBottom">선택</button>
              <button class="btn btn-secondary btn-sm" data-clear="logoBottom">✕</button>
            </div>
          </div>

          <!-- 컬러 막대 색상 -->
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">컬러 막대</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="color" id="hwpf-bar1" value="${escapeHtml(cfg.barColor1Hex || '#E8B4D6')}" style="width:40px;height:32px;border:1px solid var(--border);border-radius:6px;padding:2px">
              <input type="color" id="hwpf-bar2" value="${escapeHtml(cfg.barColor2Hex || '#C0CCE6')}" style="width:40px;height:32px;border:1px solid var(--border);border-radius:6px;padding:2px">
              <span style="font-size:11px;color:var(--text2)">2가지 색 막대</span>
            </div>
          </div>
        </div>

        <!-- 기관명/부서명 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">기관명 (예: ○○고등학교)</label>
            <input type="text" id="hwpf-org" class="input" placeholder="○○학교" value="${escapeHtml(cfg.orgName || '')}" style="width:100%;font-size:12px;padding:6px 8px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:4px">부서명 (예: 학생부)</label>
            <input type="text" id="hwpf-dept" class="input" placeholder="(생략 가능)" value="${escapeHtml(cfg.deptName || '')}" style="width:100%;font-size:12px;padding:6px 8px">
          </div>
        </div>

        <div style="margin-top:12px;display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm" id="hwpf-save-cfg">💾 설정 저장</button>
          <span id="hwpf-save-status" style="font-size:12px;color:var(--accent)"></span>
        </div>
      </div>

      <!-- 메인 실행 버튼 -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:28px;background:var(--card);border:2px solid var(--border);border-radius:16px;margin-bottom:18px">
        <div id="hwpf-status-icon" style="font-size:44px">📄</div>
        <div id="hwpf-status-text" style="font-size:13px;color:var(--text2);text-align:center">
          한글을 종료한 뒤 아래 버튼을 누르고 .hwp/.hwpx 파일을 선택하세요.
        </div>
        <button class="btn btn-primary" id="hwpf-apply-btn" style="font-size:15px;padding:12px 36px;border-radius:10px">
          ✨ 서식 적용하기
        </button>
        <div id="hwpf-spinner" style="display:none;font-size:13px;color:var(--accent)">
          ⏳ 적용 중...
        </div>
      </div>

      <!-- 결과 -->
      <div id="hwpf-result" style="display:none;margin-bottom:18px"></div>

      <!-- 주의사항 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:12px;color:var(--text2)">
        <div style="font-weight:600;color:var(--text1);margin-bottom:6px">⚠️ 주의</div>
        <ul style="margin:0;padding-left:18px;line-height:1.9">
          <li>Windows + 한글(HWP) 2018+ 필요</li>
          <li>적용 전 한글 프로그램 완전 종료</li>
          <li>첫 줄(문서 제목)이 표지로 사용됨</li>
          <li>로고는 PNG/JPG 권장 (투명 배경)</li>
        </ul>
      </div>
    </div>
  `;

  // 로고 선택 핸들러
  container.querySelectorAll('[data-pick]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var key = btn.getAttribute('data-pick');
      var r = await window.api.hwpPickLogo();
      if (r && r.ok && r.path) {
        var input = container.querySelector('#hwpf-logo-' + key.replace('logo', '').toLowerCase());
        if (input) {
          input.value = shortPath(r.path);
          input.setAttribute('data-fullpath', r.path);
        }
      }
    });
  });

  // 로고 제거
  container.querySelectorAll('[data-clear]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-clear');
      var input = container.querySelector('#hwpf-logo-' + key.replace('logo', '').toLowerCase());
      if (input) {
        input.value = '';
        input.setAttribute('data-fullpath', '');
      }
    });
  });

  // 설정 저장
  function collectCfg() {
    var hex1 = container.querySelector('#hwpf-bar1').value;
    var hex2 = container.querySelector('#hwpf-bar2').value;
    return {
      logoLeft:   container.querySelector('#hwpf-logo-left').getAttribute('data-fullpath') || '',
      logoRight:  container.querySelector('#hwpf-logo-right').getAttribute('data-fullpath') || '',
      logoBottom: container.querySelector('#hwpf-logo-bottom').getAttribute('data-fullpath') || '',
      orgName:    container.querySelector('#hwpf-org').value.trim(),
      deptName:   container.querySelector('#hwpf-dept').value.trim(),
      barColor1Hex: hex1,
      barColor2Hex: hex2,
      barColor1: hexToRgbString(hex1),
      barColor2: hexToRgbString(hex2),
    };
  }

  function hexToRgbString(hex) {
    var h = (hex || '').replace('#', '');
    if (h.length !== 6) return '232,180,214';
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ].join(',');
  }

  container.querySelector('#hwpf-save-cfg').addEventListener('click', async function () {
    await saveSettings(collectCfg());
    var st = container.querySelector('#hwpf-save-status');
    st.textContent = '저장됨 ✓';
    setTimeout(function () { st.textContent = ''; }, 2000);
  });

  // 메인 적용 버튼
  container.querySelector('#hwpf-apply-btn').addEventListener('click', async function () {
    var btn     = container.querySelector('#hwpf-apply-btn');
    var spinner = container.querySelector('#hwpf-spinner');
    var icon    = container.querySelector('#hwpf-status-icon');
    var statusText = container.querySelector('#hwpf-status-text');
    var resultDiv  = container.querySelector('#hwpf-result');

    var currentCfg = collectCfg();
    await saveSettings(currentCfg);   // 항상 최신 설정 저장

    btn.disabled = true;
    spinner.style.display = 'block';
    resultDiv.style.display = 'none';
    icon.textContent = '⏳';
    statusText.textContent = '파일을 열어 서식을 적용하는 중...';

    try {
      var result = await window.api.hwpApplyFormat(currentCfg);

      if (result && result.ok) {
        icon.textContent = '✅';
        statusText.textContent = '서식 적용 완료!';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;font-size:13px;color:#065f46">
            <b>✅ 완료!</b> ${result.blocks}개 단락/표 처리됨.
            ${result.warnings && result.warnings.length ? '<br><span style="font-size:11px">⚠ ' + result.warnings.length + '개 경고</span>' : ''}
          </div>`;
      } else if (result && result.canceled) {
        icon.textContent = '📄';
        statusText.textContent = '취소되었습니다.';
      } else {
        var errMsg = (result && result.error) ? result.error : '알 수 없는 오류';
        icon.textContent = '❌';
        statusText.textContent = '오류 발생';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px;font-size:13px;color:#991b1b">
            <b>❌ 오류</b><br>${escapeHtml(errMsg)}
          </div>`;
      }
    } catch (e) {
      icon.textContent = '❌';
      statusText.textContent = '연결 오류';
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `<div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px;font-size:13px;color:#991b1b"><b>❌</b> ${escapeHtml(String(e))}</div>`;
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  });
}

function init() {}

window.registerPage('hwp_formatter', { render: render, init: init });
})();

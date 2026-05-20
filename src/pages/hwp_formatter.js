(function () {
'use strict';

var DOC_TYPES = [
  '계획서', '결과보고서', '평가계획서', '품의서',
  '기안문', '공문(협조요청)', '가정통신문', '회의록', '연수보고서'
];

var EXAMPLE_MD = `제목: 2026. 중학교 자유학기제 현장지원단 운영 계획
부서: 중등교육과 중등교육팀

대제목: 관련 근거
◦ 2026. 주요업무계획 1-1-2 학생 주도성을 키우는 교육과정
◦ 충청북도교육과정 총론(충청북도교육청 고시 제2026-5호)
◦ 2026. 중학교 자유학기제 운영 기본 계획(중등교육과-1234, 2026. 2. 13.)

대제목: 추진 목적
◦ 2022 개정 교육과정의 취지를 반영한 학교 교육과정 편성·운영 활성화를 위한 교육청 차원의 지원 기반 마련
◦ 자유학기제 내실 운영을 통한 학생 진로탐색 역량 강화
◦ 학교 현장의 요구에 기반한 맞춤형 지원으로 정책 추진 실효성 제고

대제목: 추진 방침
◦ 중학교 교육과정 및 자유학기제 운영에 역량있는 교원으로 구성
◦ 교육과정 전문성 신장을 위한 역량 강화 워크숍 운영 및 단위학교 컨설팅 지원
◦ 현장 의견 수렴을 통한 교육청 차원의 지원 기반 마련

대제목: 세부 추진 계획
소제목: 현장지원단 조직 및 운영
◦ (기간) 2026. 4. ~ 2027. 2.
◦ (구성) 중학교 교육과정 및 자유학기제 운영에 역량있는 교원
◦ (주요 역할)
  - 교육과정 편성·운영에 대한 현장 의견 상시 모니터링
  - 단위학교 컨설팅 및 연수 지원
  - 교육과정 도움 자료 개발

소제목: 주요 추진 일정
표:
월 | 주요 내용 | 비고
4월 | 지원단 구성 및 발대식 | 도교육청
5~7월 | 단위학교 컨설팅 지원 | 지원단
8월 | 역량 강화 워크숍 2차 | 도교육청
10월 | 교육과정 편성표 검토 | 지원단

대제목: 기대 효과
◦ 자유학기제 내실 운영을 통한 학생 진로탐색 역량 강화
◦ 현장 지원 강화를 통한 교육과정 정책 안착 지원
`;

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render(container) {
  var savedMd = (await api.getSetting('hwp_md_draft', '')) || EXAMPLE_MD;
  var savedTopic = (await api.getSetting('hwp_topic', '')) || '';
  var savedType = (await api.getSetting('hwp_doctype', DOC_TYPES[0])) || DOC_TYPES[0];
  var savedSchool = (await api.getSetting('hwp_school', '')) || '';
  var savedLogo   = (await api.getSetting('hwp_logo_path', '')) || '';

  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📄 한글 자동 서식</h1>
        <p class="page-header-desc">마크다운으로 작성 → 한글 공문서 표준 서식으로 자동 변환</p>
      </div>

      <!-- 워크플로우 -->
      <div style="background:linear-gradient(135deg,#e0e7ff,#f3e8ff);border-radius:12px;padding:16px;margin-bottom:18px;font-size:12px;color:#4338ca">
        <b>📋 3가지 방법:</b>
        ① 주제만 입력 → <b>로컬 AI</b>로 자동 생성  ·
        ② 주제 입력 → <b>프롬프트 복사</b> → ChatGPT/Claude 활용  ·
        ③ 마크다운을 <b>직접 작성/편집</b>
      </div>

      <!-- Step 1: 주제 + 양식 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px">
        <div style="font-weight:600;font-size:14px;margin-bottom:10px">1️⃣ 주제 입력 + 양식 선택</div>
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <input id="hwpf-school" class="input" type="text" placeholder="부서/기관명 — 표지·본문 헤더에 자동 삽입 (예: 충청북도교육청 중등교육과)" value="${escapeHtml(savedSchool)}" style="flex:1;font-size:13px;padding:6px 8px;box-sizing:border-box">
        </div>
        <div style="margin-bottom:8px;display:flex;gap:8px;align-items:center">
          <button class="btn btn-secondary btn-sm" id="hwpf-logo-pick" style="white-space:nowrap;flex-shrink:0">🖼 학교 로고 선택</button>
          <span id="hwpf-logo-name" style="font-size:12px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">${savedLogo ? savedLogo.split(/[\\/]/).pop() : '선택된 로고 없음 (없으면 기관명만 표시)'}</span>
          <button class="btn btn-secondary btn-sm" id="hwpf-logo-clear" style="display:${savedLogo ? 'inline-block' : 'none'}">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:160px 1fr;gap:8px;margin-bottom:10px">
          <select id="hwpf-doctype" class="input" style="font-size:13px;padding:6px 8px">
            ${DOC_TYPES.map(t => `<option ${t === savedType ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
          </select>
          <input id="hwpf-topic" class="input" type="text" placeholder="예: 2026 학생 봉사활동 운영" value="${escapeHtml(savedTopic)}" style="font-size:13px;padding:6px 8px">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="hwpf-ai-gen">🤖 로컬 AI로 자동 생성</button>
          <button class="btn btn-secondary btn-sm" id="hwpf-copy-prompt">📋 GPT/Claude용 프롬프트 복사</button>
          <button class="btn btn-secondary btn-sm" id="hwpf-load-example">💡 예시 불러오기</button>
          <span id="hwpf-ai-status" style="font-size:12px;color:var(--text2);align-self:center"></span>
        </div>
      </div>

      <!-- Step 2: 마크다운 편집 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="font-weight:600;font-size:14px">2️⃣ 마크다운 작성/편집</div>
          <div style="font-size:11px;color:var(--text2)">
            <code>제목:</code> · <code>부제목:</code> · <code>부서:</code> · <code>대제목:</code> · <code>소제목:</code> · <code>◦ 항목</code> · <code>  - 세부항목</code> · <code>※ 주석</code> · <code>표:</code>
          </div>
        </div>
        <textarea id="hwpf-md" style="width:100%;min-height:320px;padding:12px;font-family:'D2Coding',Consolas,monospace;font-size:13px;line-height:1.6;border:1px solid var(--border);border-radius:8px;resize:vertical;background:#fafafa">${escapeHtml(savedMd)}</textarea>
        <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:11px;color:var(--text2)">
          <span>위계: 제목→부제목→부서→대제목(로마자 박스)→소제목(□)→◦항목→  -세부항목→※주석→표:</span>
          <span><span id="hwpf-md-count">0</span>자</span>
        </div>
      </div>

      <!-- Step 3: 한글 변환 -->
      <div style="background:var(--card);border:2px solid var(--border);border-radius:12px;padding:20px;margin-bottom:14px;display:flex;flex-direction:column;align-items:center;gap:12px">
        <div style="font-weight:600;font-size:14px">3️⃣ 한글 파일로 저장 + 서식 적용</div>
        <div id="hwpf-status-text" style="font-size:12px;color:var(--text2);text-align:center">
          위 마크다운을 한글 공문서 표준 서식으로 변환합니다.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn-primary" id="hwpf-build-hwpx" style="font-size:14px;padding:10px 28px;border-radius:10px;background:linear-gradient(135deg,#7c3aed,#4f46e5);border:0;color:#fff">
            🎨 깔끔 템플릿으로 hwpx 만들기 (한글 불필요·권장)
          </button>
          <button class="btn btn-secondary" id="hwpf-convert-text" style="font-size:13px;padding:8px 20px;border-radius:10px">
            ⚙️ 기존 PowerShell 방식 (한글 필요)
          </button>
          <button class="btn btn-secondary" id="hwpf-apply-existing" style="font-size:13px;padding:8px 20px;border-radius:10px">
            📂 기존 한글 파일에 서식 적용
          </button>
        </div>
        <div id="hwpf-spinner" style="display:none;font-size:13px;color:var(--accent)">⏳ 처리 중...</div>
      </div>

      <!-- 결과 -->
      <div id="hwpf-result" style="display:none;margin-bottom:14px"></div>

      <!-- 표준 안내 -->
      <details style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:12px;color:var(--text2);margin-bottom:10px">
        <summary style="cursor:pointer;font-weight:600;color:var(--text1)">📐 적용되는 서식 (충청북도교육청 현장지원단 운영 계획 스타일)</summary>
        <div style="margin-top:10px;line-height:1.9">
          • <b>대제목</b>: 남색(#18304B) 박스 + 흰색 로마자(Ⅰ,Ⅱ,Ⅲ…) + 파란 구분선 + 제목 텍스트<br>
          • <b>소제목</b>: □ 스타일, 굵은 본문<br>
          • <b>◦ 항목</b>: 수준1 불릿 (들여쓰기 적용)<br>
          • <b>  - 세부항목</b>: 수준2 대시 불릿<br>
          • <b>표</b>: 검정 테두리 + 첫 행 헤더 스타일<br>
          • <b>페이지</b>: A4 세로, 표준 여백
        </div>
      </details>

      <!-- 주의 -->
      <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px;font-size:12px;color:#92400e;margin-bottom:8px">
        ⚠️ <b>기존 PowerShell 방식</b>: Windows + 한글(HWP) 2018+ 필요 · 적용 전 한글 프로그램 완전 종료
      </div>
      <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:12px;font-size:12px;color:#1e40af">
        🎨 <b>깔끔 템플릿으로 hwpx 만들기 (권장)</b>: 한글 프로그램 불필요. <b>Python 3.8+ 설치 필요</b> (Windows에서 Python 미설치 시 Microsoft Store에서 "Python" 검색 후 설치)
      </div>
    </div>
  `;

  var ta       = container.querySelector('#hwpf-md');
  var topicEl  = container.querySelector('#hwpf-topic');
  var typeEl   = container.querySelector('#hwpf-doctype');
  var schoolEl = container.querySelector('#hwpf-school');
  var statusEl = container.querySelector('#hwpf-ai-status');
  var statusText = container.querySelector('#hwpf-status-text');
  var resultDiv  = container.querySelector('#hwpf-result');
  var spinner    = container.querySelector('#hwpf-spinner');
  var mdCount    = container.querySelector('#hwpf-md-count');
  var logoNameEl = container.querySelector('#hwpf-logo-name');
  var logoClearBtn = container.querySelector('#hwpf-logo-clear');
  var currentLogoPath = savedLogo;

  function buildMdWithSchool() {
    var school = schoolEl.value.trim();
    var md = ta.value.trim();
    if (!school) return md;
    // 기존 부서: 줄이 있으면 학교명으로 교체
    if (/^\s*(기관|학교|기관명|학교명|소속|부서)\s*[:：]/m.test(md)) {
      return md.replace(/^(\s*(기관|학교|기관명|학교명|소속|부서)\s*[:：]).*/m, '$1 ' + school);
    }
    // 없으면 제목: 줄 바로 다음에 삽입
    var lines = md.split('\n');
    for (var i = 0; i < lines.length; i++) {
      if (/^\s*제목\s*[:：]/.test(lines[i])) {
        lines.splice(i + 1, 0, '부서: ' + school);
        return lines.join('\n');
      }
    }
    return '부서: ' + school + '\n' + md;
  }

  function updateCount() { mdCount.textContent = ta.value.length.toLocaleString(); }
  updateCount();

  ta.addEventListener('input', function () {
    updateCount();
    api.setSetting('hwp_md_draft', ta.value);
  });
  topicEl.addEventListener('input', function () { api.setSetting('hwp_topic', topicEl.value); });
  typeEl.addEventListener('change', function () { api.setSetting('hwp_doctype', typeEl.value); });
  schoolEl.addEventListener('input', function () { api.setSetting('hwp_school', schoolEl.value); });

  // 로고 파일 선택
  container.querySelector('#hwpf-logo-pick').addEventListener('click', async function () {
    var res = await window.api.showOpenDialog({
      title: '학교 로고 이미지 선택',
      filters: [{ name: '이미지', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }],
      properties: ['openFile']
    });
    if (!res || res.canceled || !res.filePaths || !res.filePaths[0]) return;
    currentLogoPath = res.filePaths[0];
    var fname = currentLogoPath.split(/[\\/]/).pop();
    logoNameEl.textContent = fname;
    logoClearBtn.style.display = 'inline-block';
    api.setSetting('hwp_logo_path', currentLogoPath);
  });

  // 로고 초기화
  logoClearBtn.addEventListener('click', function () {
    currentLogoPath = '';
    logoNameEl.textContent = '선택된 로고 없음 (없으면 기관명만 표시)';
    logoClearBtn.style.display = 'none';
    api.setSetting('hwp_logo_path', '');
  });

  // 예시 불러오기
  container.querySelector('#hwpf-load-example').addEventListener('click', function () {
    ta.value = EXAMPLE_MD;
    updateCount();
    api.setSetting('hwp_md_draft', EXAMPLE_MD);
  });

  // 프롬프트 복사
  container.querySelector('#hwpf-copy-prompt').addEventListener('click', async function () {
    var r = await window.api.hwpBuildPrompt({ topic: topicEl.value.trim(), docType: typeEl.value });
    if (r && r.ok) {
      try {
        await navigator.clipboard.writeText(r.prompt);
        statusEl.textContent = '✓ 복사됨! GPT/Claude에 붙여넣으세요';
        statusEl.style.color = '#059669';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
      } catch (e) {
        statusEl.textContent = '복사 실패: ' + e.message;
        statusEl.style.color = '#dc2626';
      }
    }
  });

  // 로컬 AI 생성
  container.querySelector('#hwpf-ai-gen').addEventListener('click', async function () {
    var topic = topicEl.value.trim();
    if (!topic) {
      statusEl.textContent = '⚠ 주제를 먼저 입력하세요';
      statusEl.style.color = '#dc2626';
      return;
    }
    var btn = container.querySelector('#hwpf-ai-gen');
    btn.disabled = true;
    statusEl.textContent = '🤖 로컬 AI 생성 중... (수십 초 걸릴 수 있음)';
    statusEl.style.color = 'var(--accent)';

    try {
      var r = await window.api.hwpGenerateMarkdown({ topic: topic, docType: typeEl.value });
      if (r && r.ok && r.markdown) {
        ta.value = r.markdown;
        updateCount();
        api.setSetting('hwp_md_draft', r.markdown);
        statusEl.textContent = '✓ 생성 완료 (' + (r.model || '') + ')';
        statusEl.style.color = '#059669';
      } else {
        statusEl.textContent = '❌ ' + (r.error || '생성 실패');
        statusEl.style.color = '#dc2626';
      }
    } catch (e) {
      statusEl.textContent = '❌ ' + String(e);
      statusEl.style.color = '#dc2626';
    } finally {
      btn.disabled = false;
    }
  });

  function showResult(result) {
    resultDiv.style.display = 'block';
    if (result && result.ok) {
      statusText.textContent = '서식 적용 완료!';
      var detail = result.savedTo
        ? '저장: ' + escapeHtml(result.savedTo)
        : (result.blocks ? result.blocks + '개 단락/표 처리됨' : '');
      resultDiv.innerHTML = `
        <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;font-size:13px;color:#065f46">
          <b>✅ 완료!</b>${detail ? '<br><span style="font-size:11px">' + detail + '</span>' : ''}
        </div>`;
    } else if (result && result.canceled) {
      resultDiv.style.display = 'none';
    } else {
      var errMsg = (result && result.error) ? result.error : '알 수 없는 오류';
      statusText.textContent = '오류 발생';
      resultDiv.innerHTML = `
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px;font-size:13px;color:#991b1b">
          <b>❌ 오류</b><br>${escapeHtml(errMsg)}
        </div>`;
    }
  }

  // 깔끔 템플릿 hwpx 빌드 (한글 불필요)
  container.querySelector('#hwpf-build-hwpx').addEventListener('click', async function () {
    var md = buildMdWithSchool();
    if (!md) { alert('마크다운을 작성해주세요.'); return; }
    var btn = container.querySelector('#hwpf-build-hwpx');
    btn.disabled = true; spinner.style.display = 'block'; resultDiv.style.display = 'none';
    statusText.textContent = '템플릿으로 hwpx 생성 중...';
    try {
      var r = await window.api.hwpBuildHwpx({ markdownText: md, logoPath: currentLogoPath || '' });
      showResult(r);
    } catch (e) {
      showResult({ ok: false, error: String(e) });
    } finally {
      btn.disabled = false; spinner.style.display = 'none';
    }
  });

  // 마크다운 → 한글 변환
  container.querySelector('#hwpf-convert-text').addEventListener('click', async function () {
    var md = buildMdWithSchool();
    if (!md) { alert('마크다운을 작성해주세요.'); return; }
    var btn = container.querySelector('#hwpf-convert-text');
    btn.disabled = true; spinner.style.display = 'block'; resultDiv.style.display = 'none';
    statusText.textContent = '한글 파일 생성 및 서식 적용 중...';
    try {
      var r = await window.api.hwpFormatFromText(md);
      showResult(r);
    } catch (e) {
      showResult({ ok: false, error: String(e) });
    } finally {
      btn.disabled = false; spinner.style.display = 'none';
    }
  });

  // 기존 한글 파일에 적용
  container.querySelector('#hwpf-apply-existing').addEventListener('click', async function () {
    var btn = container.querySelector('#hwpf-apply-existing');
    btn.disabled = true; spinner.style.display = 'block'; resultDiv.style.display = 'none';
    statusText.textContent = '파일 선택 후 적용 중...';
    try {
      var r = await window.api.hwpApplyFormat();
      showResult(r);
    } catch (e) {
      showResult({ ok: false, error: String(e) });
    } finally {
      btn.disabled = false; spinner.style.display = 'none';
    }
  });
}

function init() {}

window.registerPage('hwp_formatter', { render: render, init: init });
})();

(function () {
'use strict';

var DOC_TYPES = [
  '계획서', '결과보고서', '평가계획서', '품의서',
  '기안문', '공문(협조요청)', '가정통신문', '회의록', '연수보고서'
];

var EXAMPLE_MD = `제목: 충남도-청년센터 청년정책 간담회 개최 계획
서론: 도-청년센터 간 협력체계 강화 및 청년정책 현장 의견 수렴 필요에 따라 정책 간담회 개최 추진함

대제목: 6: 학생 봉사활동 절차와 방법
중제목번호: 1: 학교교육계획에 의한 봉사활동 절차

네모: 간담회 개요
원: 때 와 곳: 2026. 03. 09.(월) 14:00 ~ 15:00 / 충남도청 중회의실
원: 참석대상: 충남도 관계자, 청년센터 관계자 등 15명
원: 주요내용: 충남 청년정책 추진현황 공유 및 청년센터 협력방안 논의 추진
바: 충남 청년정책 추진 현황 공유 및 정책 방향 설명
바: 청년센터 현장 의견 수렴 및 협력사업 발굴 검토
별: 청년정책 추진체계 강화 및 도-청년센터 협력 네트워크 구축 필요

네모: 세부 일정
시간계획표: 14:00:14:10: 참석자 소개 및 인사 : 사회자
시간계획표: 14:10:14:35: 청년정책 추진현황 공유 : 담당자
시간계획표: 14:35:14:55: 협력방안 논의 및 의견 수렴 : 참석자
시간계획표: 14:55:15:00: 마무리 : 사회자

네모: 협조 사항
원: 회의자료 사전 준비 및 참석자 안내 철저
원: 간담회 결과 정리 후 향후 협력사업 검토 자료로 활용

붙임: 2: 2015 개정 교육과정의 봉사활동 내용(중·고등학교 3학년 적용)
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
        <div style="margin-bottom:8px">
          <input id="hwpf-school" class="input" type="text" placeholder="학교(기관)명 — 표지 상단/하단에 자동 삽입 (예: ○○중학교)" value="${escapeHtml(savedSchool)}" style="width:100%;font-size:13px;padding:6px 8px;box-sizing:border-box">
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
            <code>기관:</code> · <code>제목:</code> · <code>서론:</code> · <code>붙임:N:제목</code> · <code>대제목:N:제목</code> · <code>중제목번호:N:제목</code> · <code>네모:</code> · <code>원/바/별:</code> · <code>당구:</code> · <code>주석:</code> · <code>시간계획표:</code>
          </div>
        </div>
        <textarea id="hwpf-md" style="width:100%;min-height:320px;padding:12px;font-family:'D2Coding',Consolas,monospace;font-size:13px;line-height:1.6;border:1px solid var(--border);border-radius:8px;resize:vertical;background:#fafafa">${escapeHtml(savedMd)}</textarea>
        <div style="margin-top:6px;display:flex;justify-content:space-between;font-size:11px;color:var(--text2)">
          <span>위계: 기관→제목→[붙임/대제목/중제목번호 박스]→서론→네모(□)→원(ㅇ)→바(-)→별(￭)→당구(※)→주석(*)→시간계획표</span>
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
        <summary style="cursor:pointer;font-weight:600;color:var(--text1)">📐 적용되는 공문서 표준 (행정안전부 「행정업무운영 편람」)</summary>
        <div style="margin-top:10px;line-height:1.9">
          • <b>본문 폰트</b>: 함초롬바탕 15pt<br>
          • <b>줄간격</b>: 160%<br>
          • <b>들여쓰기</b>: 단계마다 1자(2타)씩<br>
          • <b>항목 단계</b>: 1. → 가. → 1) → 가) → (1) → (가)<br>
          • <b>글머리 4단계</b>: □ → ○ → - → ·<br>
          • <b>표지</b>: 기관명(상단) · 주황바 · 대제목 · 남색바 · 연도+기관명(하단) — 행안부 업무계획 스타일<br>
          • <b>표</b>: 검정 테두리 + 첫 행 남색(#003087) 배경 + 흰 글씨<br>
          • <b>마크다운 정리</b>: **굵게** 마커 자동 제거
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

  function buildMdWithSchool() {
    var school = schoolEl.value.trim();
    var md = ta.value.trim();
    if (!school) return md;
    // 이미 기관: 태그가 있으면 앞에 추가하지 않음
    if (/^\s*(기관|학교|기관명|학교명|소속|부서)\s*[:：]/m.test(md)) return md;
    return '기관: ' + school + '\n' + md;
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
      resultDiv.innerHTML = `
        <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;font-size:13px;color:#065f46">
          <b>✅ 완료!</b> ${result.blocks || 0}개 단락/표 처리됨${result.savedTo ? '<br><span style="font-size:11px">저장: ' + escapeHtml(result.savedTo) + '</span>' : ''}
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
      var r = await window.api.hwpBuildHwpx(md);
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

(function () {
'use strict';

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📄 한글 자동 서식</h1>
        <p class="page-header-desc">ChatGPT/Claude 마크다운이나 일반 텍스트를 한국 공문서 서식으로 자동 변환</p>
      </div>

      <!-- 워크플로우 안내 -->
      <div style="background:linear-gradient(135deg,#e0e7ff,#f3e8ff);border-radius:12px;padding:18px;margin-bottom:18px">
        <div style="font-weight:600;margin-bottom:10px;font-size:14px">💡 추천 워크플로우</div>
        <div style="display:flex;gap:12px;align-items:center;font-size:12px;color:#4b5563;flex-wrap:wrap">
          <div style="background:#fff;padding:8px 14px;border-radius:20px;border:1px solid #c7d2fe">1️⃣ ChatGPT/Claude에 마크다운으로 받기</div>
          <span>→</span>
          <div style="background:#fff;padding:8px 14px;border-radius:20px;border:1px solid #c7d2fe">2️⃣ 한글에 붙여넣고 저장</div>
          <span>→</span>
          <div style="background:#fff;padding:8px 14px;border-radius:20px;border:1px solid #c7d2fe">3️⃣ 쌤포트에서 서식 적용</div>
          <span>→</span>
          <div style="background:#fff;padding:8px 14px;border-radius:20px;border:1px solid #c7d2fe">4️⃣ 깔끔한 공문서 완성</div>
        </div>
      </div>

      <!-- 지원 구문 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
        <!-- 마크다운 -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:#7c3aed">📝 마크다운 구문 (AI 출력 그대로)</div>
          <pre style="background:#f9fafb;border-radius:6px;padding:10px;font-size:11px;line-height:1.6;margin:0;overflow-x:auto;color:#1f2937"># 대제목
## 중제목 (→ 1.)
### 소제목 (→ 가.)
- 1단계 글머리 (→ □)
  - 2단계 (→ ○)
    - 3단계 (→ -)
      - 4단계 (→ ·)
**굵게**

| 시간 | 활동 |
|------|------|
| 09:00 | 집결 |</pre>
        </div>

        <!-- 한국 공문 -->
        <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px">
          <div style="font-weight:600;font-size:13px;margin-bottom:10px;color:#0891b2">📋 한국 공문 표시 체계</div>
          <pre style="background:#f9fafb;border-radius:6px;padding:10px;font-size:11px;line-height:1.6;margin:0;overflow-x:auto;color:#1f2937">1. 대제목 (→ ##)
가. 중제목 (→ ###)
1) 소제목 (→ ####)
가) 항
(1) 호
(가) 목

□ 1단계 글머리
○ 2단계 글머리
- 3단계 글머리
· 4단계 글머리
※ 참고/주의</pre>
        </div>
      </div>

      <!-- 자동 적용되는 것들 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:18px">
        <div style="font-weight:600;margin-bottom:12px;font-size:14px">✨ 행정안전부 「행정업무운영 편람」 기준 자동 서식</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;font-size:12px;color:var(--text2)">
          <div>📐 <b>위계 자동 감지</b><br>1. → 가. → 1) → 가) → (1) → (가)</div>
          <div>🔤 <b>폰트 표준화</b><br>함초롬바탕 15pt (편람 권고)</div>
          <div>📏 <b>들여쓰기 자동</b><br>단계마다 1자(2타)씩 들여쓰기</div>
          <div>📊 <b>표 자동 서식</b><br>테두리 + 헤더 회색 배경</div>
          <div>📝 <b>줄간격 160%</b><br>한컴 정부 공문서 기본값</div>
          <div>🧹 <b>마크다운 정리</b><br>**굵게** 마커 자동 제거</div>
        </div>
      </div>

      <!-- 사용 순서 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:18px">
        <div style="font-weight:600;margin-bottom:10px;font-size:14px">📋 사용 순서</div>
        <ol style="margin:0;padding-left:20px;line-height:2;color:var(--text2);font-size:13px">
          <li>한글에서 텍스트 작성 (마크다운 또는 한국 공문 형식)</li>
          <li><b>Ctrl+S</b>로 .hwp 또는 .hwpx 저장</li>
          <li>한글 프로그램 <b>완전 종료</b> (파일 잠금 방지)</li>
          <li>아래 <b>서식 적용</b> 클릭 → 저장한 파일 선택</li>
          <li>한글에서 결과 확인 (자동 열림)</li>
        </ol>
      </div>

      <!-- 메인 버튼 -->
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

      <!-- 주의 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;font-size:12px;color:var(--text2)">
        <div style="font-weight:600;color:var(--text1);margin-bottom:6px">⚠️ 주의</div>
        <ul style="margin:0;padding-left:18px;line-height:1.9">
          <li>Windows + 한글(HWP) 2018+ 필요</li>
          <li>적용 전 한글 프로그램 완전 종료</li>
          <li>기존 서식은 모두 초기화되고 새로 적용됨 (Ctrl+Z로 한글에서 되돌리기 가능)</li>
          <li>표지 페이지 자동 생성은 제거됨 (양식 파일 직접 활용 권장)</li>
        </ul>
      </div>
    </div>
  `;

  container.querySelector('#hwpf-apply-btn').addEventListener('click', async function () {
    var btn     = container.querySelector('#hwpf-apply-btn');
    var spinner = container.querySelector('#hwpf-spinner');
    var icon    = container.querySelector('#hwpf-status-icon');
    var statusText = container.querySelector('#hwpf-status-text');
    var resultDiv  = container.querySelector('#hwpf-result');

    btn.disabled = true;
    spinner.style.display = 'block';
    resultDiv.style.display = 'none';
    icon.textContent = '⏳';
    statusText.textContent = '파일을 열어 서식을 적용하는 중...';

    try {
      var result = await window.api.hwpApplyFormat();

      if (result && result.ok) {
        icon.textContent = '✅';
        statusText.textContent = '서식 적용 완료!';
        var typeLabel = {
          'markdown': '마크다운',
          'korean-roman': '한국 공문 (Ⅰ 기준)',
          'korean-num': '한국 공문 (1. 기준)'
        }[result.inputType] || '자동 감지';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:14px;font-size:13px;color:#065f46">
            <b>✅ 완료!</b> ${result.blocks}개 단락/표 처리됨 (입력 형식: ${escapeHtml(typeLabel)})
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

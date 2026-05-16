(function () {
'use strict';

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📄 한글 자동 서식</h1>
        <p class="page-header-desc">열려있는 한글 문서에 학교 공문 스타일을 자동으로 적용합니다.</p>
      </div>

      <!-- 사용법 안내 카드 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-weight:600;margin-bottom:12px;font-size:14px">📋 사용 순서</div>
        <ol style="margin:0;padding-left:20px;line-height:2;color:var(--text2);font-size:13px">
          <li>한글(HWP) 프로그램을 열고 서식을 적용할 문서를 엽니다</li>
          <li>문서에 일반 텍스트 형태로 내용을 작성합니다 <span style="color:var(--accent)">(아래 예시 참고)</span></li>
          <li>아래 <b>서식 적용</b> 버튼을 클릭합니다</li>
          <li>한글 문서에 자동으로 스타일이 적용됩니다 ✨</li>
        </ol>
      </div>

      <!-- 자동 감지 스타일 안내 -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:20px">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">1️⃣</div>
          <div style="font-size:12px;font-weight:600">대제목 자동 감지</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">예: <code>1. 목적</code></div>
          <div style="font-size:11px;color:var(--text2)">HY헤드라인M · 15pt · 굵게</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">🅰️</div>
          <div style="font-size:12px;font-weight:600">소제목 자동 감지</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">예: <code>가. 방침</code></div>
          <div style="font-size:11px;color:var(--text2)">HY견고딕 · 12pt</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">📝</div>
          <div style="font-size:12px;font-weight:600">본문 자동 감지</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">일반 텍스트</div>
          <div style="font-size:11px;color:var(--text2)">맑은고딕 · 10pt</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:20px;margin-bottom:6px">📊</div>
          <div style="font-size:12px;font-weight:600">표 자동 감지</div>
          <div style="font-size:11px;color:var(--text2);margin-top:4px">열이 여러 개인 행</div>
          <div style="font-size:11px;color:var(--text2)">한글 표로 자동 변환</div>
        </div>
      </div>

      <!-- 예시 보기 토글 -->
      <div style="margin-bottom:20px">
        <button class="btn btn-secondary btn-sm" id="hwpf-toggle-example">
          💡 입력 예시 보기 / 숨기기
        </button>
        <div id="hwpf-example" style="display:none;margin-top:12px">
          <pre style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:12px;line-height:1.8;overflow-x:auto;white-space:pre-wrap">1. 목적
가. 학생 간부들의 리더십 및 공동체 의식을 함양한다.
나. 학생자치활동의 활성화 및 학교 문화 개선 방안을 모색한다.

2. 방침
가. 학생 중심의 참여형 프로그램으로 운영한다.

3. 개요
행사명 : 2026학년도 학생 간부수련회
일시 : 2026년 ○월 ○일

4. 세부 일정
시간  내용  비고
08:30 ~ 09:00  집결 및 출석 확인  학교 운동장
09:00 ~ 12:00  팀빌딩 활동  강당</pre>
        </div>
      </div>

      <!-- 메인 버튼 영역 -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:30px;background:var(--card);border:2px solid var(--border);border-radius:16px;margin-bottom:20px">
        <div id="hwpf-status-icon" style="font-size:48px">📄</div>
        <div id="hwpf-status-text" style="font-size:14px;color:var(--text2);text-align:center">
          한글 프로그램을 열고 문서를 준비한 뒤<br>아래 버튼을 누르세요.
        </div>
        <button class="btn btn-primary" id="hwpf-apply-btn" style="font-size:15px;padding:12px 36px;border-radius:10px">
          ✨ 서식 적용하기
        </button>
        <div id="hwpf-spinner" style="display:none;font-size:13px;color:var(--accent)">
          ⏳ 한글 문서에 서식을 적용하는 중...
        </div>
      </div>

      <!-- 결과 / 오류 메시지 -->
      <div id="hwpf-result" style="display:none"></div>

      <!-- 주의사항 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:12px;color:var(--text2)">
        <div style="font-weight:600;color:var(--text1);margin-bottom:8px">⚠️ 주의사항</div>
        <ul style="margin:0;padding-left:18px;line-height:1.9">
          <li>Windows 전용 기능입니다 (Mac에서는 동작하지 않습니다)</li>
          <li>한글(HWP) 프로그램이 PC에 설치되어 있어야 합니다</li>
          <li>별도 설치 없이 Windows 내장 PowerShell을 사용합니다</li>
          <li>서식 적용 시 <b>기존 서식은 초기화</b>되고 새로 적용됩니다</li>
          <li>적용 전 한글에서 <b>저장(Ctrl+S)</b>을 먼저 해두세요</li>
        </ul>
      </div>
    </div>
  `;

  // 예시 토글
  document.getElementById('hwpf-toggle-example').addEventListener('click', function () {
    var ex = document.getElementById('hwpf-example');
    ex.style.display = ex.style.display === 'none' ? 'block' : 'none';
  });

  // 서식 적용 버튼
  document.getElementById('hwpf-apply-btn').addEventListener('click', async function () {
    var btn     = document.getElementById('hwpf-apply-btn');
    var spinner = document.getElementById('hwpf-spinner');
    var icon    = document.getElementById('hwpf-status-icon');
    var statusText = document.getElementById('hwpf-status-text');
    var resultDiv  = document.getElementById('hwpf-result');

    btn.disabled = true;
    spinner.style.display = 'block';
    resultDiv.style.display = 'none';
    icon.textContent = '⏳';
    statusText.textContent = '한글 문서를 분석하는 중입니다...';

    try {
      var result = await window.api.hwpApplyFormat();

      if (result && result.ok) {
        icon.textContent = '✅';
        statusText.textContent = '서식 적용 완료!';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:16px;font-size:13px;color:#065f46">
            <b>✅ 서식 적용 완료!</b><br>
            총 ${result.blocks}개의 단락/표가 처리되었습니다.<br>
            <span style="font-size:12px;color:#047857;margin-top:4px;display:block">한글 문서를 확인하세요. (Ctrl+Z로 되돌릴 수 있습니다)</span>
          </div>
        `;
      } else {
        var errMsg = (result && result.error) ? result.error : '알 수 없는 오류가 발생했습니다.';
        icon.textContent = '❌';
        statusText.textContent = '서식 적용 실패';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:16px;font-size:13px;color:#991b1b">
            <b>❌ 오류 발생</b><br>
            ${escapeHtml(errMsg)}
            ${errMsg.includes('한글 프로그램') ? '<br><br><b>→ 한글 프로그램을 실행하고 문서를 연 뒤 다시 시도하세요.</b>' : ''}
            ${errMsg.includes('PowerShell') ? '<br><br><b>→ Windows 10/11이 아닌 구형 PC일 수 있습니다. 관리자에게 문의하세요.</b>' : ''}
          </div>
        `;
      }
    } catch (e) {
      icon.textContent = '❌';
      statusText.textContent = '연결 오류';
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:16px;font-size:13px;color:#991b1b">
          <b>❌ 오류</b><br>${escapeHtml(String(e))}
        </div>
      `;
    } finally {
      btn.disabled = false;
      spinner.style.display = 'none';
    }
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function init() {}

window.registerPage('hwp_formatter', { render: render, init: init });
})();

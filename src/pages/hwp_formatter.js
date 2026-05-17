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
          <li>한글에서 문서에 일반 텍스트로 내용 작성 <span style="color:var(--accent)">(아래 예시 참고)</span></li>
          <li><b>Ctrl + S</b>로 .hwp 또는 .hwpx 파일로 저장</li>
          <li>한글 프로그램을 <b>완전히 종료</b>합니다 <span style="color:#dc2626">(중요!)</span></li>
          <li>아래 <b>서식 적용</b> 버튼 클릭 → 저장한 파일 선택</li>
          <li>자동으로 서식이 적용되고 한글이 다시 열립니다 ✨</li>
        </ol>
        <div style="margin-top:12px;padding:10px;background:#fef3c7;border-radius:8px;font-size:12px;color:#92400e">
          ⚠️ <b>한글 프로그램이 켜져있으면 안 됩니다.</b> 파일이 이미 열려있으면 잠금 오류가 발생할 수 있어요. 작업 전 한글을 완전히 종료해주세요.
        </div>
      </div>

      <!-- 한국 공문서 표준 항목 표시 체계 안내 -->
      <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-bottom:20px">
        <div style="font-weight:600;margin-bottom:10px;font-size:13px">📐 한국 공문서 표준 항목 표시 체계</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.9">
          행정안전부 공문서 작성 기준에 따라 다음 순서로 자동 인식합니다:<br>
          <code>Ⅰ.</code> → <code>1.</code> → <code>가.</code> → <code>1)</code> → <code>가)</code> → <code>(1)</code> → <code>◦</code> → <code>-</code>
          <br><br>
          <b>자동 레벨 감지:</b> 문서에 <code>Ⅰ</code>이 있으면 <code>Ⅰ</code>이 대제목, <code>1.</code>이 중제목이 됩니다.
          <code>Ⅰ</code>이 없으면 <code>1.</code>이 자동으로 대제목이 됩니다.
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:20px">
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">🔤 표제목 자동 적용</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.6">
            함초롬돋움 · Bold<br>
            레벨별 크기 자동 조정
          </div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">📝 본문 자동 적용</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.6">
            함초롬바탕 11pt<br>
            줄간격 170%, 들여쓰기 자동
          </div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">💡 강조/참고 인식</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.6">
            <code>▪</code> 강조 · Bold<br>
            <code>※</code> 참고 · 작게
          </div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px">
          <div style="font-size:12px;font-weight:600;margin-bottom:4px">📊 표 자동 생성</div>
          <div style="font-size:11px;color:var(--text2);line-height:1.6">
            탭 또는 2칸+ 공백으로<br>
            구분된 행을 표로 변환
          </div>
        </div>
      </div>

      <!-- 예시 보기 토글 -->
      <div style="margin-bottom:20px">
        <button class="btn btn-secondary btn-sm" id="hwpf-toggle-example">
          💡 입력 예시 보기 / 숨기기
        </button>
        <div id="hwpf-example" style="display:none;margin-top:12px">
          <pre style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;font-size:12px;line-height:1.8;overflow-x:auto;white-space:pre-wrap">Ⅰ. 개요
1. 목적
가. 학생 간부들의 리더십 및 공동체 의식을 함양한다.
나. 학생자치활동의 활성화 및 학교 문화 개선 방안을 모색한다.

2. 방침
가. 학생 중심의 참여형 프로그램으로 운영한다.
◦ 외부 강사와 협력하여 전문성을 확보한다.
▪ 안전 관리 강화
※ 사전 안전교육 필수

Ⅱ. 세부 계획
1. 일정
시간  내용  비고
08:30 ~ 09:00  집결 및 출석 확인  학교 운동장
09:00 ~ 12:00  팀빌딩 활동  강당</pre>
        </div>
      </div>

      <!-- 메인 버튼 영역 -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:30px;background:var(--card);border:2px solid var(--border);border-radius:16px;margin-bottom:20px">
        <div id="hwpf-status-icon" style="font-size:48px">📄</div>
        <div id="hwpf-status-text" style="font-size:14px;color:var(--text2);text-align:center">
          한글을 종료하고 저장된 .hwp 파일을 준비한 뒤<br>아래 버튼을 눌러 파일을 선택하세요.
        </div>
        <button class="btn btn-primary" id="hwpf-apply-btn" style="font-size:15px;padding:12px 36px;border-radius:10px">
          ✨ 서식 적용하기
        </button>
        <div id="hwpf-spinner" style="display:none;font-size:13px;color:var(--accent)">
          ⏳ 파일을 열어 서식을 적용하는 중...
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
            <span style="font-size:12px;color:#047857;margin-top:4px;display:block">파일이 저장되었습니다: ${escapeHtml(result.savedTo || '')}</span>
          </div>
        `;
      } else if (result && result.canceled) {
        icon.textContent = '📄';
        statusText.textContent = '파일 선택이 취소되었습니다.';
        resultDiv.style.display = 'none';
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

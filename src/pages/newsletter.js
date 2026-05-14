(function () {
'use strict';

var LIBRARY_KEY = 'newsletter_library';
var LANG_LABELS = { ko: '한국어', en: '영어', zh: '중국어', vi: '베트남어', ja: '일본어', th: '태국어' };

var TEMPLATES = [
  { id: 'event',    label: '행사 안내',    icon: '📅', hint: '행사명, 일시, 장소, 준비물을 입력하면 안내문을 작성합니다.' },
  { id: 'notice',   label: '일반 공지',    icon: '📢', hint: '전달할 내용을 간략히 입력하면 가정통신문 형식으로 작성합니다.' },
  { id: 'health',   label: '건강·안전',   icon: '🏥', hint: '감염병, 안전사고 등 예방 안내문을 작성합니다.' },
  { id: 'field',    label: '현장학습',     icon: '🚌', hint: '현장학습 일정, 장소, 준비물, 비용을 입력하세요.' },
  { id: 'exam',     label: '시험·평가',    icon: '📝', hint: '시험 일정, 범위, 유의사항을 입력하면 안내문을 작성합니다.' },
  { id: 'consult',  label: '상담 안내',    icon: '💬', hint: '상담 기간, 방법, 신청 방법을 입력하세요.' },
  { id: 'custom',   label: '직접 작성',    icon: '✏️', hint: '원하는 내용을 자유롭게 입력하세요.' }
];

var SYSTEM_PROMPT = `당신은 초·중·고 교사가 사용하는 가정통신문 작성 전문 AI 어시스턴트입니다.
다음 규칙을 반드시 지키세요:
- 학부모에게 보내는 공식 가정통신문 형식으로 작성
- 제목은 굵게 강조
- 인사말 → 본문 → 협조 요청 → 담임 서명란 순서
- 경어체(~습니다, ~드립니다) 사용
- 간결하고 명확하게, 500자 내외
- 날짜, 담임명은 [  ] 형태의 빈칸으로 표시`;

var TRANSLATE_PROMPT_TPL = function (lang, text) {
  return '다음 가정통신문을 ' + LANG_LABELS[lang] + '로 번역하세요. 형식을 그대로 유지하고 자연스럽게 번역하세요.\n\n' + text;
};

async function loadLibrary() {
  var raw = await api.getSetting(LIBRARY_KEY, '');
  try { return raw ? JSON.parse(raw) : []; } catch (_) { return []; }
}

async function saveLibrary(list) {
  await api.setSetting(LIBRARY_KEY, JSON.stringify(list));
}

async function getLocalEngine() {
  var engine = await api.getSetting('ai_engine', 'local_lite');
  return (engine === 'local_lite' || engine === 'local_basic' || engine === 'local_pro') ? engine : 'local_lite';
}

function render(container) {
  container.innerHTML = `
    <div class="page-wrap">
      <div class="page-header">
        <h1 class="page-header-title">📨 가정통신문 AI 작성</h1>
      </div>

      <!-- 유형 선택 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">📋 유형 선택</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="nl-template-btns">
          ${TEMPLATES.map(function (t) {
            return `<button class="btn btn-secondary btn-xs nl-tpl-btn" data-id="${t.id}" title="${t.hint}">${t.icon} ${t.label}</button>`;
          }).join('')}
        </div>
        <div id="nl-tpl-hint" style="font-size:12px;color:var(--text3);margin-top:8px;min-height:16px"></div>
      </div>

      <!-- 기본 정보 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">📌 기본 정보</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">학년·반</label>
            <input class="input" id="nl-class" placeholder="예: 3학년 2반" style="font-size:13px">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text2);display:block;margin-bottom:3px">담임 성함</label>
            <input class="input" id="nl-teacher" placeholder="예: 홍길동" style="font-size:13px">
          </div>
        </div>
      </div>

      <!-- 내용 입력 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;margin-bottom:12px">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px">✏️ 내용 입력</div>
        <textarea class="input" id="nl-input" rows="5" style="width:100%;resize:vertical;font-size:13px;line-height:1.6;box-sizing:border-box"
          placeholder="전달할 내용을 간략히 입력하세요&#10;예) 5월 20일 소풍. 장소: 청주 상당산성. 준비물: 도시락, 물, 편한 복장. 비용 없음."></textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          <button class="btn btn-primary" id="nl-generate-btn">🤖 AI로 작성하기</button>
          <button class="btn btn-secondary btn-sm" id="nl-library-btn">📚 보관함</button>
        </div>
        <div id="nl-loading" style="display:none;margin-top:10px;padding:10px;background:var(--bg2);border-radius:6px;font-size:13px;color:var(--text2);text-align:center">
          <span id="nl-loading-msg">AI 작성 중...</span>
        </div>
      </div>

      <!-- 결과 영역 -->
      <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px;margin-bottom:12px">
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <span style="font-size:13px;font-weight:600;color:var(--text2)">번역:</span>
          ${Object.keys(LANG_LABELS).filter(function(l){return l!=='ko';}).map(function (lang) {
            return `<button class="btn btn-secondary btn-xs nl-translate-btn" data-lang="${lang}">${LANG_LABELS[lang]}</button>`;
          }).join('')}
          <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-xs" id="nl-copy-btn">📋 복사</button>
            <button class="btn btn-secondary btn-xs" id="nl-save-btn">💾 보관함 저장</button>
            <button class="btn btn-secondary btn-xs" id="nl-print-btn">🖨️ 인쇄</button>
          </div>
        </div>
        <div id="nl-result" style="font-size:13px;line-height:1.9;white-space:pre-wrap;color:var(--text);min-height:160px;background:var(--bg2);padding:12px;border-radius:6px">
          <span style="color:var(--text3)">위에서 내용을 입력하고 'AI로 작성하기'를 누르세요.</span>
        </div>
      </div>

      <!-- 번역 결과 -->
      <div id="nl-translation-wrap" style="display:none;margin-bottom:12px">
        <div style="background:var(--bg1);border-radius:10px;box-sizing:border-box;overflow:hidden;padding:14px">
          <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:8px" id="nl-translation-lang"></div>
          <div id="nl-translation-result" style="font-size:13px;line-height:1.8;white-space:pre-wrap"></div>
        </div>
      </div>
    </div>

    <style>
      @keyframes spin { to { transform: rotate(360deg); } }
      .nl-tpl-btn { position: relative; transition: border-color .15s; }
      .nl-tpl-btn.active { background: var(--bg1); color: var(--primary); border-color: var(--primary); font-weight: 700; box-shadow: 0 3px 0 var(--primary); }
    </style>
  `;
}

async function init() {
  var selectedTemplate = TEMPLATES[0];
  var currentResult = '';

  // 담임 정보 자동 채우기
  var teacherName = await api.getSetting('teacher_name', '');
  var classYear   = await api.getSetting('class_year', '');
  var classNum    = await api.getSetting('class_num', '');
  if (teacherName) document.getElementById('nl-teacher').value = teacherName;
  if (classYear && classNum) document.getElementById('nl-class').value = classYear + '학년 ' + classNum + '반';

  // 템플릿 버튼
  var tplBtns = document.querySelectorAll('.nl-tpl-btn');
  tplBtns[0].classList.add('active');
  document.getElementById('nl-tpl-hint').textContent = TEMPLATES[0].hint;

  tplBtns.forEach(function (btn) {
    btn.onclick = function () {
      tplBtns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      selectedTemplate = TEMPLATES.find(function (t) { return t.id === btn.getAttribute('data-id'); }) || TEMPLATES[0];
      document.getElementById('nl-tpl-hint').textContent = selectedTemplate.hint;
    };
  });

  function showLoading(msg) {
    var el = document.getElementById('nl-loading');
    el.style.display = 'block';
    document.getElementById('nl-loading-msg').textContent = msg || 'AI 작성 중...';
  }
  function hideLoading() {
    document.getElementById('nl-loading').style.display = 'none';
  }

  // AI 작성
  document.getElementById('nl-generate-btn').onclick = async function () {
    var input   = document.getElementById('nl-input').value.trim();
    var cls     = document.getElementById('nl-class').value.trim();
    var teacher = document.getElementById('nl-teacher').value.trim();

    if (!input) { alert('내용을 입력해주세요.'); return; }

    var prompt = '[유형: ' + selectedTemplate.label + ']\n';
    if (cls)     prompt += '[학년반: ' + cls + ']\n';
    if (teacher) prompt += '[담임: ' + teacher + ']\n';
    prompt += '\n요청 내용:\n' + input + '\n\n위 내용으로 가정통신문을 작성해주세요.';

    var btn = document.getElementById('nl-generate-btn');
    btn.disabled = true;
    showLoading('AI가 가정통신문을 작성 중...');
    document.getElementById('nl-translation-wrap').style.display = 'none';

    try {
      var engine = await getLocalEngine();
      var result = await api.aiLocalChat({
        engine: engine,
        page: '가정통신문',
        question: prompt,
        context: SYSTEM_PROMPT
      });

      if (result.error) {
        document.getElementById('nl-result').textContent = '⚠️ 오류: ' + result.error + '\n\n로컬 AI가 실행 중인지 확인해주세요. (설정 → AI 모델)';
      } else {
        currentResult = result.result || '';
        document.getElementById('nl-result').textContent = currentResult;
      }
    } catch (err) {
      document.getElementById('nl-result').textContent = '⚠️ 오류: ' + err.message;
    }

    hideLoading();
    btn.disabled = false;
  };

  // 번역
  document.querySelectorAll('.nl-translate-btn').forEach(function (btn) {
    btn.onclick = async function () {
      if (!currentResult) { alert('먼저 가정통신문을 작성해주세요.'); return; }
      var lang = btn.getAttribute('data-lang');
      showLoading(LANG_LABELS[lang] + ' 번역 중...');
      try {
        var engine = await getLocalEngine();
        var result = await api.aiLocalChat({
          engine: engine,
          page: '가정통신문 번역',
          question: TRANSLATE_PROMPT_TPL(lang, currentResult),
          context: ''
        });
        var wrap = document.getElementById('nl-translation-wrap');
        wrap.style.display = 'block';
        document.getElementById('nl-translation-lang').textContent = '🌐 ' + LANG_LABELS[lang] + ' 번역';
        document.getElementById('nl-translation-result').textContent = result.error ? '오류: ' + result.error : (result.result || '');
      } catch (err) {
        alert('번역 오류: ' + err.message);
      }
      hideLoading();
    };
  });

  // 복사
  document.getElementById('nl-copy-btn').onclick = function () {
    if (!currentResult) { alert('작성된 내용이 없습니다.'); return; }
    navigator.clipboard.writeText(currentResult).then(function () {
      var btn = document.getElementById('nl-copy-btn');
      var orig = btn.textContent;
      btn.textContent = '✅ 복사됨';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    });
  };

  // 인쇄
  document.getElementById('nl-print-btn').onclick = function () {
    if (!currentResult) { alert('작성된 내용이 없습니다.'); return; }
    var win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
      <title>가정통신문</title>
      <style>
        body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; line-height: 1.9; font-size: 14px; }
        pre { white-space: pre-wrap; word-break: break-word; }
        @media print { body { padding: 20px; } }
      </style></head><body><pre>${currentResult.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre>
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    win.document.close();
  };

  // 보관함 저장
  document.getElementById('nl-save-btn').onclick = async function () {
    if (!currentResult) { alert('저장할 내용이 없습니다.'); return; }
    var title = prompt('제목을 입력하세요:', selectedTemplate.label + ' ' + new Date().toLocaleDateString('ko-KR'));
    if (!title) return;
    var lib = await loadLibrary();
    lib.unshift({ id: Date.now(), title: title, content: currentResult, template: selectedTemplate.id,
      savedAt: new Date().toISOString() });
    if (lib.length > 100) lib = lib.slice(0, 100);
    await saveLibrary(lib);
    var btn = document.getElementById('nl-save-btn');
    var orig = btn.textContent;
    btn.textContent = '✅ 저장됨';
    setTimeout(function () { btn.textContent = orig; }, 1500);
  };

  // 보관함 모달
  var currentLibModal = null;

  document.getElementById('nl-library-btn').onclick = async function () {
    var m = window.showModal(
      `<div class="modal-header">
        <span class="modal-title">📚 저장된 가정통신문</span>
        <button class="modal-close" data-close>✕</button>
      </div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto">
        <div id="nl-library-list">불러오는 중...</div>
      </div>`
    );
    currentLibModal = m;
    await renderLibrary(m);
  };

  async function renderLibrary(m) {
    var lib = await loadLibrary();
    var listEl = m.el.querySelector('#nl-library-list');
    if (!lib.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3)">저장된 가정통신문이 없습니다.</div>';
      return;
    }
    listEl.innerHTML = lib.map(function (item) {
      var date = new Date(item.savedAt).toLocaleDateString('ko-KR');
      var preview = item.content.slice(0, 80).replace(/\n/g, ' ');
      return `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">
          <strong style="font-size:13px">${item.title}</strong>
          <div style="display:flex;gap:4px;flex-shrink:0">
            <button class="btn btn-primary btn-xs nl-lib-load" data-id="${item.id}">불러오기</button>
            <button class="btn btn-secondary btn-xs nl-lib-del" data-id="${item.id}">삭제</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text3)">${date} · ${preview}...</div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.nl-lib-load').forEach(function (btn) {
      btn.onclick = function () {
        var id = parseInt(btn.getAttribute('data-id'));
        var item = lib.find(function (i) { return i.id === id; });
        if (!item) return;
        currentResult = item.content;
        document.getElementById('nl-result').textContent = currentResult;
        m.close();
      };
    });

    listEl.querySelectorAll('.nl-lib-del').forEach(function (btn) {
      btn.onclick = async function () {
        if (!confirm('삭제할까요?')) return;
        var id = parseInt(btn.getAttribute('data-id'));
        var updated = lib.filter(function (i) { return i.id !== id; });
        await saveLibrary(updated);
        lib = updated;
        await renderLibrary(m);
      };
    });
  }
}

window.registerPage('newsletter', { render: render, init: init });
})();

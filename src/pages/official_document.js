(function () {
  "use strict";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value || "";
  }

  async function render(container) {
    var rules = window.OfficialDocumentRules;
    var options = (rules ? rules.DOCUMENT_TYPES : ["협조요청", "통보", "회신", "보고", "알림", "기타"])
      .map(function (type) { return '<option value="' + escapeHtml(type) + '">' + escapeHtml(type) + '</option>'; })
      .join("");

    container.innerHTML = [
      '<div id="official-doc-page" class="official-doc-page">',
      '  <section class="official-doc-hero">',
      '    <div>',
      '      <div class="official-doc-eyebrow">행정 공문 작성 보조</div>',
      '      <h2>두문·본문·결문 흐름에 맞춘 공문 초안 생성</h2>',
      '      <p>외부 API 없이 PDF 작성법 기준을 로컬에서 적용합니다. 빈 항목은 임의로 채우지 않고 바로 알려줍니다.</p>',
      '    </div>',
      '    <div class="official-doc-rule-card">',
      '      <b>자동 적용</b>',
      '      <span>제목·내용 기반 문장 기획, 붙임, 끝., 날짜·금액 표기, 표현 점검</span>',
      '    </div>',
      '  </section>',
      '',
      '  <div class="official-doc-tabs">',
      '    <button class="official-doc-tab active" data-tab="draft">공문 생성</button>',
      '    <button class="official-doc-tab" data-tab="review">검토 모드</button>',
      '    <button class="official-doc-tab" data-tab="sv">🚨 학교폭력 공문</button>',
      '  </div>',
      '',
      '  <section id="official-draft-panel" class="official-doc-panel active">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>입력 항목</h3>',
      '          <span>내용만 넣어도 제목과 본문 문장을 함께 기획합니다.</span>',
      '        </div>',
      '        <label>문서 유형<select id="od-document-type">' + options + '</select></label>',
      '        <label>제목 <small>선택, 비워두면 자동 생성</small><input id="od-title" placeholder="예: 2026학년도 1학기 생활위원회 결과 보고"></label>',
      '        <div class="official-doc-related-row">',
      '          <label>관련 공문 <small>선택</small><textarea id="od-basis" rows="3" placeholder="예: ○○교육청 진로교육과-1234"></textarea></label>',
      '          <label>시행날짜 <small>선택</small><input id="od-basis-date" type="date"></label>',
      '        </div>',
      '        <label>본문 핵심 내용<textarea id="od-body" rows="6" placeholder="짧게 써도 됩니다. 예: 2026학년도 1학기 생활위원회 결과 보고"></textarea></label>',
      '        <label>붙임 파일 목록 <small>선택, 한 줄에 하나</small><textarea id="od-attachments" rows="3" placeholder="예: 운영 계획서&#10;예: 참가 신청서"></textarea></label>',
      '        <div id="od-missing" class="official-doc-alert" style="display:none"></div>',
      '        <div class="official-doc-btn-row">',
      '          <button id="od-generate-btn" class="btn btn-secondary official-doc-main-btn">규칙 기반 생성</button>',
      '          <button id="od-ai-generate-btn" class="btn btn-primary official-doc-main-btn">✨ AI로 생성</button>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>생성 결과</h3>',
      '          <button id="od-copy-draft-btn" class="btn btn-secondary btn-sm">복사</button>',
      '        </div>',
      '        <pre id="od-draft-output" class="official-doc-output">왼쪽 항목을 입력한 뒤 [공문 초안 생성]을 누르세요.</pre>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '  <section id="official-review-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <h3>작성한 공문 검토</h3>',
      '        <label>공문 내용<textarea id="od-review-input" rows="16" placeholder="이미 작성한 공문을 여기에 붙여넣으세요."></textarea></label>',
      '        <button id="od-review-btn" class="btn btn-primary official-doc-main-btn">형식·표현 검토</button>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>검토 결과</h3>',
      '          <button id="od-copy-review-btn" class="btn btn-secondary btn-sm">수정안 복사</button>',
      '        </div>',
      '        <div id="od-review-findings" class="official-doc-findings">검토할 공문을 입력해 주세요.</div>',
      '        <pre id="od-review-output" class="official-doc-output official-doc-review-output"></pre>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '  <section id="official-sv-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>학교폭력 공문 자동완성</h3>',
      '          <span>공문 번호를 선택하면 해당 양식이 자동으로 채워집니다.</span>',
      '        </div>',
      '        <label>공문 선택',
      '          <select id="sv-doc-select">',
      '            <option value="">-- 공문을 선택하세요 --</option>',
      '          </select>',
      '        </label>',
      '        <div id="sv-doc-desc" class="official-doc-sv-desc"></div>',
      '        <div id="sv-doc-fields"></div>',
      '        <div class="official-doc-btn-row" style="margin-top:12px">',
      '          <button id="sv-generate-btn" class="btn btn-primary official-doc-main-btn">공문 생성</button>',
      '          <button id="sv-clear-btn" class="btn btn-secondary official-doc-main-btn">초기화</button>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card">',
      '        <div class="official-doc-output-head">',
      '          <h3>생성 결과</h3>',
      '          <button id="sv-copy-btn" class="btn btn-secondary btn-sm">복사</button>',
      '        </div>',
      '        <pre id="sv-doc-output" class="official-doc-output">왼쪽에서 공문을 선택하고 항목을 입력한 뒤 [공문 생성]을 누르세요.\n\n충청북도교육청 2026. 학교폭력 사안처리 A to Z 서식 기반 자동완성입니다.\n공문 양식은 PDF 원본과 동일하게 유지됩니다.</pre>',
      '      </div>',
      '    </div>',
      '  </section>',
      '',
      '</div>'
    ].join("");
  }

  function collectDraftInput() {
    return {
      documentType: getValue("od-document-type"),
      title: getValue("od-title"),
      basis: getValue("od-basis"),
      basisDate: getValue("od-basis-date"),
      body: getValue("od-body"),
      attachments: getValue("od-attachments")
    };
  }

  function showMissing(missing) {
    var box = document.getElementById("od-missing");
    if (!box) return;
    if (!missing.length) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }
    box.style.display = "block";
    box.textContent = "아직 필요한 항목: " + missing.join(", ");
  }

  function copyTextFrom(id) {
    var text = document.getElementById(id) ? document.getElementById(id).textContent : "";
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  function switchTab(tab) {
    document.querySelectorAll(".official-doc-tab").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.tab === tab);
    });
    var draft = document.getElementById("official-draft-panel");
    var review = document.getElementById("official-review-panel");
    var sv = document.getElementById("official-sv-panel");
    if (draft) draft.classList.toggle("active", tab === "draft");
    if (review) review.classList.toggle("active", tab === "review");
    if (sv) sv.classList.toggle("active", tab === "sv");
  }

  function renderReviewFindings(findings) {
    var wrap = document.getElementById("od-review-findings");
    if (!wrap) return;
    if (!findings.length) {
      wrap.innerHTML = '<div class="official-doc-good">큰 형식 오류를 찾지 못했습니다. 그래도 최종 결재 전 기관 내부 기준은 한 번 더 확인해 주세요.</div>';
      return;
    }
    wrap.innerHTML = findings.map(function (item) {
      var examples = item.examples && item.examples.length ? " 발견 예: " + item.examples.join(", ") : "";
      return '<div class="official-doc-finding"><b>' + escapeHtml(item.type) + '</b><span>' + escapeHtml(item.message + examples) + '</span></div>';
    }).join("");
  }

  function init() {
    var rules = window.OfficialDocumentRules;
    if (!rules) {
      setText("od-draft-output", "공문 작성 규칙 모듈을 불러오지 못했습니다.");
      return;
    }

    document.querySelectorAll(".official-doc-tab").forEach(function (btn) {
      btn.addEventListener("click", function () { switchTab(btn.dataset.tab); });
    });

    var generateBtn = document.getElementById("od-generate-btn");
    if (generateBtn) {
      generateBtn.addEventListener("click", function () {
        var input = collectDraftInput();
        var missing = rules.validateDraftInput(input);
        showMissing(missing);
        if (missing.length) {
          setText("od-draft-output", "필수 항목을 먼저 채워 주세요. 공문 내용은 임의로 만들지 않습니다.");
          return;
        }
        setText("od-draft-output", rules.buildDraft(input));
      });
    }

    var reviewBtn = document.getElementById("od-review-btn");
    if (reviewBtn) {
      reviewBtn.addEventListener("click", function () {
        var result = rules.reviewDocument(getValue("od-review-input"));
        renderReviewFindings(result.findings || []);
        setText("od-review-output", result.suggestion || "");
      });
    }

    var aiBtn = document.getElementById("od-ai-generate-btn");
    if (aiBtn) {
      aiBtn.addEventListener("click", async function () {
        var input = collectDraftInput();
        var missing = rules.validateDraftInput(input);
        showMissing(missing);
        if (missing.length) {
          setText("od-draft-output", "필수 항목을 먼저 채워 주세요. 공문 내용은 임의로 만들지 않습니다.");
          return;
        }
        var apiKey = await api.getSetting("ai_api_key", "");
        if (!apiKey) {
          setText("od-draft-output", "설정에서 AI API 키를 입력하세요.");
          return;
        }
        var model = await api.getSetting("ai_model", "claude-sonnet-4-6");
        var provider = await api.getSetting("ai_provider", "claude");
        aiBtn.disabled = true;
        aiBtn.textContent = "AI 생성 중…";
        setText("od-draft-output", "AI가 공문서 작성법 기준에 따라 공문을 작성 중입니다…");
        var inputSummary = [
          "문서 유형: " + input.documentType,
          "수신자: " + (input.recipients || "없음"),
          input.via ? "경유: " + input.via : "",
          input.senderOrg ? "발신 기관: " + input.senderOrg : "",
          input.senderTitle ? "발신명의: " + input.senderTitle : "",
          "제목: " + input.title,
          input.basis ? "관련 근거:\n" + input.basis : "",
          "본문 핵심 내용:\n" + input.body,
          input.attachments ? "붙임 파일:\n" + input.attachments : "",
          "시행일자: " + input.effectiveDate,
          input.senderDept ? "담당 부서: " + input.senderDept : "",
          input.senderName ? "담당자: " + input.senderName : ""
        ].filter(Boolean).join("\n");
        var result = await api.aiGenerateOfficialDoc(apiKey, model, provider, inputSummary);
        aiBtn.disabled = false;
        aiBtn.textContent = "✨ AI로 생성";
        if (result.error) {
          setText("od-draft-output", "AI 오류: " + result.error);
        } else {
          setText("od-draft-output", result.result || "결과 없음");
        }
      });
    }

    var copyDraftBtn = document.getElementById("od-copy-draft-btn");
    if (copyDraftBtn) copyDraftBtn.addEventListener("click", function () { copyTextFrom("od-draft-output"); });
    var copyReviewBtn = document.getElementById("od-copy-review-btn");
    if (copyReviewBtn) copyReviewBtn.addEventListener("click", function () { copyTextFrom("od-review-output"); });

    // SV document tab
    var svTemplates = window.SVDocumentTemplates || [];
    var svSelect = document.getElementById("sv-doc-select");
    if (svSelect && svTemplates.length) {
      svTemplates.forEach(function (tpl) {
        var opt = document.createElement("option");
        opt.value = tpl.id;
        opt.textContent = tpl.title;
        svSelect.appendChild(opt);
      });

      svSelect.addEventListener("change", function () {
        var id = parseInt(svSelect.value, 10);
        var tpl = svTemplates.find(function (t) { return t.id === id; });
        var descEl = document.getElementById("sv-doc-desc");
        var fieldsEl = document.getElementById("sv-doc-fields");
        if (!tpl || !descEl || !fieldsEl) return;
        descEl.textContent = "[" + tpl.category + "] " + tpl.desc;
        fieldsEl.innerHTML = tpl.fields.map(function (fld) {
          var isTextarea = (fld.ph && fld.ph.indexOf("\n") !== -1) || fld.big;
          var req = fld.req ? '<span class="sv-req">*</span>' : '<small>선택</small>';
          if (isTextarea) {
            return '<label>' + escapeHtml(fld.label) + ' ' + req +
              '<textarea id="sv-f-' + fld.id + '" rows="3" placeholder="' + escapeHtml(fld.ph || "") + '"></textarea></label>';
          }
          return '<label>' + escapeHtml(fld.label) + ' ' + req +
            '<input id="sv-f-' + fld.id + '" placeholder="' + escapeHtml(fld.ph || "") + '"></label>';
        }).join("");
      });
    }

    var svGenerateBtn = document.getElementById("sv-generate-btn");
    if (svGenerateBtn) {
      svGenerateBtn.addEventListener("click", function () {
        var id = parseInt(svSelect ? svSelect.value : "0", 10);
        var tpl = svTemplates.find(function (t) { return t.id === id; });
        var outputEl = document.getElementById("sv-doc-output");
        if (!tpl || !outputEl) return;
        var vals = {};
        tpl.fields.forEach(function (fld) {
          var el = document.getElementById("sv-f-" + fld.id);
          vals[fld.id] = el ? el.value : "";
        });
        outputEl.textContent = tpl.generate(vals);
      });
    }

    var svClearBtn = document.getElementById("sv-clear-btn");
    if (svClearBtn) {
      svClearBtn.addEventListener("click", function () {
        var fieldsEl = document.getElementById("sv-doc-fields");
        if (fieldsEl) fieldsEl.querySelectorAll("input, textarea").forEach(function (el) { el.value = ""; });
        var outputEl = document.getElementById("sv-doc-output");
        if (outputEl) outputEl.textContent = "왼쪽에서 공문을 선택하고 항목을 입력한 뒤 [공문 생성]을 누르세요.";
      });
    }

    var svCopyBtn = document.getElementById("sv-copy-btn");
    if (svCopyBtn) svCopyBtn.addEventListener("click", function () { copyTextFrom("sv-doc-output"); });
  }

  window.registerPage("official_document", { render: render, init: init });
})();

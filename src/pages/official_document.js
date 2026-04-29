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
      '    <button class="official-doc-tab" data-tab="poom">📝 품의서 작성</button>',
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
      '  <section id="official-poom-panel" class="official-doc-panel">',
      '    <div class="official-doc-grid">',
      '      <div class="card official-doc-form">',
      '        <div class="official-doc-form-head">',
      '          <h3>품의서 작성</h3>',
      '          <span>항목을 입력하면 제목·개요·품목내역을 에듀파인에 붙여넣을 형식으로 작성합니다.</span>',
      '        </div>',
      '        <label>품의 유형<select id="poom-type"><option value="물품">물품 구입</option><option value="수당">수당 지급</option><option value="업무추진비">업무추진비</option></select></label>',
      '        <div style="display:grid;grid-template-columns:100px 1fr;gap:8px">',
      '          <label>회계연도<input id="poom-year" type="number" value="2026" min="2020" max="2040"></label>',
      '          <label>제목<input id="poom-title"></label>',
      '        </div>',
      '        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">',
      '          <label style="display:flex;align-items:center;gap:5px;font-size:12px;font-weight:500;cursor:pointer;margin:0">',
      '            <input type="checkbox" id="poom-plan-edu" style="width:15px;height:15px;cursor:pointer">',
      '            학교교육과정운영계획',
      '          </label>',
      '        </div>',
      '        <div style="display:grid;grid-template-columns:2fr 1fr;gap:8px">',
      '          <label>관련 계획명 <small>선택</small><input id="poom-plan"></label>',
      '          <label>계획 날짜 <small>선택</small><input id="poom-plan-date" type="date"></label>',
      '        </div>',
      '        <label id="poom-purpose-wrap">목적 설명<input id="poom-purpose"></label>',
      '        <div id="poom-extra-fields"></div>',
      '        <div style="margin-top:4px">',
      '          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">',
      '            <div style="font-size:12px;font-weight:600;color:var(--fg-2)">품목 내역</div>',
      '            <button id="poom-add-row" class="btn btn-secondary btn-sm" type="button">+ 직접 추가</button>',
      '          </div>',
      '          <div id="poom-upload-area" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;cursor:pointer;margin-bottom:8px;transition:border-color 0.15s">',
      '            <input id="poom-file-input" type="file" accept="image/*,.pdf,.xlsx,.xls,.csv" style="display:none">',
      '            <div style="font-size:13px;color:var(--fg-2);margin-bottom:4px">📎 견적서 파일을 여기에 드래그하거나 클릭하세요</div>',
      '            <div style="font-size:11px;color:var(--fg-3)">이미지(JPG·PNG), PDF, 엑셀(xlsx·xls), CSV 지원</div>',
      '            <div id="poom-upload-status" style="margin-top:8px;font-size:12px;color:var(--accent);display:none"></div>',
      '          </div>',
      '          <div style="display:grid;grid-template-columns:2fr 1fr 52px 1fr 90px 30px;gap:4px;margin-bottom:4px;padding:0 2px;font-size:11px;color:var(--fg-3)">',
      '            <span>품목명</span><span>규격</span><span>수량</span><span>단가(원)</span><span>금액</span><span></span>',
      '          </div>',
      '          <div id="poom-rows"></div>',
      '          <div style="text-align:right;margin-top:6px;font-size:13px;color:var(--fg-2)">합계: <strong id="poom-total-display" style="color:var(--accent)">0</strong>원</div>',
      '        </div>',
      '        <div class="official-doc-btn-row" style="margin-top:12px">',
      '          <button id="poom-gen-btn" class="btn btn-primary official-doc-main-btn" type="button">개요 생성</button>',
      '          <button id="poom-clear-btn" class="btn btn-secondary official-doc-main-btn" type="button">초기화</button>',
      '        </div>',
      '      </div>',
      '      <div class="card official-doc-output-card" style="display:flex;flex-direction:column;gap:10px">',
      '        <div>',
      '          <div class="official-doc-output-head"><h3>제목</h3><button id="poom-copy-title" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-title" class="official-doc-output" style="min-height:42px;white-space:pre-wrap"></pre>',
      '        </div>',
      '        <div>',
      '          <div class="official-doc-output-head"><h3>개요</h3><button id="poom-copy-gaeyo" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-gaeyo" class="official-doc-output" style="min-height:80px;white-space:pre-wrap"></pre>',
      '        </div>',
      '        <div id="poom-out-items-wrap">',
      '          <div class="official-doc-output-head"><h3>품목내역</h3><button id="poom-copy-items" class="btn btn-secondary btn-sm" type="button">복사</button></div>',
      '          <pre id="poom-out-items" class="official-doc-output" style="min-height:60px;white-space:pre;font-size:12px"></pre>',
      '        </div>',
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
    var poom = document.getElementById("official-poom-panel");
    if (draft) draft.classList.toggle("active", tab === "draft");
    if (review) review.classList.toggle("active", tab === "review");
    if (sv) sv.classList.toggle("active", tab === "sv");
    if (poom) poom.classList.toggle("active", tab === "poom");
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
    var SV_GROUPS = [
      { label: "교육지원청 지원 요청", ids: [1] },
      { label: "Ⅰ. 초기대응 및 접수", ids: [2, 3, 4] },
      { label: "Ⅱ. 사안조사", ids: [5, 6, 7, 8] },
      { label: "Ⅲ. 전담기구 심의", ids: [9, 10, 11, 12, 13] },
      { label: "Ⅳ. 심의위원회 개최", ids: [14, 15] },
      { label: "Ⅳ. 조치결과 이행", ids: [16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26] },
      { label: "Ⅴ. 후속조치 (생활기록부 삭제)", ids: [27, 28, 29, 30, 31] },
      { label: "관계회복 숙려제도", ids: [32] }
    ];
    var svTemplates = window.SVDocumentTemplates || [];
    var svSelect = document.getElementById("sv-doc-select");
    if (svSelect && svTemplates.length) {
      SV_GROUPS.forEach(function (grp) {
        var optgroup = document.createElement("optgroup");
        optgroup.label = grp.label;
        grp.ids.forEach(function (id) {
          var tpl = svTemplates.find(function (t) { return t.id === id; });
          if (!tpl) return;
          var opt = document.createElement("option");
          opt.value = tpl.id;
          opt.textContent = tpl.title;
          optgroup.appendChild(opt);
        });
        svSelect.appendChild(optgroup);
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

    // ── 품의서 작성 ──────────────────────────────────────────
    function numberToKorean(num) {
      num = Math.floor(num);
      if (!num || num <= 0) return "영";
      var ones = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
      var pos  = ["", "십", "백", "천"];
      function fmt(n) {
        var s = "";
        for (var i = 3; i >= 0; i--) {
          var d = Math.floor(n / Math.pow(10, i)) % 10;
          if (d > 0) s += (d === 1 && i > 0 ? "" : ones[d]) + pos[i];
        }
        return s;
      }
      var eok  = Math.floor(num / 100000000);
      var man  = Math.floor((num % 100000000) / 10000);
      var rest = num % 10000;
      var r = "";
      if (eok  > 0) r += fmt(eok)  + "억";
      if (man  > 0) r += fmt(man)  + "만";
      if (rest > 0) r += fmt(rest);
      return r;
    }

    function fmtDate(dateStr) {
      if (!dateStr) return "";
      var p = dateStr.split("-");
      return p.length === 3 ? p[0] + "." + p[1] + "." + p[2] + "." : dateStr;
    }

    function numComma(n) { return Number(n).toLocaleString(); }

    function getPoomItems() {
      var rows = document.querySelectorAll(".poom-item-row");
      var items = [];
      rows.forEach(function (row) {
        var name  = row.querySelector(".pi-name").value.trim();
        var spec  = row.querySelector(".pi-spec").value.trim();
        var qty   = parseInt(row.querySelector(".pi-qty").value) || 0;
        var price = parseInt(row.querySelector(".pi-price").value) || 0;
        if (name) items.push({ name: name, spec: spec, qty: qty, price: price, amount: qty * price });
      });
      return items;
    }

    function updatePoomTotal() {
      var total = getPoomItems().reduce(function (s, i) { return s + i.amount; }, 0);
      var disp = document.getElementById("poom-total-display");
      if (disp) disp.textContent = numComma(total);
      return total;
    }

    function addPoomRow(data) {
      var container = document.getElementById("poom-rows");
      if (!container) return;
      var row = document.createElement("div");
      row.className = "poom-item-row";
      row.style.cssText = "display:grid;grid-template-columns:2fr 1fr 52px 1fr 90px 30px;gap:4px;margin-bottom:4px;align-items:center";
      row.innerHTML = [
        '<input class="input pi-name"  style="height:32px;font-size:12px">',
        '<input class="input pi-spec"  style="height:32px;font-size:12px">',
        '<input class="input pi-qty"   type="number" min="0" style="height:32px;font-size:12px">',
        '<input class="input pi-price" type="number" min="0" style="height:32px;font-size:12px">',
        '<input class="input pi-amt"   readonly style="height:32px;font-size:12px;background:var(--bg-2);color:var(--fg-2)">',
        '<button class="btn btn-secondary pi-del" type="button" style="height:30px;width:30px;padding:0;font-size:16px;line-height:1">×</button>'
      ].join("");

      var qtyEl   = row.querySelector(".pi-qty");
      var priceEl = row.querySelector(".pi-price");
      var amtEl   = row.querySelector(".pi-amt");

      if (data) {
        row.querySelector(".pi-name").value  = data.name  || "";
        row.querySelector(".pi-spec").value  = data.spec  || "";
        qtyEl.value   = data.qty   || "";
        priceEl.value = data.price || "";
        var a = (data.qty || 0) * (data.price || 0);
        amtEl.value = a > 0 ? numComma(a) : "";
      }

      function calcRow() {
        var a = (parseInt(qtyEl.value) || 0) * (parseInt(priceEl.value) || 0);
        amtEl.value = a > 0 ? numComma(a) : "";
        updatePoomTotal();
      }
      qtyEl.addEventListener("input", calcRow);
      priceEl.addEventListener("input", calcRow);
      row.querySelector(".pi-del").addEventListener("click", function () { row.remove(); updatePoomTotal(); });
      container.appendChild(row);
    }

    function renderPoomExtraFields(type) {
      var wrap = document.getElementById("poom-extra-fields");
      var purpWrap = document.getElementById("poom-purpose-wrap");
      if (!wrap) return;
      if (type === "물품") {
        if (purpWrap) purpWrap.style.display = "";
        wrap.innerHTML = "";
      } else if (type === "수당") {
        if (purpWrap) purpWrap.style.display = "none";
        wrap.innerHTML = [
          '<label>지급 대상<input id="poom-target"></label>',
          '<label>지급 기준<input id="poom-criteria"></label>'
        ].join("");
      } else if (type === "업무추진비") {
        if (purpWrap) purpWrap.style.display = "none";
        wrap.innerHTML = [
          '<label>사용 목적<input id="poom-usage-purpose"></label>',
          '<label>사용 일시<input id="poom-usage-date"></label>'
        ].join("");
      }
    }

    function generatePoom() {
      var type    = getValue("poom-type");
      var year    = getValue("poom-year") || "2026";
      var title   = getValue("poom-title").trim();
      var plan    = getValue("poom-plan").trim();
      var planDate = getValue("poom-plan-date");
      var purpose = getValue("poom-purpose").trim();
      var items   = getPoomItems();
      var total   = items.reduce(function (s, i) { return s + i.amount; }, 0);
      var totalKr = total > 0 ? numberToKorean(total) : "";

      var gaeyoLines = [];

      // 1. 관련
      if (plan) {
        gaeyoLines.push("1. 관련: " + plan + (planDate ? "(" + fmtDate(planDate) + ")" : ""));
      }

      var numPrefix = plan ? "2. " : "1. ";

      if (type === "물품") {
        var mainItem  = items.length > 0 ? items[0].name : "";
        var otherCnt  = items.length - 1;
        var itemStr   = mainItem + (otherCnt > 0 ? " 외 " + otherCnt + "종" : (items.length === 0 ? "" : ""));
        gaeyoLines.push(numPrefix + year + "학년도 " + (title || purpose) + "을(를) 다음과 같이 구입하고자 합니다.");
        if (purpose) gaeyoLines.push("   가. 목적: " + purpose);
        if (itemStr)  gaeyoLines.push("   " + (purpose ? "나" : "가") + ". 물품: " + itemStr);
        if (total > 0) {
          var lastAlpha = purpose && itemStr ? "다" : (purpose || itemStr ? "나" : "가");
          gaeyoLines.push("   " + lastAlpha + ". 금액: 금" + numComma(total) + "원(금" + totalKr + "원정).  끝.");
        }
      } else if (type === "수당") {
        var targetEl   = document.getElementById("poom-target");
        var criteriaEl = document.getElementById("poom-criteria");
        var target   = targetEl   ? targetEl.value.trim()   : "";
        var criteria = criteriaEl ? criteriaEl.value.trim() : "";
        gaeyoLines.push(numPrefix + "위와 관련하여 다음과 같이 수당을 지급하고자 합니다.");
        if (target)   gaeyoLines.push("   가. 지급 대상: " + target);
        if (criteria) gaeyoLines.push("   나. 지급 기준: " + criteria);
        if (total > 0) gaeyoLines.push("   다. 금액: 금" + numComma(total) + "원(금" + totalKr + "원정).  끝.");
      } else if (type === "업무추진비") {
        var upEl  = document.getElementById("poom-usage-purpose");
        var udEl  = document.getElementById("poom-usage-date");
        var upurp = upEl ? upEl.value.trim() : "";
        var udate = udEl ? udEl.value.trim() : "";
        gaeyoLines.push(numPrefix + "위와 관련하여 다음과 같이 업무추진비를 지출하고자 합니다.");
        if (upurp) gaeyoLines.push("   가. 사용 목적: " + upurp);
        if (udate) gaeyoLines.push("   나. 사용 일시: " + udate);
        if (total > 0) gaeyoLines.push("   다. 금액: 금" + numComma(total) + "원(금" + totalKr + "원정).  끝.");
      }

      // 품목 내역 텍스트
      var itemsLines = [];
      if (items.length > 0) {
        var colW = [16, 8, 4, 10, 10];
        function pad(s, w) { s = String(s); return s.length >= w ? s : s + " ".repeat(w - s.length); }
        itemsLines.push(pad("품목명", colW[0]) + pad("규격", colW[1]) + pad("수량", colW[2]) + pad("단가", colW[3]) + "금액");
        itemsLines.push("─".repeat(colW[0] + colW[1] + colW[2] + colW[3] + 8));
        items.forEach(function (item, idx) {
          itemsLines.push(
            pad((idx + 1) + ". " + item.name, colW[0]) +
            pad(item.spec || "-", colW[1]) +
            pad(String(item.qty), colW[2]) +
            pad(numComma(item.price), colW[3]) +
            numComma(item.amount)
          );
        });
        itemsLines.push("─".repeat(colW[0] + colW[1] + colW[2] + colW[3] + 8));
        itemsLines.push(pad("합계", colW[0] + colW[1] + colW[2] + colW[3]) + numComma(total) + "원");
      }

      var titleEl = document.getElementById("poom-out-title");
      var gaeyoEl = document.getElementById("poom-out-gaeyo");
      var itemsEl = document.getElementById("poom-out-items");
      if (titleEl) titleEl.textContent = title || "제목을 입력하세요";
      if (gaeyoEl) gaeyoEl.textContent = gaeyoLines.join("\n") || "내용을 입력하세요";
      if (itemsEl) itemsEl.textContent = itemsLines.length ? itemsLines.join("\n") : "품목을 추가하세요";
    }

    // 파일 업로드 처리
    async function handleEstimateFile(file) {
      var statusEl = document.getElementById("poom-upload-status");
      function setStatus(msg) { if (statusEl) { statusEl.textContent = msg; statusEl.style.display = msg ? "" : "none"; } }

      var ext = file.name.split(".").pop().toLowerCase();
      var isImage = file.type.startsWith("image/");
      var isPdf   = ext === "pdf" || file.type === "application/pdf";
      var isExcel = ["xlsx", "xls"].indexOf(ext) !== -1;
      var isCsv   = ext === "csv";

      if (!isImage && !isPdf && !isExcel && !isCsv) { setStatus("지원하지 않는 파일 형식입니다."); return; }

      setStatus("파일 읽는 중…");

      if (isImage || isPdf) {
        // AI vision/document으로 추출
        var apiKey = await api.getSetting("ai_api_key", "");
        if (!apiKey) { setStatus("설정에서 AI API 키를 입력하세요."); return; }
        var model    = await api.getSetting("ai_model", "claude-sonnet-4-6");
        var provider = await api.getSetting("ai_provider", "claude");
        setStatus("AI가 견적서를 분석 중입니다…");
        var reader = new FileReader();
        reader.onload = async function (e) {
          var b64 = e.target.result.split(",")[1];
          var mimeType = isPdf ? "application/pdf" : file.type;
          var result = await api.aiExtractEstimateImage(apiKey, model, provider, { data: b64, mimeType: mimeType });
          if (result.error) { setStatus("오류: " + result.error); return; }
          try {
            var raw = result.result || "";
            raw = raw.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();
            var items = JSON.parse(raw);
            fillPoomRows(items);
            setStatus("✓ " + items.length + "개 품목 자동 입력 완료");
          } catch (err) { setStatus("AI 응답 파싱 실패. 직접 입력해주세요."); }
        };
        reader.readAsDataURL(file);

      } else if (isExcel) {
        var reader2 = new FileReader();
        reader2.onload = async function (e) {
          var buf = Array.from(new Uint8Array(e.target.result));
          var result = await api.parseExcelEstimate(buf);
          if (result.error) { setStatus("엑셀 파싱 오류: " + result.error); return; }
          var items = inferItemsFromRows(result.rows);
          if (!items.length) { setStatus("품목 데이터를 찾지 못했습니다. 헤더(품목명·수량·단가)가 있는지 확인해주세요."); return; }
          fillPoomRows(items);
          setStatus("✓ " + items.length + "개 품목 자동 입력 완료");
        };
        reader2.readAsArrayBuffer(file);

      } else if (isCsv) {
        var reader3 = new FileReader();
        reader3.onload = function (e) {
          var lines = e.target.result.split(/\r?\n/).map(function (l) { return l.split(","); });
          var items = inferItemsFromRows(lines);
          if (!items.length) { setStatus("품목 데이터를 찾지 못했습니다."); return; }
          fillPoomRows(items);
          setStatus("✓ " + items.length + "개 품목 자동 입력 완료");
        };
        reader3.readAsText(file, "utf-8");
      }
    }

    function inferItemsFromRows(rows) {
      // 헤더 행 탐색: 품목명/품명/내용/규격/수량/단가 등 키워드 포함 행
      var nameKeywords  = ["품목", "품명", "내용", "name", "item"];
      var specKeywords  = ["규격", "사양", "spec"];
      var qtyKeywords   = ["수량", "qty", "quantity", "ea"];
      var priceKeywords = ["단가", "price", "단위가격", "금액"];

      function matchCol(header, keywords) {
        var h = String(header).toLowerCase().replace(/\s/g, "");
        return keywords.some(function (k) { return h.indexOf(k) !== -1; });
      }

      var headerIdx = -1, nameCol = -1, specCol = -1, qtyCol = -1, priceCol = -1;
      for (var r = 0; r < Math.min(rows.length, 10); r++) {
        var row = rows[r];
        var found = false;
        for (var c = 0; c < row.length; c++) {
          if (matchCol(row[c], nameKeywords)) { nameCol = c; found = true; }
          if (matchCol(row[c], specKeywords)) specCol = c;
          if (matchCol(row[c], qtyKeywords))  qtyCol  = c;
          if (matchCol(row[c], priceKeywords)) priceCol = c;
        }
        if (found) { headerIdx = r; break; }
      }
      if (headerIdx === -1 || nameCol === -1) return [];

      var items = [];
      for (var i = headerIdx + 1; i < rows.length; i++) {
        var row2 = rows[i];
        var name = nameCol >= 0 ? String(row2[nameCol] || "").trim() : "";
        if (!name) continue;
        var spec  = specCol  >= 0 ? String(row2[specCol]  || "").trim() : "";
        var qty   = qtyCol   >= 0 ? parseFloat(String(row2[qtyCol]  || "").replace(/,/g, "")) || 0 : 0;
        var price = priceCol >= 0 ? parseFloat(String(row2[priceCol] || "").replace(/,/g, "")) || 0 : 0;
        items.push({ name: name, spec: spec, qty: qty, price: price });
      }
      return items;
    }

    function fillPoomRows(items) {
      var container = document.getElementById("poom-rows");
      if (!container) return;
      container.innerHTML = "";
      items.forEach(function (item) {
        addPoomRow(item);
      });
      updatePoomTotal();
    }

    // 초기 행 2개
    addPoomRow(); addPoomRow();

    // 파일 업로드 이벤트
    var uploadArea = document.getElementById("poom-upload-area");
    var fileInput  = document.getElementById("poom-file-input");
    if (uploadArea && fileInput) {
      uploadArea.addEventListener("click", function () { fileInput.click(); });
      uploadArea.addEventListener("dragover", function (e) { e.preventDefault(); uploadArea.style.borderColor = "var(--accent)"; });
      uploadArea.addEventListener("dragleave", function () { uploadArea.style.borderColor = "var(--border)"; });
      uploadArea.addEventListener("drop", function (e) {
        e.preventDefault();
        uploadArea.style.borderColor = "var(--border)";
        var file = e.dataTransfer.files[0];
        if (file) handleEstimateFile(file);
      });
      fileInput.addEventListener("change", function () {
        if (fileInput.files[0]) handleEstimateFile(fileInput.files[0]);
        fileInput.value = "";
      });
    }

    // 학교교육과정운영계획 체크박스 → 자동 입력
    var planEduCheck = document.getElementById("poom-plan-edu");
    if (planEduCheck) {
      planEduCheck.addEventListener("change", function () {
        var planEl = document.getElementById("poom-plan");
        var dateEl = document.getElementById("poom-plan-date");
        var year   = parseInt(getValue("poom-year")) || new Date().getFullYear();
        if (planEduCheck.checked) {
          if (planEl) { planEl.value = year + "학년도 학교교육과정운영계획"; planEl.disabled = true; }
          if (dateEl) { dateEl.value = year + "-03-02"; dateEl.disabled = true; }
        } else {
          if (planEl) { planEl.value = ""; planEl.disabled = false; }
          if (dateEl) { dateEl.value = ""; dateEl.disabled = false; }
        }
      });
    }

    var poomTypeEl = document.getElementById("poom-type");
    if (poomTypeEl) {
      poomTypeEl.addEventListener("change", function () { renderPoomExtraFields(poomTypeEl.value); });
    }

    var poomAddBtn = document.getElementById("poom-add-row");
    if (poomAddBtn) poomAddBtn.addEventListener("click", function () { addPoomRow(); });

    var poomGenBtn = document.getElementById("poom-gen-btn");
    if (poomGenBtn) poomGenBtn.addEventListener("click", generatePoom);

    var poomClearBtn = document.getElementById("poom-clear-btn");
    if (poomClearBtn) {
      poomClearBtn.addEventListener("click", function () {
        ["poom-year","poom-title","poom-plan","poom-plan-date","poom-purpose"]
          .forEach(function (id) { var el = document.getElementById(id); if (el) { el.value = id === "poom-year" ? "2026" : ""; el.disabled = false; } });
        var chk = document.getElementById("poom-plan-edu");
        if (chk) chk.checked = false;
        var rows = document.getElementById("poom-rows");
        if (rows) rows.innerHTML = "";
        addPoomRow(); addPoomRow();
        updatePoomTotal();
        var tEl = document.getElementById("poom-out-title");
        var gEl = document.getElementById("poom-out-gaeyo");
        var iEl = document.getElementById("poom-out-items");
        if (tEl) tEl.textContent = "";
        if (gEl) gEl.textContent = "";
        if (iEl) iEl.textContent = "";
        var stEl = document.getElementById("poom-upload-status");
        if (stEl) { stEl.textContent = ""; stEl.style.display = "none"; }
      });
    }

    function copyEl(id) {
      var el = document.getElementById(id);
      var text = el ? el.textContent : "";
      if (text && navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
    }
    var pcTitle = document.getElementById("poom-copy-title");
    var pcGaeyo = document.getElementById("poom-copy-gaeyo");
    var pcItems = document.getElementById("poom-copy-items");
    if (pcTitle) pcTitle.addEventListener("click", function () { copyEl("poom-out-title"); });
    if (pcGaeyo) pcGaeyo.addEventListener("click", function () { copyEl("poom-out-gaeyo"); });
    if (pcItems) pcItems.addEventListener("click", function () { copyEl("poom-out-items"); });
  }

  window.registerPage("official_document", { render: render, init: init });
})();

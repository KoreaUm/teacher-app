(function () {
  "use strict";

  var DOCUMENT_TYPES = ["협조요청", "통보", "회신", "보고", "알림", "기타"];
  var ITEM_MARKERS = ["1.", "가.", "1)", "가)", "⑴", "㈎", "①", "㉮"];
  var REQUIRED_FIELDS = [
    ["documentType", "문서 유형"],
    ["title", "제목 또는 핵심 사안"],
    ["body", "본문 핵심 내용"],
    ["effectiveDate", "시행일자"]
  ];

  var REVIEW_PATTERNS = [
    { pattern: /2월달|[0-9]+월달/g, message: "'월달'은 중복 표현입니다. '2월'처럼 씁니다.", replace: function (v) { return v.replace("월달", "월"); } },
    { pattern: /기간 동안/g, message: "'기간 동안'은 중복될 수 있습니다. 문맥에 따라 '기간' 또는 '동안'으로 줄입니다.", replace: "기간" },
    { pattern: /매\s*([0-9]+)\s*년마다/g, message: "'매...마다'는 중복 표현입니다. '2년마다'처럼 씁니다.", replace: "$1년마다" },
    { pattern: /월요일날|화요일날|수요일날|목요일날|금요일날|토요일날|일요일날/g, message: "'요일날'은 중복 표현입니다. '월요일'처럼 씁니다.", replace: function (v) { return v.replace("날", ""); } },
    { pattern: /여러가지/g, message: "'여러가지'는 '여러 가지'로 띄어 씁니다.", replace: "여러 가지" },
    { pattern: /쓰이는 용도/g, message: "'쓰이는 용도'는 중복 표현입니다. '용도'로 줄일 수 있습니다.", replace: "용도" },
    { pattern: /새로\s*신설/g, message: "'새로 신설'은 중복 표현입니다. '신설'로 줄입니다.", replace: "신설" },
    { pattern: /반드시 필요/g, message: "'반드시 필요'는 강한 표현입니다. 공문 맥락에 따라 '필요'로 완화할 수 있습니다.", replace: "필요" },
    { pattern: /속도를 줄이시오/g, message: "고압적 표현입니다. '속도를 줄여 주시기 바랍니다'처럼 안내형으로 바꿉니다.", replace: "속도를 줄여 주시기 바랍니다" },
    { pattern: /절대|엄금|필히/g, message: "강압적으로 느껴질 수 있는 표현입니다. 필요한 경우 사유와 안내 중심으로 고칩니다.", replace: null },
    { pattern: /불우\s*이웃/g, message: "낙인감을 줄 수 있는 표현입니다. '어려운 이웃' 등 중립 표현을 검토합니다.", replace: "어려운 이웃" }
  ];

  function trim(value) {
    return String(value == null ? "" : value).trim();
  }

  function splitLines(value) {
    return trim(value).split(/\r?\n/).map(function (line) { return trim(line); }).filter(Boolean);
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function normalizeDate(value) {
    var raw = trim(value);
    if (!raw) return "";
    var matched = raw.match(/^(\d{4})[.\-\/년\s]+(\d{1,2})[.\-\/월\s]+(\d{1,2})\.?일?$/);
    if (!matched) return raw;
    return Number(matched[1]) + ". " + Number(matched[2]) + ". " + Number(matched[3]) + ".";
  }

  function normalizeTime(value) {
    return trim(value).replace(/\b([01]?\d|2[0-3])\s*[:：]\s*([0-5]\d)\b/g, function (_, hour, minute) {
      return String(hour).padStart(2, "0") + ":" + minute;
    });
  }

  function koreanNumberUnder10000(num) {
    var digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    var units = ["", "십", "백", "천"];
    var value = Number(num);
    var result = "";
    String(value).split("").reverse().forEach(function (digit, index) {
      var n = Number(digit);
      if (!n) return;
      result = digits[n] + units[index] + result;
    });
    return result || "영";
  }

  function koreanAmount(num) {
    var value = Number(num);
    if (!Number.isFinite(value) || value < 0) return "";
    var parts = [];
    var eok = Math.floor(value / 100000000);
    var man = Math.floor((value % 100000000) / 10000);
    var rest = value % 10000;
    if (eok) parts.push(koreanNumberUnder10000(eok) + "억");
    if (man) parts.push(koreanNumberUnder10000(man) + "만");
    if (rest) parts.push(koreanNumberUnder10000(rest));
    return parts.join("") || "영";
  }

  function normalizeAmount(value) {
    return trim(value).replace(/금?\s*([0-9][0-9,]*)\s*원(?!\()/g, function (_, amount) {
      var number = Number(amount.replace(/,/g, ""));
      if (!Number.isFinite(number)) return amount + "원";
      return "금" + number.toLocaleString("ko-KR") + "원(금" + koreanAmount(number) + "원)";
    });
  }

  function normalizeBodyText(value) {
    return normalizeAmount(normalizeTime(trim(value))).replace(/\n{3,}/g, "\n\n");
  }

  function formatAttachments(lines) {
    if (!lines.length) return "";
    if (lines.length === 1) return "붙임  " + lines[0] + " 1부.  끝.";
    return lines.map(function (item, index) {
      var prefix = index === 0 ? "붙임  " : "      ";
      var suffix = index === lines.length - 1 ? "  끝." : "";
      return prefix + (index + 1) + ". " + item + " 1부." + suffix;
    }).join("\n");
  }

  function formatRecipientHeader(recipients, via) {
    if (!recipients.length) return "";
    var viaText = via ? "(경유  " + via + ")" : "";
    if (recipients.length > 1) return "수신  수신자 참조" + (viaText ? "\n" + viaText : "");
    return "수신  " + recipients[0] + (viaText ? " " + viaText : "");
  }

  function formatRecipientReference(recipients, references) {
    var lines = [];
    if (recipients.length > 1) lines.push("수신자  " + recipients.join(", "));
    if (references.length) lines.push("참조  " + references.join(", "));
    return lines.join("\n");
  }

  function formatBasis(lines) {
    if (!lines.length) return "";
    if (lines.length === 1) return "1. 관련: " + lines[0];
    var koreanMarkers = ["가", "나", "다", "라", "마", "바", "사", "아", "자", "차", "카", "타", "파", "하"];
    return "1. 관련 근거\n" + lines.map(function (line, index) {
      return "  " + (koreanMarkers[index] || String(index + 1)) + ". " + line;
    }).join("\n");
  }

  function formatBody(lines, hasBasis) {
    if (!lines.length) return "";
    if (!hasBasis && lines.length === 1) return lines[0];
    return lines.map(function (line, index) {
      var number = hasBasis ? index + 2 : index + 1;
      return number + ". " + line;
    }).join("\n");
  }

  function validateDraftInput(input) {
    var missing = [];
    REQUIRED_FIELDS.forEach(function (item) {
      if (!trim(input[item[0]])) missing.push(item[1]);
    });
    return missing;
  }

  // 구조화된 입력값을 공문 초안으로 변환합니다.
  function buildDraft(input) {
    var data = input || {};
    var recipients = splitLines(data.recipients);
    var references = splitLines(data.references);
    var basis = splitLines(data.basis);
    var bodyLines = splitLines(data.body).map(normalizeBodyText);
    var attachments = splitLines(data.attachments);
    var header = [
      trim(data.senderOrg),
      formatRecipientHeader(recipients, trim(data.via)),
      "제목  " + trim(data.title)
    ].filter(Boolean).join("\n");
    var main = [formatBasis(basis), formatBody(bodyLines, basis.length > 0)].filter(Boolean).join("\n\n");
    if (!attachments.length) main = main ? main + "  끝." : "끝.";
    var attachmentText = formatAttachments(attachments);
    var recipientReference = formatRecipientReference(recipients, references);
    var closing = [
      attachmentText,
      trim(data.senderTitle),
      recipientReference,
      "시행  " + normalizeDate(data.effectiveDate),
      (trim(data.senderDept) || trim(data.senderName)) ? "담당  " + [trim(data.senderDept), trim(data.senderName)].filter(Boolean).join(" ") : ""
    ].filter(Boolean).join("\n");
    return [header, main, closing].filter(Boolean).join("\n\n");
  }

  // 이미 작성한 공문을 PDF 기준 핵심 규칙으로 점검합니다.
  function reviewDocument(text) {
    var source = trim(text);
    var findings = [];
    var suggestion = source;
    if (!source) return { findings: [{ type: "누락", message: "검토할 공문 내용을 입력해 주세요." }], suggestion: "" };
    if (!/수신/.test(source)) findings.push({ type: "두문", message: "두문에 '수신' 항목이 보이지 않습니다." });
    if (!/제목/.test(source)) findings.push({ type: "두문", message: "두문에 '제목' 항목이 보이지 않습니다." });
    if (!/끝\./.test(source)) findings.push({ type: "결문", message: "본문 또는 붙임 끝에 '끝.' 표기가 필요합니다." });
    if (/붙임/.test(source) && !/붙임\s+/.test(source)) findings.push({ type: "붙임", message: "'붙임' 뒤에는 한 글자 정도 띄어 씁니다." });
    if (/\d{4}\.\d{1,2}\.\d{1,2}\.?/.test(source)) findings.push({ type: "날짜", message: "날짜는 '2025. 1. 6.'처럼 점 뒤에 한 칸을 둡니다." });
    if (/금?\s*[0-9][0-9,]*\s*원(?!\()/.test(source)) findings.push({ type: "금액", message: "금액은 '금13,500원(금일만삼천오백원)'처럼 한글 금액을 함께 적습니다." });

    REVIEW_PATTERNS.forEach(function (rule) {
      var matches = source.match(rule.pattern);
      if (!matches) return;
      findings.push({ type: "표현", message: rule.message, examples: Array.from(new Set(matches)).slice(0, 3) });
      if (rule.replace) suggestion = suggestion.replace(rule.pattern, rule.replace);
    });
    suggestion = normalizeAmount(suggestion.replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})\.?/g, function (_, y, m, d) {
      return y + ". " + Number(m) + ". " + Number(d) + ".";
    }));
    return { findings: findings, suggestion: suggestion };
  }

  window.OfficialDocumentRules = {
    DOCUMENT_TYPES: DOCUMENT_TYPES,
    ITEM_MARKERS: ITEM_MARKERS,
    validateDraftInput: validateDraftInput,
    buildDraft: buildDraft,
    reviewDocument: reviewDocument,
    normalizeDate: normalizeDate,
    normalizeAmount: normalizeAmount,
    splitLines: splitLines,
    escapeRegExp: escapeRegExp
  };
})();

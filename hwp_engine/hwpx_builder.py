# -*- coding: utf-8 -*-
"""
hwpx_builder.py — 깔끔 템플릿 기반 hwpx 자동 생성

한글 프로그램 설치 없이 hwpx 파일을 생성한다.
원리:
  1) template_master.hwpx 예시를 wrapper로 사용
     (예시 파일이 각 디자인 요소를 라벨링한 상태로 제공됨)
  2) section0.xml의 최상위 <hp:p> 블록을 fragment library로 추출
  3) 사용자 마크다운을 fragment에 매핑 + 텍스트 치환
  4) 새 section0.xml로 교체하여 re-zip

CLI:
  python3 hwpx_builder.py INPUT_MARKDOWN_TXT OUTPUT_HWPX

마크다운 태그:
  제목:        → 단순 문서 제목 (네모: 처럼 처리)
  대제목: 제목  → 큰 박스 (#0 fragment)
  중제목: 제목  → 중박스 + 부서명 부제 가능 (#3 fragment)
  소제목: 제목  → Ⅰ 박스 (#5 fragment) — 자동 로마숫자
  서론/배경/상단박스: 본문 → 글상자 (#7 fragment)
  네모: 텍스트   → □ 라벨 본문
  원/바/별/당구/주석: → 들여쓰기 본문
  표: a:b:c     → 표 (#10 fragment, 동적 행 수)
  시간계획표:   → 같음 (HH:MM 보존)
  | a | b |     → markdown 표 (#10 fragment)
"""
import os, sys, re, json, copy, shutil, zipfile
from xml.etree import ElementTree as ET

# ─── 네임스페이스 ────────────────────────────────────────
NS_DECLS = [
    ('ha',          'http://www.hancom.co.kr/hwpml/2011/app'),
    ('hp',          'http://www.hancom.co.kr/hwpml/2011/paragraph'),
    ('hp10',        'http://www.hancom.co.kr/hwpml/2016/paragraph'),
    ('hs',          'http://www.hancom.co.kr/hwpml/2011/section'),
    ('hc',          'http://www.hancom.co.kr/hwpml/2011/core'),
    ('hh',          'http://www.hancom.co.kr/hwpml/2011/head'),
    ('hhs',         'http://www.hancom.co.kr/hwpml/2011/history'),
    ('hm',          'http://www.hancom.co.kr/hwpml/2011/master-page'),
    ('hpf',         'http://www.hancom.co.kr/schema/2011/hpf'),
    ('dc',          'http://purl.org/dc/elements/1.1/'),
    ('opf',         'http://www.idpf.org/2007/opf/'),
    ('ooxmlchart',  'http://www.hancom.co.kr/hwpml/2016/ooxmlchart'),
    ('hwpunitchar', 'http://www.hancom.co.kr/hwpml/2016/HwpUnitChar'),
    ('epub',        'http://www.idpf.org/2007/ops'),
    ('config',      'urn:oasis:names:tc:opendocument:xmlns:config:1.0'),
]
for prefix, uri in NS_DECLS:
    ET.register_namespace(prefix, uri)

HP = NS_DECLS[1][1]   # paragraph ns
HS = NS_DECLS[3][1]   # section ns

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template_master.hwpx')

ROMAN = ['', 'Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ']


# ─── 1. Fragment 로더 (template_master.hwpx의 라벨된 블록 기준) ──
# 예시1.hwpx 의 top-level <hp:p> 인덱스 → 의미
#   #0  대제목 (3×2 표, 큰 디자인)
#   #3  중제목 (4×2 표, 부서명 부제 포함)
#   #5  소제목 (1×3 표, Ⅰ 박스 + 제목)
#   #7  글상자 (1×1 표) — 강조 상단박스용
#   #10 일반 표 (3×4) — 추진업무 표
#   #19 본문 라벨 (단순 단락, □ 운영 절차)
#   #20 큰 표 (13×4) — 운영 절차 표
def load_fragments():
    with zipfile.ZipFile(TEMPLATE_PATH) as z:
        raw = z.read('Contents/section0.xml')
    root = ET.fromstring(raw)
    top_ps = [c for c in root if c.tag == f'{{{HP}}}p']
    if len(top_ps) < 21:
        raise RuntimeError(f'템플릿 fragment 부족: top_ps={len(top_ps)}')
    return {
        'daejemok':   top_ps[0],    # 대제목
        'jungjemok':  top_ps[3],    # 중제목 (+ 부서명)
        'sojemok':    top_ps[5],    # 소제목 (Ⅰ 박스)
        'geulsangja': top_ps[7],    # 글상자
        'overview_table': top_ps[10],  # 일반 표 (3×4)
        'body_label': top_ps[19],   # 단락 (□ 운영 절차)
        'big_table':  top_ps[20],   # 큰 표 (13×4)
    }, root


def text_runs(elem):
    return list(elem.iter(f'{{{HP}}}t'))


def replace_nonempty(elem, values):
    """elem 안 hp:t 중 strip 후 비어있지 않은 것만 순서대로 values로 교체.
    placeholder/빈 셀은 건드리지 않음."""
    idx = 0
    for t in elem.iter(f'{{{HP}}}t'):
        cur = (t.text or '').strip()
        if cur:
            if idx < len(values):
                v = values[idx]
                t.text = v if v else ' '
                idx += 1


# ─── 2. 고유 ID 생성기 ───────────────────────────────────
_id_counter = [2000000000]
def _next_id():
    _id_counter[0] += 1
    return str(_id_counter[0])

_zorder_counter = [100]
def _next_zorder():
    _zorder_counter[0] += 1
    return str(_zorder_counter[0])

def reassign_ids(elem):
    """fragment 클론 시 모든 표/도형 id + zOrder를 새로 부여 (HWP hang 방지)"""
    for tbl in elem.iter(f'{{{HP}}}tbl'):
        tbl.set('id', _next_id())
        if tbl.get('zOrder') is not None:
            tbl.set('zOrder', _next_zorder())
    for tag in ('rect','line','pic','curve','polygon','ellipse','connectLine','container','ole','equation','compose'):
        for sh in elem.iter(f'{{{HP}}}{tag}'):
            sh.set('id', _next_id())
            if sh.get('zOrder') is not None:
                sh.set('zOrder', _next_zorder())
    for p in elem.iter(f'{{{HP}}}p'):
        if p.get('id') and p.get('id') != '0':
            p.set('id', _next_id())


def _clone(elem):
    f = copy.deepcopy(elem)
    reassign_ids(f)
    return f


# ─── 3. Fragment 빌더 ────────────────────────────────────
def _set_text(t_elem, value):
    """빈 문자열 방지 (Windows HWP가 <hp:t/> 거부)"""
    t_elem.text = value if value else ' '


def build_daejemok(frag_lib, title):
    """대제목 (#0): 원본 '대제목' 위치에 제목"""
    f = _clone(frag_lib['daejemok'])
    replace_nonempty(f, [title])
    return f


def build_jungjemok(frag_lib, title, dept=''):
    """중제목 (#3): 원본 '중제목'·'부서명' 두 곳"""
    f = _clone(frag_lib['jungjemok'])
    replace_nonempty(f, [title, dept or ' '])
    return f


def build_sojemok(frag_lib, num_label, title):
    """소제목 (#5): 원본 'Ⅰ'·' 소제목' 두 곳"""
    f = _clone(frag_lib['sojemok'])
    replace_nonempty(f, [num_label, f' {title}' if title else ' '])
    return f


def build_geulsangja(frag_lib, body):
    """글상자 (#7): 원본 ' 글상자' 한 곳"""
    f = _clone(frag_lib['geulsangja'])
    replace_nonempty(f, [f' {body}'])
    return f


def build_body_label(frag_lib, text):
    """본문 □ 라벨 (#19): 원본 '□ 운영 절차 (이건 운영절차 예시 표)' 한 곳"""
    f = _clone(frag_lib['body_label'])
    replace_nonempty(f, [f'□ {text}'])
    return f


def build_body_text(frag_lib, text):
    """일반 본문 단락 (□ 없이)"""
    f = _clone(frag_lib['body_label'])
    replace_nonempty(f, [text])
    return f


def _fill_table_cells(tbl, rows, src_col_count):
    """표 셀에 행 데이터 채우기.
    rows: 사용자 데이터, src_col_count: 템플릿 표의 열 개수
    템플릿의 셀 순서대로 텍스트 run을 찾아 채움.
    """
    trs = tbl.findall(f'{{{HP}}}tr')
    def normalize(row):
        r = list(row) + [''] * max(0, src_col_count - len(row))
        return r[:src_col_count]
    for ri, tr in enumerate(trs):
        if ri >= len(rows): break
        cells = tr.findall(f'{{{HP}}}tc')
        vals = normalize(rows[ri])
        for tc, val in zip(cells, vals):
            ts = text_runs(tc)
            if ts:
                ts[0].text = val if val else ' '
                for t in ts[1:]:
                    t.text = ' '


def build_table(frag_lib, rows):
    """일반 표 — fragment #10 (3×4)
    템플릿의 행 수에 사용자 데이터 행 수 맞춰 클론/추가.
    """
    if not rows:
        return build_body_text(frag_lib, '')
    f = _clone(frag_lib['overview_table'])
    tbl = f.find(f'.//{{{HP}}}tbl')
    if tbl is None:
        return build_body_text(frag_lib, ' | '.join(' | '.join(r) for r in rows))

    src_col_count = int(tbl.get('colCnt', '4'))
    trs = tbl.findall(f'{{{HP}}}tr')

    # 데이터 행이 부족하면 마지막 데이터 행을 클론해서 추가
    if len(trs) >= 2 and len(rows) > len(trs):
        template_data_tr = trs[-1]
        need = len(rows) - len(trs)
        for _ in range(need):
            new_tr = copy.deepcopy(template_data_tr)
            reassign_ids(new_tr)
            # 새 tr 안의 텍스트 비우기 (다음 _fill_table_cells가 채움)
            for t in new_tr.iter(f'{{{HP}}}t'):
                t.text = ' '
            tbl.append(new_tr)
    # 데이터 행이 남으면 잘라냄
    elif len(trs) > len(rows):
        for tr in trs[len(rows):]:
            tbl.remove(tr)

    _fill_table_cells(tbl, rows, src_col_count)
    tbl.set('rowCnt', str(len(rows)))
    return f


# ─── 4. 마크다운 파서 ────────────────────────────────────
TAG_RE = re.compile(
    r'^(제목|기관|학교|학교명|기관명|소속|부서'
    r'|대제목|중제목|소제목|로마소제목|중제목번호'
    r'|서론|배경|상단박스|글상자'
    r'|네모|원|동그라미|바|별|당구|주석|주석1|주석2'
    r'|붙임|시간계획표|표|개요표)\s*[:：]\s*(.*)$'
)
TABLE_ROW_RE = re.compile(r'^\|(.+)\|\s*$')

def parse_markdown(text):
    blocks = []
    for raw in text.split('\n'):
        s = raw.strip()
        if not s:
            blocks.append(('blank', ''))
            continue
        m = TABLE_ROW_RE.match(s)
        if m and not re.match(r'^[\s\-:|]+$', m.group(1)):
            cells = [c.strip() for c in m.group(1).split('|')]
            blocks.append(('table_row', cells))
            continue
        if m:
            continue
        m = TAG_RE.match(s)
        if m:
            blocks.append((m.group(1), m.group(2).strip()))
        else:
            blocks.append(('본문', s))
    return blocks


def parse_schedule_row(text):
    """시간계획표/표 행 파싱: HH:MM 시간 보호"""
    s = text.strip()
    m = re.match(r'^\s*(\d{1,2}:\d{2})\s*[:~∼\-]\s*(\d{1,2}:\d{2})\s*[:：]\s*(.+)$', s)
    if m:
        rest = m.group(3).strip()
        parts = [p.strip() for p in re.split(r'\s*[:：]\s*', rest) if p.strip()]
        activity = parts[0] if parts else rest
        note = ' / '.join(parts[1:]) if len(parts) > 1 else ''
        return [f'{m.group(1)} ~ {m.group(2)}', activity, note]
    # HH:MM 패턴 보호 후 ':' 분리 (lambda 사용 — re.sub repl 문자열의 \x 이스케이프 회피)
    protected = re.sub(r'(\d{1,2}):(\d{2})', lambda m: f'{m.group(1)}\x00{m.group(2)}', s)
    cells = [p.strip().replace('\x00', ':') for p in protected.split(':')]
    return [c for c in cells if c is not None]


# ─── 5. 빌드 메인 ────────────────────────────────────────
def build_hwpx(markdown_text, output_path):
    frag_lib, src_root = load_fragments()
    blocks = parse_markdown(markdown_text)

    # 사전 스캔: 기관/학교 정보
    institution = ''
    for k, v in blocks:
        if k in ('기관','학교','학교명','기관명','소속','부서') and not institution:
            institution = v

    # 새 root: 빈 root 복제 후 자식 모두 제거
    new_root = copy.deepcopy(src_root)
    for child in list(new_root):
        if child.tag == f'{{{HP}}}p':
            new_root.remove(child)

    used_cover = False
    dae_counter = 0
    jung_counter = 0
    so_counter = 0
    pending_table = []
    pending_table_keys = ('표','시간계획표','개요표')

    def flush_table():
        nonlocal pending_table
        if pending_table:
            new_root.append(build_table(frag_lib, pending_table))
            pending_table = []

    for kind, val in blocks:
        # 표 라인 누적
        if kind == 'table_row':
            pending_table.append(val)
            continue
        elif kind in pending_table_keys:
            pending_table.append(parse_schedule_row(val))
            continue
        else:
            flush_table()

        # 디스패치
        if kind == '제목':
            # 단순 제목 — 대제목으로 처리 (한 번만)
            if not used_cover:
                new_root.append(build_daejemok(frag_lib, val))
                used_cover = True
            else:
                new_root.append(build_body_label(frag_lib, val))
        elif kind == '대제목':
            dae_counter += 1
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            label, body = (mm.group(1), mm.group(2)) if mm else (str(dae_counter), val)
            # 대제목은 단일 큰 박스 — 번호는 제목에 prefix
            display = f'{label}. {body}' if mm else body
            new_root.append(build_daejemok(frag_lib, display))
        elif kind == '중제목':
            jung_counter += 1
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                # '중제목: 부서: 제목' 형식 — label은 부서명으로
                new_root.append(build_jungjemok(frag_lib, mm.group(2), mm.group(1)))
            else:
                new_root.append(build_jungjemok(frag_lib, val, institution))
        elif kind in ('소제목','로마소제목','중제목번호'):
            so_counter += 1
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                label, body = mm.group(1), mm.group(2)
            else:
                label = ROMAN[min(so_counter, len(ROMAN)-1)] if kind != '중제목번호' else str(so_counter)
                body = val
            new_root.append(build_sojemok(frag_lib, label, body))
        elif kind in ('서론','배경','상단박스','글상자'):
            new_root.append(build_geulsangja(frag_lib, val))
        elif kind in ('기관','학교','학교명','기관명','소속','부서'):
            pass  # 이미 institution 변수로 사용됨
        elif kind == '네모':
            new_root.append(build_body_label(frag_lib, val))
        elif kind == '붙임':
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                new_root.append(build_sojemok(frag_lib, f'붙임{mm.group(1)}', mm.group(2)))
            else:
                new_root.append(build_sojemok(frag_lib, '붙임', val))
        elif kind in ('원','동그라미'):
            new_root.append(build_body_text(frag_lib, f'  ○ {val}'))
        elif kind == '바':
            new_root.append(build_body_text(frag_lib, f'     - {val}'))
        elif kind == '별':
            new_root.append(build_body_text(frag_lib, f'      ▪ {val}'))
        elif kind == '당구':
            new_root.append(build_body_text(frag_lib, f'    ※ {val}'))
        elif kind in ('주석','주석1','주석2'):
            mark = '**' if kind == '주석2' else '*'
            new_root.append(build_body_text(frag_lib, f'    {mark} {val}'))
        elif kind == '본문':
            new_root.append(build_body_text(frag_lib, val))
        elif kind == 'blank':
            new_root.append(build_body_text(frag_lib, ' '))
    flush_table()

    # 빈 <hp:t> 방지 (Windows HWP 호환)
    for t in new_root.iter(f'{{{HP}}}t'):
        if not t.text:
            t.text = ' '

    # 직렬화
    body = ET.tostring(new_root, encoding='UTF-8')
    if not body.startswith(b'<?xml'):
        body = b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + body
    else:
        body = re.sub(rb'^<\?xml[^?]*\?>', b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>', body)

    # 원본 <hs:sec ...> opening tag 복원 (14개 ns 선언 유지)
    with zipfile.ZipFile(TEMPLATE_PATH) as z:
        orig = z.read('Contents/section0.xml').decode('utf-8')
    m_orig = re.search(r'<hs:sec\b[^>]*>', orig)
    m_new  = re.search(rb'<hs:sec\b[^>]*>', body)
    if m_orig and m_new:
        body = body[:m_new.start()] + m_orig.group(0).encode('utf-8') + body[m_new.end():]

    # re-zip
    shutil.copyfile(TEMPLATE_PATH, output_path)
    tmp = output_path + '.tmp'
    with zipfile.ZipFile(output_path, 'r') as zin:
        with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'Contents/section0.xml':
                    zout.writestr(item, body)
                else:
                    zout.writestr(item, zin.read(item.filename))
    os.replace(tmp, output_path)

    return {'ok': True, 'blocks': len(blocks), 'savedTo': output_path}


# ─── 6. CLI ─────────────────────────────────────────────
if __name__ == '__main__':
    try:
        if len(sys.argv) < 3:
            print(json.dumps({'ok': False, 'error': 'usage: hwpx_builder.py INPUT_TXT OUTPUT_HWPX'}, ensure_ascii=False))
            sys.exit(1)
        with open(sys.argv[1], encoding='utf-8') as f:
            md = f.read()
        result = build_hwpx(md, sys.argv[2])
        print(json.dumps(result, ensure_ascii=False))
        sys.exit(0 if result.get('ok') else 1)
    except Exception as e:
        import traceback
        print(json.dumps({'ok': False, 'error': str(e), 'trace': traceback.format_exc()}, ensure_ascii=False))
        sys.exit(1)

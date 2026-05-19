# -*- coding: utf-8 -*-
"""
hwpx_builder.py — 교육청 표준 양식 기반 hwpx 자동 생성

한글 프로그램 설치 없이 hwpx 파일을 생성한다.
template_master.hwpx (실제 교육청 공문)를 wrapper로 사용해서
풍부한 디자인(핑크 헤더/Ⅰ 박스/표 등)을 그대로 재사용.

CLI:
  python3 hwpx_builder.py INPUT_MARKDOWN_TXT OUTPUT_HWPX
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

HP = NS_DECLS[1][1]
HS = NS_DECLS[3][1]

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template_master.hwpx')

ROMAN = ['', 'Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ']


# ─── Fragment 로더 ──────────────────────────────────────
# template_master.hwpx의 top-level <hp:p> 인덱스 → 의미
#   #0  대제목 (5×3 표): 핑크 막대 + 부제2줄 + 큰 제목
#   #1  부서명 (단순 단락, 우측정렬 빨강)
#   #3  소제목 박스: Ⅰ(핑크박스) + 굵은 제목
#   #4  ◦ 본문 (들여쓰기 본문)
#   #20 □ 본문 라벨 (굵은 □ 제목)
#   #24 작은 표 (2×3) — 일반 표
#   #27 일정표 (3×5)
#   #28 ※ 주석 (들여쓰기)
FRAGMENT_INDEX = {
    'daejemok':     0,
    'buseo':        1,
    'sojemok':      3,
    'ocircle':      4,
    'sq_label':     20,
    'table_small':  24,
    'table_sched':  27,
    'note_star':    28,
}

def load_fragments():
    with zipfile.ZipFile(TEMPLATE_PATH) as z:
        raw = z.read('Contents/section0.xml')
    root = ET.fromstring(raw)
    top_ps = [c for c in root if c.tag == f'{{{HP}}}p']
    need = max(FRAGMENT_INDEX.values()) + 1
    if len(top_ps) < need:
        raise RuntimeError(f'템플릿 fragment 부족: top_ps={len(top_ps)} (need ≥{need})')
    return {name: top_ps[idx] for name, idx in FRAGMENT_INDEX.items()}, root


# ─── 고유 ID 생성기 ──────────────────────────────────────
_id_counter = [2000000000]
def _next_id():
    _id_counter[0] += 1
    return str(_id_counter[0])

_zorder_counter = [100]
def _next_zorder():
    _zorder_counter[0] += 1
    return str(_zorder_counter[0])

def reassign_ids(elem):
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


# ─── 텍스트 치환 헬퍼 ──────────────────────────────────
def replace_nonempty(elem, values):
    """elem 안 hp:t 중 strip 후 비어있지 않은 것만 순서대로 values로 교체"""
    idx = 0
    for t in elem.iter(f'{{{HP}}}t'):
        cur = (t.text or '').strip()
        if cur:
            if idx < len(values):
                v = values[idx]
                t.text = v if v else ' '
                idx += 1


# ─── Fragment 빌더 ────────────────────────────────────
def build_daejemok(frag_lib, subtitle1, subtitle2, title):
    """대제목: [0]=부제1, [1]=부제2, [2]=제목"""
    f = _clone(frag_lib['daejemok'])
    replace_nonempty(f, [subtitle1 or ' ', subtitle2 or ' ', title])
    return f


def build_buseo(frag_lib, name):
    """부서명: 우측정렬 빨강"""
    f = _clone(frag_lib['buseo'])
    replace_nonempty(f, [name])
    return f


def build_sojemok(frag_lib, num_label, title):
    """소제목 박스 (Ⅰ + 제목)"""
    f = _clone(frag_lib['sojemok'])
    replace_nonempty(f, [num_label, title])
    return f


def build_ocircle(frag_lib, text):
    """◦ 본문: [0]=◦, [1]=텍스트"""
    f = _clone(frag_lib['ocircle'])
    replace_nonempty(f, ['◦', text])
    return f


def build_dash_body(frag_lib, text, marker='-'):
    """◦ fragment 재사용, marker 변경"""
    f = _clone(frag_lib['ocircle'])
    replace_nonempty(f, [marker, text])
    return f


def build_sq_label(frag_lib, text):
    """□ 본문 라벨"""
    f = _clone(frag_lib['sq_label'])
    replace_nonempty(f, [f'□ {text}'])
    return f


def build_note(frag_lib, text, marker='※'):
    """※ 주석 (마커 교체 가능)"""
    f = _clone(frag_lib['note_star'])
    replace_nonempty(f, [f'{marker} {text}'])
    return f


def build_simple_body(frag_lib, text):
    """단순 본문 — ocircle fragment에서 마커 제거"""
    f = _clone(frag_lib['ocircle'])
    replace_nonempty(f, [' ', text])
    return f


# ─── 표 빌더 ────────────────────────────────────────
def _fill_table_cells(tbl, rows, src_col_count):
    """표 셀의 첫 hp:t에 데이터, 나머지는 공백으로"""
    trs = tbl.findall(f'{{{HP}}}tr')
    def normalize(row):
        r = list(row) + [''] * max(0, src_col_count - len(row))
        return r[:src_col_count]
    for ri, tr in enumerate(trs):
        if ri >= len(rows): break
        cells = tr.findall(f'{{{HP}}}tc')
        vals = normalize(rows[ri])
        for tc, val in zip(cells, vals):
            ts = list(tc.iter(f'{{{HP}}}t'))
            if ts:
                ts[0].text = val if val else ' '
                for t in ts[1:]:
                    t.text = ' '


def build_table(frag_lib, rows, kind='small'):
    """일반 표 (small=3컬럼) 또는 일정표 (sched=5컬럼)"""
    if not rows:
        return build_simple_body(frag_lib, '')
    key = 'table_sched' if kind == 'sched' else 'table_small'
    f = _clone(frag_lib[key])
    tbl = f.find(f'.//{{{HP}}}tbl')
    if tbl is None:
        return build_simple_body(frag_lib, ' | '.join(' | '.join(r) for r in rows))
    src_col_count = int(tbl.get('colCnt', '3'))
    trs = tbl.findall(f'{{{HP}}}tr')

    if len(trs) >= 2 and len(rows) > len(trs):
        template_tr = trs[-1]
        for _ in range(len(rows) - len(trs)):
            new_tr = copy.deepcopy(template_tr)
            reassign_ids(new_tr)
            for t in new_tr.iter(f'{{{HP}}}t'):
                t.text = ' '
            tbl.append(new_tr)
    elif len(trs) > len(rows):
        for tr in trs[len(rows):]:
            tbl.remove(tr)

    _fill_table_cells(tbl, rows, src_col_count)
    tbl.set('rowCnt', str(len(rows)))
    return f


# ─── 마크다운 파서 ──────────────────────────────────
TAG_RE = re.compile(
    r'^(제목|부제|기관|학교|학교명|기관명|소속|부서'
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


def parse_table_row(text):
    """표 행 파싱: HH:MM 시간 보호"""
    s = text.strip()
    m = re.match(r'^\s*(\d{1,2}:\d{2})\s*[:~∼\-]\s*(\d{1,2}:\d{2})\s*[:：]\s*(.+)$', s)
    if m:
        rest = m.group(3).strip()
        parts = [p.strip() for p in re.split(r'\s*[:：]\s*', rest) if p.strip()]
        activity = parts[0] if parts else rest
        note = ' / '.join(parts[1:]) if len(parts) > 1 else ''
        return [f'{m.group(1)} ~ {m.group(2)}', activity, note]
    protected = re.sub(r'(\d{1,2}):(\d{2})', lambda mm: f'{mm.group(1)}\x00{mm.group(2)}', s)
    return [p.strip().replace('\x00', ':') for p in protected.split(':')]


# ─── 빌드 메인 ──────────────────────────────────────
def build_hwpx(markdown_text, output_path):
    frag_lib, src_root = load_fragments()
    blocks = parse_markdown(markdown_text)

    # 사전 스캔: 부제·기관 추출
    title = ''
    subtitle = ''
    institution = ''
    for k, v in blocks:
        if k == '제목' and not title:
            title = v
        elif k == '부제' and not subtitle:
            subtitle = v
        elif k in ('기관','학교','학교명','기관명','소속','부서') and not institution:
            institution = v

    new_root = copy.deepcopy(src_root)
    for child in list(new_root):
        if child.tag == f'{{{HP}}}p':
            new_root.remove(child)

    used_cover = False
    so_counter = 0
    pending_table = []
    pending_table_keys = ('표','시간계획표','개요표')
    pending_table_kind = ['small']

    def flush_table():
        nonlocal pending_table
        if pending_table:
            new_root.append(build_table(frag_lib, pending_table, kind=pending_table_kind[0]))
            pending_table = []
            pending_table_kind[0] = 'small'

    for kind, val in blocks:
        if kind == 'table_row':
            pending_table.append(val)
            continue
        elif kind in pending_table_keys:
            if kind == '시간계획표':
                pending_table_kind[0] = 'sched'
            pending_table.append(parse_table_row(val))
            continue
        else:
            flush_table()

        if kind == '제목' or kind == '대제목':
            if not used_cover:
                new_root.append(build_daejemok(frag_lib, subtitle, ' ', val))
                if institution:
                    new_root.append(build_buseo(frag_lib, institution))
                used_cover = True
            else:
                new_root.append(build_sq_label(frag_lib, val))
        elif kind == '부제':
            pass  # 대제목 빌드 시 이미 사용
        elif kind in ('기관','학교','학교명','기관명','소속','부서'):
            pass  # 위 institution으로 사용됨
        elif kind in ('소제목','로마소제목','대제목번호','중제목번호','중제목'):
            so_counter += 1
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                label, body = mm.group(1), mm.group(2)
            else:
                label = ROMAN[min(so_counter, len(ROMAN)-1)]
                body = val
            new_root.append(build_sojemok(frag_lib, label, body))
        elif kind in ('서론','배경','상단박스','글상자'):
            new_root.append(build_sq_label(frag_lib, val))
        elif kind == '네모':
            new_root.append(build_sq_label(frag_lib, val))
        elif kind == '붙임':
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                new_root.append(build_sojemok(frag_lib, f'붙임{mm.group(1)}', mm.group(2)))
            else:
                new_root.append(build_sojemok(frag_lib, '붙임', val))
        elif kind in ('원','동그라미'):
            new_root.append(build_ocircle(frag_lib, val))
        elif kind == '바':
            new_root.append(build_dash_body(frag_lib, val, marker='-'))
        elif kind == '별':
            new_root.append(build_dash_body(frag_lib, val, marker='▪'))
        elif kind == '당구':
            new_root.append(build_note(frag_lib, val, marker='※'))
        elif kind in ('주석','주석1','주석2'):
            mark = '**' if kind == '주석2' else '*'
            new_root.append(build_note(frag_lib, val, marker=mark))
        elif kind == '본문':
            new_root.append(build_simple_body(frag_lib, val))
        elif kind == 'blank':
            new_root.append(build_simple_body(frag_lib, ' '))
    flush_table()

    # 빈 hp:t 방지
    for t in new_root.iter(f'{{{HP}}}t'):
        if not t.text:
            t.text = ' '

    body = ET.tostring(new_root, encoding='UTF-8')
    if not body.startswith(b'<?xml'):
        body = b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + body
    else:
        body = re.sub(rb'^<\?xml[^?]*\?>', b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>', body)

    with zipfile.ZipFile(TEMPLATE_PATH) as z:
        orig = z.read('Contents/section0.xml').decode('utf-8')
    m_orig = re.search(r'<hs:sec\b[^>]*>', orig)
    m_new  = re.search(rb'<hs:sec\b[^>]*>', body)
    if m_orig and m_new:
        body = body[:m_new.start()] + m_orig.group(0).encode('utf-8') + body[m_new.end():]

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


# ─── CLI ────────────────────────────────────────────
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

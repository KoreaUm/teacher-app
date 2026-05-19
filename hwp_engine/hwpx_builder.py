# -*- coding: utf-8 -*-
"""
hwpx_builder.py — 깔끔 템플릿 기반 hwpx 자동 생성

한글 프로그램 설치 없이 hwpx 파일을 생성한다.
원리:
  1) template_master.hwpx 예시를 wrapper로 사용
  2) section0.xml의 최상위 <hp:p> 블록을 fragment library로 추출
  3) 사용자 마크다운을 fragment에 매핑 + 텍스트 치환
  4) 새 section0.xml로 교체하여 re-zip

CLI:
  python3 hwpx_builder.py INPUT_MARKDOWN_TXT OUTPUT_HWPX
"""
import os, sys, re, json, copy, shutil, zipfile
from xml.etree import ElementTree as ET

# ─── 네임스페이스 (template_master.hwpx 의 section0 선언 그대로) ───
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

HP  = NS_DECLS[1][1]   # paragraph ns
HS  = NS_DECLS[3][1]   # section ns

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template_master.hwpx')

ROMAN = ['', 'Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ','Ⅶ','Ⅷ','Ⅸ','Ⅹ','Ⅺ','Ⅻ']


# ─── 1. Fragment 추출 ─────────────────────────────────────────
def load_fragments():
    """template_master.hwpx 의 section0.xml 에서 최상위 <hp:p> 블록을 인덱스별로 반환"""
    with zipfile.ZipFile(TEMPLATE_PATH) as z:
        raw = z.read('Contents/section0.xml')
    root = ET.fromstring(raw)
    top_ps = [c for c in root if c.tag == f'{{{HP}}}p']
    return {
        'cover':           top_ps[0],   # 4색 막대 + 표지 제목 + 부제목 (4x2 표)
        'subtitle_box':    top_ps[1],   # 학교시행 박스 (3x2 표)
        'top_box':         top_ps[2],   # 녹색 상단박스 (1x1 표)
        'overview_table':  top_ps[3],   # 개요 표 (3x4 표)
        'section_heading': top_ps[4],   # Ⅰ 목적 박스 (1x3 표)
        'body_label':      top_ps[5],   # □ 본문 라벨 (단순 단락)
        'big_table':       top_ps[6],   # 큰 표 (13x4)
        'end_box':         top_ps[7] if len(top_ps) > 7 else None,
    }, root


def text_runs(elem):
    """elem 안의 모든 <hp:t> 텍스트 노드를 순서대로 반환"""
    return list(elem.iter(f'{{{HP}}}t'))


def set_run(elem, index, value):
    """N번째 <hp:t>의 텍스트를 value로 설정 (없으면 무시)"""
    rs = text_runs(elem)
    if 0 <= index < len(rs):
        rs[index].text = value


def strip_lineseg(elem):
    """<hp:linesegarray> 캐시를 모두 제거 — 한글이 다시 계산하도록"""
    for p in elem.iter(f'{{{HP}}}p'):
        for lsa in list(p.findall(f'{{{HP}}}linesegarray')):
            p.remove(lsa)


# ─── 고유 ID 생성기 (fragment 클론 시 ID 중복 방지) ─────────────
_id_counter = [2000000000]
def _next_id():
    _id_counter[0] += 1
    return str(_id_counter[0])

_zorder_counter = [100]
def _next_zorder():
    _zorder_counter[0] += 1
    return str(_zorder_counter[0])

# HWP가 ID 중복으로 hang하는 것을 방지: 클론한 fragment의 모든
# id/zOrder/instId 속성을 새 값으로 교체. 표·도형·셀 모두 포함.
ID_ATTR_NAMES = ('id', 'instId')
def reassign_ids(elem):
    # tbl 의 id + zOrder
    for tbl in elem.iter(f'{{{HP}}}tbl'):
        tbl.set('id', _next_id())
        if tbl.get('zOrder') is not None:
            tbl.set('zOrder', _next_zorder())
    # 도형 (rect/line/pic 등) — hp:* 도형류
    for tag in ('rect','line','pic','curve','polygon','ellipse','connectLine','container','ole','equation','compose'):
        for shape in elem.iter(f'{{{HP}}}{tag}'):
            shape.set('id', _next_id())
            if shape.get('zOrder') is not None:
                shape.set('zOrder', _next_zorder())
    # 일반 단락도 id 속성 보유 — 충돌은 잘 안나지만 안전하게
    for p in elem.iter(f'{{{HP}}}p'):
        if p.get('id') and p.get('id') != '0':
            p.set('id', _next_id())


def _clone(elem):
    """fragment deepcopy + 모든 ID 재할당 (HWP hang 방지)"""
    f = copy.deepcopy(elem)
    reassign_ids(f)
    return f


# ─── 2. Fragment 빌더 ────────────────────────────────────────
def build_cover(frag_lib, title, subtitle):
    f = _clone(frag_lib['cover'])
    rs = text_runs(f)
    # rs[0] = 제목, rs[1] = 부제목 (오른쪽 정렬)
    if len(rs) >= 1: rs[0].text = title or ''
    if len(rs) >= 2: rs[1].text = subtitle or ''
    strip_lineseg(f)
    return f


def build_subtitle_box(frag_lib, title, sub):
    f = _clone(frag_lib['subtitle_box'])
    rs = text_runs(f)
    if len(rs) >= 1: rs[0].text = title or ''
    # rs[1] is just spacer between title and (sub)
    if len(rs) >= 3 and sub: rs[2].text = f'({sub})'
    elif len(rs) >= 3: rs[2].text = ''
    strip_lineseg(f)
    return f


def build_top_box(frag_lib, quoted, body):
    """녹색 상단박스. quoted = 큰따옴표로 강조될 키워드, body = 본문"""
    f = _clone(frag_lib['top_box'])
    rs = text_runs(f)
    # 원본 fragment: rs[0]=따옴표 강조어, rs[1]=접미부, rs[2]=본문 설명
    if len(rs) >= 1: rs[0].text = f'  "{quoted}"' if quoted else '  '
    if len(rs) >= 2: rs[1].text = ''     # "란?" 접미부 제거 (사용자 본문에 통합)
    if len(rs) >= 3: rs[2].text = f'   {body}'
    strip_lineseg(f)
    return f


def build_section_heading(frag_lib, num_label, title):
    """소제목 박스 (Ⅰ 목적 스타일). num_label = 'Ⅰ' '1' '붙임1' 등"""
    f = _clone(frag_lib['section_heading'])
    rs = text_runs(f)
    if len(rs) >= 1: rs[0].text = num_label or ''
    if len(rs) >= 2: rs[1].text = f' {title}' if title else ''
    strip_lineseg(f)
    return f


def build_body_label(frag_lib, text):
    """본문 □ 라벨 — body_label fragment 사용, 텍스트를 ' □ 텍스트' 형태로"""
    f = _clone(frag_lib['body_label'])
    rs = text_runs(f)
    if len(rs) >= 1: rs[0].text = f' □ {text}'
    strip_lineseg(f)
    return f


def build_body_text(frag_lib, text):
    """그냥 본문 단락 (body_label fragment 재사용, □ 없이)"""
    f = _clone(frag_lib['body_label'])
    rs = text_runs(f)
    if len(rs) >= 1: rs[0].text = text
    strip_lineseg(f)
    return f


def build_table(frag_lib, rows):
    """
    개요 표 fragment를 행 개수에 맞춰 복제·치환.
    rows: list of list of str  (첫 행은 헤더로 취급)
    원본 fragment는 3행 × 4열 (헤더 1 + 데이터 2).
    """
    src = frag_lib['overview_table']
    f = _clone(src)
    tbl = f.find(f'.//{{{HP}}}tbl')
    if tbl is None or not rows:
        return build_body_text(frag_lib, ' | '.join([' | '.join(r) for r in rows]))

    trs = tbl.findall(f'{{{HP}}}tr')
    if len(trs) < 2:
        return build_body_text(frag_lib, ' | '.join([' | '.join(r) for r in rows]))

    header_tr = trs[0]
    data_tr_template = trs[1]
    src_col_count = int(tbl.get('colCnt', '4'))
    user_col_count = max((len(r) for r in rows), default=src_col_count)
    # 열 개수가 다르면 fallback (셀 너비 정의가 깨질 수 있음) — MVP에선 src_col_count 로 잘라/패딩
    def normalize(row):
        r = list(row) + [''] * max(0, src_col_count - len(row))
        return r[:src_col_count]

    # 헤더 행 채우기
    header_cells = header_tr.findall(f'{{{HP}}}tc')
    header_vals = normalize(rows[0])
    for tc, val in zip(header_cells, header_vals):
        ts = text_runs(tc)
        if ts:
            ts[0].text = val
            for t in ts[1:]:
                t.text = ''

    # 데이터 행: 기존 데이터 행 모두 제거 → 사용자 데이터로 클론
    for tr in trs[1:]:
        tbl.remove(tr)

    for row in rows[1:]:
        new_tr = copy.deepcopy(data_tr_template)
        reassign_ids(new_tr)
        cells = new_tr.findall(f'{{{HP}}}tc')
        vals = normalize(row)
        for tc, val in zip(cells, vals):
            ts = text_runs(tc)
            if ts:
                ts[0].text = val
                for t in ts[1:]:
                    t.text = ''
        tbl.append(new_tr)

    # rowCnt 속성 업데이트
    tbl.set('rowCnt', str(len(rows)))

    strip_lineseg(f)
    return f


# ─── 3. 마크다운 파서 ────────────────────────────────────────
TAG_RE = re.compile(
    r'^(제목|기관|학교|학교명|기관명|소속|부서'
    r'|서론|배경|상단박스'
    r'|소제목|대제목|중제목번호|로마소제목'
    r'|네모|중제목'
    r'|원|동그라미|바|별|당구|주석|주석1|주석2'
    r'|붙임|시간계획표|표)\s*[:：]\s*(.*)$'
)
TABLE_ROW_RE = re.compile(r'^\|(.+)\|\s*$')

def parse_markdown(text):
    """라인별 (kind, payload) 리스트로 변환"""
    blocks = []
    for raw in text.split('\n'):
        s = raw.strip()
        if not s:
            blocks.append(('blank', ''))
            continue
        # markdown table row
        m = TABLE_ROW_RE.match(s)
        if m and not re.match(r'^[\s\-:|]+$', m.group(1)):
            cells = [c.strip() for c in m.group(1).split('|')]
            blocks.append(('table_row', cells))
            continue
        if m:  # separator | --- |
            continue
        m = TAG_RE.match(s)
        if m:
            blocks.append((m.group(1), m.group(2).strip()))
        else:
            blocks.append(('본문', s))
    return blocks


# ─── 4. 빌드 (전체 파이프라인) ────────────────────────────────
def build_hwpx(markdown_text, output_path):
    frag_lib, src_root = load_fragments()
    blocks = parse_markdown(markdown_text)

    # 사전 스캔: 제목·기관
    title = ''
    subtitle = ''
    for k, v in blocks:
        if k == '제목' and not title:
            title = v
        elif k in ('기관','학교','학교명','기관명','소속','부서') and not subtitle:
            subtitle = v

    # 새 section0: 빈 root 복제 + 자식 모두 제거 후 다시 채움
    new_root = copy.deepcopy(src_root)
    for child in list(new_root):
        if child.tag == f'{{{HP}}}p':
            new_root.remove(child)

    used_cover = False
    sec_counter = 0
    # 표 모드 누적
    pending_table = []
    pending_table_keys = ('표','시간계획표')

    def flush_table():
        nonlocal pending_table
        if pending_table:
            new_root.append(build_table(frag_lib, pending_table))
            pending_table = []

    for kind, val in blocks:
        # 표 라인 누적 처리
        if kind == 'table_row':
            pending_table.append(val)
            continue
        elif kind in pending_table_keys:
            parts = [p.strip() for p in val.split(':')]
            pending_table.append(parts)
            continue
        else:
            flush_table()

        if kind == '제목':
            if not used_cover:
                new_root.append(build_cover(frag_lib, val, subtitle))
                new_root.append(build_subtitle_box(frag_lib, val, '본문'))
                used_cover = True
        elif kind in ('기관','학교','학교명','기관명','소속','부서'):
            pass  # 이미 부제목으로 사용됨
        elif kind in ('서론','배경','상단박스'):
            new_root.append(build_top_box(frag_lib, '핵심', val))
        elif kind in ('소제목','대제목','로마소제목','중제목번호'):
            sec_counter += 1
            label = ROMAN[min(sec_counter, len(ROMAN)-1)] if kind in ('소제목','로마소제목') else str(sec_counter)
            # 만약 val 이 'N:제목' 형태면 (대제목:6:제목) 우선
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                label, val = mm.group(1), mm.group(2)
            new_root.append(build_section_heading(frag_lib, label, val))
        elif kind in ('네모','중제목'):
            new_root.append(build_body_label(frag_lib, val))
        elif kind == '붙임':
            mm = re.match(r'^(\S+)\s*[:：]\s*(.+)$', val)
            if mm:
                new_root.append(build_section_heading(frag_lib, f'붙임{mm.group(1)}', mm.group(2)))
            else:
                new_root.append(build_section_heading(frag_lib, '붙임', val))
        elif kind in ('원','동그라미'):
            new_root.append(build_body_text(frag_lib, f'  ○ {val}'))
        elif kind == '바':
            new_root.append(build_body_text(frag_lib, f'     - {val}'))
        elif kind == '별':
            new_root.append(build_body_text(frag_lib, f'      ▪ {val}'))
        elif kind in ('당구',):
            new_root.append(build_body_text(frag_lib, f'    ※ {val}'))
        elif kind in ('주석','주석1','주석2'):
            mark = '**' if kind == '주석2' else '*'
            new_root.append(build_body_text(frag_lib, f'    {mark} {val}'))
        elif kind == '본문':
            new_root.append(build_body_text(frag_lib, val))
        elif kind == 'blank':
            new_root.append(build_body_text(frag_lib, ''))
    flush_table()

    # 직렬화
    body = ET.tostring(new_root, encoding='UTF-8')
    if not body.startswith(b'<?xml'):
        body = b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + body
    else:
        # ET가 xml decl을 standalone 없이 만들 수 있으니 강제 교체
        body = re.sub(rb'^<\?xml[^?]*\?>', b'<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>', body)

    # re-zip: template_master.hwpx 의 모든 항목 유지, section0.xml만 교체
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


# ─── 5. CLI ─────────────────────────────────────────────────
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

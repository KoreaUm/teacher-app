# -*- coding: utf-8 -*-
"""
한글(HWP) 자동 서식 엔진
- 이미 열려있는 한글 문서에 연결
- 텍스트를 분석해서 학교 공문 스타일로 자동 포맷
- 의존성: pywin32 (pip install pywin32)
"""

import sys
import os
import re
import json
import tempfile

# Windows에서만 동작
try:
    import win32com.client as win32
    import pythoncom
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False


# ─────────────────────────────────────────
# 1. 텍스트 파서 (정규식 기반)
# ─────────────────────────────────────────

RE_H1       = re.compile(r'^\s*(\d{1,2})\.\s+(.+)$')           # 1. 목적
RE_H2       = re.compile(r'^\s*([가나다라마바사아자차카타파하])\.\s+(.+)$')  # 가. ...
RE_H3       = re.compile(r'^\s*(\d{1,2})\)\s+(.+)$')           # 1) ...
RE_H4       = re.compile(r'^\s*([가나다라마바사아자차카타파하])\)\s+(.+)$') # 가) ...
RE_KV       = re.compile(r'^\s*([^\s:：][^:：]{0,15})\s*[:：]\s*(.+)$')  # 행사명 : ...
RE_TIME     = re.compile(r'\d{1,2}:\d{2}\s*[~∼\-–]\s*\d{1,2}:\d{2}')
RE_MONEY    = re.compile(r'(\d{1,3}(,\d{3})+|\d+)\s*원')


def classify_line(line):
    s = line.rstrip()
    stripped = s.strip()

    if not stripped:
        return 'BLANK', stripped

    # 표 행 감지: 탭 또는 2칸+ 공백으로 3토큰 이상
    parts = re.split(r'\t+| {2,}', stripped)
    is_multi_col = len(parts) >= 3
    has_time = bool(RE_TIME.search(stripped))
    has_money = bool(RE_MONEY.search(stripped))

    if (is_multi_col or has_time) and len(stripped.split()) >= 3:
        if has_money:
            return 'BUDGET_ROW', parts
        return 'TABLE_ROW', parts

    if RE_H1.match(s):
        return 'H1', stripped
    if RE_H2.match(s):
        return 'H2', stripped
    if RE_H3.match(s):
        return 'H3', stripped
    if RE_H4.match(s):
        return 'H4', stripped
    if RE_KV.match(s):
        return 'KV', stripped

    return 'BODY', stripped


def parse_text(text):
    """텍스트를 IR(중간 표현) 노드 리스트로 변환"""
    lines = text.splitlines()
    labeled = [classify_line(ln) for ln in lines]

    nodes = []
    i = 0
    while i < len(labeled):
        kind, data = labeled[i]

        if kind == 'BLANK':
            i += 1
            continue

        # 연속된 표 행을 하나의 표 노드로 묶기
        if kind in ('TABLE_ROW', 'BUDGET_ROW'):
            rows = []
            table_kind = kind
            while i < len(labeled) and labeled[i][0] == table_kind:
                cell_data = labeled[i][1]
                if isinstance(cell_data, list):
                    rows.append(cell_data)
                else:
                    rows.append([cell_data])
                i += 1
            # 열 개수를 최빈값으로 통일
            from collections import Counter
            if rows:
                width = Counter(len(r) for r in rows).most_common(1)[0][0]
                norm = [r + [''] * (width - len(r)) if len(r) < width
                        else r[:width] for r in rows]
                nodes.append({'type': 'table', 'rows': norm,
                              'budget': table_kind == 'BUDGET_ROW'})
            continue

        level_map = {'H1': 1, 'H2': 2, 'H3': 3, 'H4': 4}
        if kind in level_map:
            nodes.append({'type': 'heading', 'level': level_map[kind], 'text': data})
        elif kind == 'KV':
            nodes.append({'type': 'kv', 'text': data})
        else:
            nodes.append({'type': 'body', 'text': data})
        i += 1

    return nodes


# ─────────────────────────────────────────
# 2. 스타일 사전
# ─────────────────────────────────────────

STYLES = {
    'H1':   {'font': 'HY헤드라인M', 'size': 15, 'bold': True,  'indent': 0,   'line': 160, 'align': 'left'},
    'H2':   {'font': 'HY견고딕',    'size': 12, 'bold': False, 'indent': 200, 'line': 160, 'align': 'left'},
    'H3':   {'font': 'HY견고딕',    'size': 11, 'bold': False, 'indent': 400, 'line': 160, 'align': 'left'},
    'H4':   {'font': '맑은 고딕',   'size': 10, 'bold': False, 'indent': 600, 'line': 160, 'align': 'left'},
    'BODY': {'font': '맑은 고딕',   'size': 10, 'bold': False, 'indent': 200, 'line': 160, 'align': 'left'},
    'KV':   {'font': '맑은 고딕',   'size': 10, 'bold': False, 'indent': 200, 'line': 160, 'align': 'left'},
    'TH':   {'font': '맑은 고딕',   'size': 10, 'bold': True,  'align': 'center'},
    'TD':   {'font': '맑은 고딕',   'size': 10, 'bold': False, 'align': 'left'},
}

def style_for(node):
    if node['type'] == 'heading':
        return STYLES.get(f"H{node['level']}", STYLES['BODY'])
    if node['type'] == 'kv':
        return STYLES['KV']
    return STYLES['BODY']


# ─────────────────────────────────────────
# 3. 한글 COM 출력
# ─────────────────────────────────────────

ALIGN_MAP = {'left': 0, 'center': 1, 'right': 2, 'both': 3}
FONT_ATTRS = [
    'FaceNameHangul', 'FaceNameLatin', 'FaceNameHanja',
    'FaceNameJapanese', 'FaceNameOther', 'FaceNameSymbol', 'FaceNameUser'
]


def get_active_hwp():
    """이미 열린 한글 COM 객체 가져오기"""
    try:
        hwp = win32.GetActiveObject("HWPFrame.HwpObject")
        return hwp
    except Exception:
        return None


def get_doc_text(hwp):
    """현재 문서 텍스트를 임시 파일로 추출"""
    tmp = tempfile.mktemp(suffix='.txt')
    try:
        hwp.SaveAs(tmp, "TEXT", "")
        with open(tmp, encoding='utf-8', errors='replace') as f:
            return f.read()
    except Exception as e:
        raise RuntimeError(f"문서 텍스트 읽기 실패: {e}")
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def set_char_shape(hwp, font, size_pt, bold=False):
    act = hwp.HAction
    pset = hwp.HParameterSet.HCharShape
    act.GetDefault("CharShape", pset.HSet)
    for attr in FONT_ATTRS:
        setattr(pset, attr, font)
    pset.Height = size_pt * 100  # 1pt = 100 HWP단위
    pset.Bold = 1 if bold else 0
    act.Execute("CharShape", pset.HSet)


def set_para_shape(hwp, indent=0, line=160, align='left'):
    act = hwp.HAction
    pset = hwp.HParameterSet.HParaShape
    act.GetDefault("ParagraphShape", pset.HSet)
    pset.Indent = indent
    pset.LineSpacing = line
    pset.LineSpacingType = 0  # 글자 크기에 따라 %
    pset.AlignType = ALIGN_MAP.get(align, 0)
    act.Execute("ParagraphShape", pset.HSet)


def insert_text(hwp, text):
    act = hwp.HAction
    pset = hwp.HParameterSet.HInsertText
    act.GetDefault("InsertText", pset.HSet)
    pset.Text = text
    act.Execute("InsertText", pset.HSet)


def write_paragraph(hwp, text, style):
    set_para_shape(hwp,
                   indent=style.get('indent', 0),
                   line=style.get('line', 160),
                   align=style.get('align', 'left'))
    set_char_shape(hwp,
                   font=style['font'],
                   size_pt=style['size'],
                   bold=style.get('bold', False))
    insert_text(hwp, text)
    hwp.HAction.Run("BreakPara")


def write_table(hwp, rows, budget=False):
    if not rows:
        return

    num_rows = len(rows)
    num_cols = len(rows[0])

    # 표 생성
    act = hwp.HAction
    pset = hwp.HParameterSet.HTableCreation
    act.GetDefault("TableCreate", pset.HSet)
    pset.Rows = num_rows
    pset.Cols = num_cols
    pset.WidthType = 0   # 0 = 본문 너비에 맞춤
    pset.HeightType = 1
    pset.CreateItemArray("ColWidth", num_cols)
    col_w = 8000 // num_cols
    for i in range(num_cols):
        pset.ColWidth.SetItem(i, col_w)
    pset.CreateItemArray("RowHeight", num_rows)
    for i in range(num_rows):
        pset.RowHeight.SetItem(i, 1000)
    act.Execute("TableCreate", pset.HSet)

    # 첫 번째 셀 진입 후 순서대로 이동하며 내용 입력
    for r in range(num_rows):
        for c in range(num_cols):
            is_header = (r == 0)
            cell_style = STYLES['TH'] if is_header else STYLES['TD']
            cell_text = rows[r][c] if c < len(rows[r]) else ''

            set_char_shape(hwp,
                           font=cell_style['font'],
                           size_pt=cell_style['size'],
                           bold=cell_style.get('bold', False))
            set_para_shape(hwp, align=cell_style.get('align', 'left'),
                           line=140, indent=0)
            insert_text(hwp, cell_text)

            # 마지막 셀이 아니면 다음 셀로 이동
            if not (r == num_rows - 1 and c == num_cols - 1):
                hwp.HAction.Run("TableRightCell")

    # 표 바깥으로 나가기
    hwp.HAction.Run("CloseEx")
    hwp.HAction.Run("MoveDocEnd")
    hwp.HAction.Run("BreakPara")


# ─────────────────────────────────────────
# 4. 메인: 연결 → 읽기 → 파싱 → 지우기 → 쓰기
# ─────────────────────────────────────────

def apply_format():
    if not HAS_WIN32:
        return {'ok': False, 'error': 'pywin32가 설치되지 않았습니다. (pip install pywin32)'}

    # COM 초기화
    pythoncom.CoInitialize()

    hwp = get_active_hwp()
    if hwp is None:
        return {'ok': False, 'error': '한글 프로그램이 열려있지 않습니다. 한글을 먼저 실행하고 문서를 여세요.'}

    try:
        # 문서 텍스트 읽기
        raw_text = get_doc_text(hwp)
        if not raw_text.strip():
            return {'ok': False, 'error': '문서가 비어있습니다.'}

        # 파싱
        nodes = parse_text(raw_text)
        if not nodes:
            return {'ok': False, 'error': '서식을 적용할 내용이 없습니다.'}

        # 기존 내용 전체 삭제
        hwp.HAction.Run("MoveDocBegin")
        hwp.HAction.Run("SelectAll")
        hwp.HAction.Run("Delete")

        # 서식 적용하며 다시 쓰기
        hwp.HAction.Run("MoveDocBegin")
        for node in nodes:
            if node['type'] in ('heading', 'body', 'kv'):
                write_paragraph(hwp, node['text'], style_for(node))
            elif node['type'] == 'table':
                write_table(hwp, node['rows'], budget=node.get('budget', False))

        # 커서 맨 앞으로
        hwp.HAction.Run("MoveDocBegin")

        return {'ok': True, 'blocks': len(nodes)}

    except Exception as e:
        return {'ok': False, 'error': str(e)}
    finally:
        pythoncom.CoUninitialize()


if __name__ == '__main__':
    result = apply_format()
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if result.get('ok') else 1)

# -*- coding: utf-8 -*-
"""
hwpx_builder.py — 교육청 실제 문서 기반 fragment library hwpx 생성기

원리:
  - 실제 충청북도교육청 고교학점제 현장지원단 운영 계획 hwpx에서
    대제목/소제목/불릿/표 서식 fragment를 추출해 사용
  - 동일한 header.xml(스타일/폰트)로 새 section0.xml 조립
  - 마크다운 태그 → fragment 매핑으로 교육청 수준 서식 자동 생성

마크다운 포맷:
  제목: 문서 제목
  부제목: 부제목 (선택)
  부서: 부서명 (선택)
  대제목: 관련 근거
  ◦ 항목1
  ◦ 항목2
  소제목: 세부 추진 계획
    - 세부 내용
  표:
  헤더1 | 헤더2 | 헤더3
  값1 | 값2 | 값3
"""

import os, re, random, zipfile, shutil, html, tempfile

TEMPLATE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template_master.hwpx')

# ─── XML 섹션 헤더/푸터 ──────────────────────────────────────────────────
SEC_OPEN = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hs:sec xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0">'
SEC_CLOSE = '</hs:sec>'

# ─── 페이지 설정 단락 (A4 세로, 충청북도 표준 여백) ─────────────────────────
SECPR_PARA = '<hp:p id="0" paraPrIDRef="4" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="60"><hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4251" footer="4251" gutter="0" left="5527" right="5527" top="4251" bottom="2834"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="12" color="#000000"/><hp:noteSpacing aboveNoteLine="567" belowNoteLine="567" betweenNotes="0"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement position="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="12" color="#000000"/><hp:noteSpacing aboveNoteLine="567" belowNoteLine="567" betweenNotes="0"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement position="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 제목 단락 (중앙 정렬, 굵게 대형) ───────────────────────────────────────
# paraPr=62(CENTER), charPr=95(대형 볼드) - 실제 고교학점제 문서의 메인 타이틀
def make_title(text):
    t = html.escape(text)
    return f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="95"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1800" textheight="1800" baseline="1530" spacing="812" horzpos="0" horzsize="46776" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 부제목 단락 (중앙 정렬, 소형) ─────────────────────────────────────────
# paraPr=62(CENTER), charPr=80(소형 일반)
def make_subtitle(text):
    t = html.escape(text)
    return f'<hp:p id="2147483648" paraPrIDRef="62" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="80"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1300" textheight="1300" baseline="1105" spacing="584" horzpos="0" horzsize="46776" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 부서/기관명 단락 (우측 정렬) ───────────────────────────────────────────
# paraPr=54(RIGHT), charPr=67(14pt 일반)
def make_dept(text):
    t = html.escape(text)
    return f'<hp:p id="0" paraPrIDRef="54" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="67"><hp:t>{t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" baseline="1275" spacing="900" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray></hp:p>'

# ─── 대제목 컨테이너 (실제 교육청 서식 그대로) ──────────────────────────────
# 구조: 남색 정사각형 박스(로마자) + 흰색 바(제목 텍스트) + 파란 구분선
# 원본: 2026 고등학교 교육과정·고교학점제 현장지원단 운영 계획 section0.xml
_MAJOR_TEMPLATE = ('<hp:p id="2147483648" paraPrIDRef="67" styleIDRef="68" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="1">'
    '<hp:container id="__CID__" zOrder="0" numberingType="PICTURE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="0" instid="__INST1__">'
    '<hp:offset x="0" y="0"/><hp:orgSz width="48759" height="2248"/><hp:curSz width="48178" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="24089" centerY="1124" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    # 첫 번째 rect: 남색 박스 (로마자)
    '<hp:rect id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST2__" ratio="0">'
    '<hp:offset x="0" y="4294966709"/><hp:orgSz width="2834" height="2834"/><hp:curSz width="2800" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="1092" centerY="1123" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="-587"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="0.780169" e2="0" e3="0" e4="0" e5="0.792872" e6="587"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#000000" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#18304B" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hp:drawText lastWidth="2185" name="" editable="0">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    '<hp:p id="2147483648" paraPrIDRef="1" styleIDRef="68" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="2"><hp:t>__ROMAN__</hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1500" textheight="1500" baseline="1275" spacing="900" horzpos="0" horzsize="1616" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList>'
    '<hp:textMargin left="283" right="283" top="283" bottom="283"/>'
    '</hp:drawText>'
    '<hc:pt0 x="0" y="0"/><hc:pt1 x="2834" y="0"/><hc:pt2 x="2834" y="2834"/><hc:pt3 x="0" y="2834"/>'
    '</hp:rect>'
    # 두 번째 rect: 흰색 바 (제목 텍스트)
    '<hp:rect id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST3__" ratio="0">'
    '<hp:offset x="2834" y="63"/><hp:orgSz width="45925" height="2184"/><hp:curSz width="45377" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="22689" centerY="1123" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="2834" e4="0" e5="1" e6="63"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="-33.769234" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="1" e2="0" e3="0" e4="0" e5="1.028846" e6="-63"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#000000" width="33" style="NONE" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hc:fillBrush><hc:winBrush faceColor="#FFFFFF" hatchColor="#000000" alpha="0"/></hc:fillBrush>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hp:drawText lastWidth="45378" name="" editable="0">'
    '<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
    '<hp:p id="2147483648" paraPrIDRef="8" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
    '<hp:run charPrIDRef="3"><hp:t>__TITLE__</hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1600" textheight="1600" baseline="1360" spacing="960" horzpos="0" horzsize="44812" flags="393216"/></hp:linesegarray>'
    '</hp:p>'
    '</hp:subList>'
    '<hp:textMargin left="283" right="283" top="283" bottom="283"/>'
    '</hp:drawText>'
    '<hc:pt0 x="0" y="0"/><hc:pt1 x="45925" y="0"/><hc:pt2 x="45925" y="2184"/><hc:pt3 x="0" y="2184"/>'
    '</hp:rect>'
    # 구분선
    '<hp:line id="0" zOrder="0" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" href="" groupLevel="1" instid="__INST4__" isReverseHV="0">'
    '<hp:offset x="2834" y="2247"/><hp:orgSz width="100" height="100"/><hp:curSz width="98" height="0"/>'
    '<hp:flip horizontal="0" vertical="0"/>'
    '<hp:rotationInfo angle="0" centerX="22402" centerY="0" rotateimage="1"/>'
    '<hp:renderingInfo>'
    '<hc:transMatrix e1="1" e2="0" e3="2834" e4="0" e5="1" e6="2247"/>'
    '<hc:scaMatrix e1="0.988084" e2="0" e3="-33.769234" e4="0" e5="1" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '<hc:scaMatrix e1="453.440002" e2="0" e3="0" e4="0" e5="0" e6="0"/>'
    '<hc:rotMatrix e1="1" e2="0" e3="0" e4="0" e5="1" e6="0"/>'
    '</hp:renderingInfo>'
    '<hp:lineShape color="#173876" width="33" style="SOLID" endCap="FLAT" headStyle="NORMAL" tailStyle="NORMAL" headfill="1" tailfill="1" headSz="MEDIUM_MEDIUM" tailSz="MEDIUM_MEDIUM" outlineStyle="NORMAL" alpha="0"/>'
    '<hp:shadow type="NONE" color="#B2B2B2" offsetX="0" offsetY="0" alpha="0"/>'
    '<hc:startPt x="0" y="0"/><hc:endPt x="100" y="100"/>'
    '</hp:line>'
    '<hp:sz width="48178" widthRelTo="ABSOLUTE" height="2248" heightRelTo="ABSOLUTE" protect="0"/>'
    '<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="0" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
    '<hp:outMargin left="0" right="0" top="0" bottom="0"/>'
    '</hp:container>'
    '<hp:t> </hp:t></hp:run>'
    '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="2248" textheight="2248" baseline="1911" spacing="780" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
    '</hp:p>')

_id_counter = [10000]

def _new_id():
    _id_counter[0] += random.randint(100, 999)
    return _id_counter[0]

def make_major_heading(roman, title):
    """대제목 컨테이너 단락 생성 (남색 박스 + 파란 구분선 + 제목 텍스트)"""
    t = html.escape(title)
    r = html.escape(roman)
    cid = _new_id()
    inst1 = _new_id()
    inst2 = _new_id()
    inst3 = _new_id()
    inst4 = _new_id()
    return (_MAJOR_TEMPLATE
            .replace('__CID__', str(cid))
            .replace('__INST1__', str(inst1))
            .replace('__INST2__', str(inst2))
            .replace('__INST3__', str(inst3))
            .replace('__INST4__', str(inst4))
            .replace('__ROMAN__', r)
            .replace('__TITLE__', t))

# ─── 불릿 단락들 ──────────────────────────────────────────────────────────
def make_bullet1(text):
    """◦ 수준1 불릿 단락 (paraPr=85, charPr=37+94)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="85" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="37"><hp:t> ◦ </hp:t></hp:run>'
            f'<hp:run charPrIDRef="94"><hp:t>{t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_bullet2(text):
    """◦ 수준2 불릿 단락 (paraPr=49, charPr=89, 들여쓰기)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t> ◦ {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_dash(text):
    """- 대시 불릿 단락 (paraPr=49, charPr=89)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t>   - {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_sub_heading(text):
    """□ 소제목 단락 (paraPr=49, charPr=90, 굵게)"""
    t = html.escape(text)
    prefix = '' if text.startswith('□') else '□ '
    return (f'<hp:p id="2147483648" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="90"><hp:t>{prefix}{t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

def make_note(text):
    """※ 주석 단락 (paraPr=49, charPr=89)"""
    t = html.escape(text)
    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89"><hp:t>※ {t}</hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

# ─── 빈 줄 ───────────────────────────────────────────────────────────────
SPACER_PARA = ('<hp:p id="2147483648" paraPrIDRef="66" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
               '<hp:run charPrIDRef="142"/>'
               '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
               '</hp:p>')

SMALL_SPACER = ('<hp:p id="0" paraPrIDRef="46" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                '<hp:run charPrIDRef="51"/>'
                '<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="700" textheight="700" baseline="595" spacing="420" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
                '</hp:p>')

# ─── 표(hp:tbl) 생성 ─────────────────────────────────────────────────────
def make_table(rows):
    """표 단락 생성. rows = [['헤더1','헤더2',...], ['값1','값2',...], ...]"""
    if not rows:
        return ''
    col_cnt = max(len(r) for r in rows)
    row_cnt = len(rows)
    tbl_id = _new_id()

    total_w = 47622
    col_w = total_w // col_cnt
    col_widths = [col_w] * col_cnt
    col_widths[-1] = total_w - col_w * (col_cnt - 1)

    tr_xmls = []
    for ri, row in enumerate(rows):
        is_header = (ri == 0)
        fill_ref = '52' if is_header else '3'
        char_ref = '3' if is_header else '37'
        para_ref = '8' if is_header else '85'
        tc_xmls = []
        for ci in range(col_cnt):
            cell_text = (row[ci] if ci < len(row) else '').strip() or ' '
            t = html.escape(str(cell_text))
            w = col_widths[ci]
            tc_xml = (f'<hp:tc name="" header="0" hasMargin="0" protect="0" editable="0" dirty="0" borderFillIDRef="{fill_ref}">'
                      f'<hp:subList id="" textDirection="HORIZONTAL" lineWrap="BREAK" vertAlign="CENTER" linkListIDRef="0" linkListNextIDRef="0" textWidth="0" textHeight="0" hasTextRef="0" hasNumRef="0">'
                      f'<hp:p id="2147483648" paraPrIDRef="{para_ref}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
                      f'<hp:run charPrIDRef="{char_ref}"><hp:t>{t}</hp:t></hp:run>'
                      f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1400" textheight="1400" baseline="1190" spacing="1120" horzpos="0" horzsize="{max(100, w - 1020)}" flags="393216"/></hp:linesegarray>'
                      f'</hp:p></hp:subList>'
                      f'<hp:cellAddr colAddr="{ci}" rowAddr="{ri}"/><hp:cellSpan colSpan="1" rowSpan="1"/>'
                      f'<hp:sz width="{w}" widthRelTo="ABSOLUTE"/>'
                      f'<hp:inMargin left="510" right="510" top="141" bottom="141"/></hp:tc>')
            tc_xmls.append(tc_xml)
        tr_xmls.append(f'<hp:tr>{"".join(tc_xmls)}</hp:tr>')

    tbl_xml = (f'<hp:tbl id="{tbl_id}" zOrder="0" numberingType="TABLE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES" lock="0" dropcapstyle="None" pageBreak="CELL" repeatHeader="1" rowCnt="{row_cnt}" colCnt="{col_cnt}" cellSpacing="0" borderFillIDRef="3" noAdjust="0">'
               f'<hp:sz width="{total_w}" widthRelTo="ABSOLUTE" height="3000" heightRelTo="ABSOLUTE" protect="0"/>'
               f'<hp:pos treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="0" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT" vertOffset="0" horzOffset="0"/>'
               f'<hp:outMargin left="283" right="283" top="283" bottom="283"/>'
               f'<hp:inMargin left="510" right="510" top="141" bottom="141"/>'
               f'{"".join(tr_xmls)}</hp:tbl>')

    return (f'<hp:p id="0" paraPrIDRef="49" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">'
            f'<hp:run charPrIDRef="89">{tbl_xml}<hp:t> </hp:t></hp:run>'
            f'<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="3000" textheight="3000" baseline="2550" spacing="600" horzpos="0" horzsize="48472" flags="393216"/></hp:linesegarray>'
            f'</hp:p>')

# ─── 마크다운 파서 ─────────────────────────────────────────────────────────
ROMAN_NUMS = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ', 'Ⅶ', 'Ⅷ', 'Ⅸ', 'Ⅹ']

def parse_markdown(md_text):
    """마크다운 텍스트를 (type, content) 리스트로 파싱"""
    elements = []
    lines = md_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i].rstrip()

        if line.startswith('제목:'):
            elements.append(('title', line[3:].strip()))
        elif line.startswith('부제목:'):
            elements.append(('subtitle', line[4:].strip()))
        elif line.startswith('부서:') or line.startswith('기관:'):
            elements.append(('dept', line[3:].strip()))
        elif line.startswith('대제목:'):
            text = line[4:].strip()
            # 로마자 접두어 감지
            roman_match = re.match(r'^([ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩivxlcdmIVXLCDM]+)[\s.]\s*(.*)', text)
            if roman_match:
                roman = roman_match.group(1)
                title = roman_match.group(2).strip()
            else:
                roman = None
                title = text
            elements.append(('major_heading', (roman, title)))
        elif line.startswith('소제목:'):
            elements.append(('sub_heading', line[4:].strip()))
        elif line.strip() == '표:':
            # 다음 줄부터 표 데이터 수집
            table_rows = []
            i += 1
            while i < len(lines):
                tline = lines[i].strip()
                if not tline:
                    break
                # 구분선 스킵 (--- 또는 |---|)
                if re.match(r'^[-|: ]+$', tline):
                    i += 1
                    continue
                if '|' in tline:
                    cells = [c.strip() for c in tline.strip('|').split('|')]
                    table_rows.append(cells)
                i += 1
            if table_rows:
                elements.append(('table', table_rows))
            continue
        elif re.match(r'^[◦○]\s', line):
            text = re.sub(r'^[◦○]\s*', '', line).strip()
            elements.append(('bullet1', text))
        elif re.match(r'^\s{2,}[◦○•]\s', line):
            text = re.sub(r'^\s+[◦○•]\s*', '', line).strip()
            elements.append(('bullet2', text))
        elif re.match(r'^\s{2,}-\s', line):
            text = re.sub(r'^\s+-\s*', '', line).strip()
            elements.append(('dash', text))
        elif line.startswith('- '):
            elements.append(('bullet1', line[2:].strip()))
        elif line.startswith('• '):
            elements.append(('bullet1', line[2:].strip()))
        elif line.startswith('※'):
            elements.append(('note', line[1:].strip()))
        elif not line.strip():
            if elements and elements[-1][0] != 'spacer':
                elements.append(('spacer', ''))
        elif line.strip():
            elements.append(('bullet1', line.strip()))

        i += 1
    return elements


def assign_roman_numerals(elements):
    """대제목에 로마자 자동 배정 (없는 경우만)"""
    counter = 0
    result = []
    for kind, content in elements:
        if kind == 'major_heading':
            roman, title = content
            if roman is None:
                roman = ROMAN_NUMS[counter] if counter < len(ROMAN_NUMS) else str(counter + 1)
            counter += 1
            result.append((kind, (roman, title)))
        else:
            result.append((kind, content))
    return result


# ─── hwpx 빌더 메인 함수 ──────────────────────────────────────────────────
def build_hwpx(md_text, output_path):
    """마크다운 텍스트 → hwpx 파일 생성"""
    elements = parse_markdown(md_text)
    elements = assign_roman_numerals(elements)

    paras = [SECPR_PARA]

    prev_kind = None
    for kind, content in elements:
        if kind == 'title':
            paras.append(SPACER_PARA)
            paras.append(make_title(content))
        elif kind == 'subtitle':
            paras.append(make_subtitle(content))
        elif kind == 'dept':
            paras.append(make_dept(content))
        elif kind == 'major_heading':
            roman, title = content
            if prev_kind not in (None, 'title', 'subtitle', 'dept'):
                paras.append(SPACER_PARA)
            paras.append(SMALL_SPACER)
            paras.append(make_major_heading(roman, title))
        elif kind == 'sub_heading':
            paras.append(make_sub_heading(content))
        elif kind == 'bullet1':
            paras.append(make_bullet1(content))
        elif kind == 'bullet2':
            paras.append(make_bullet2(content))
        elif kind == 'dash':
            paras.append(make_dash(content))
        elif kind == 'note':
            paras.append(make_note(content))
        elif kind == 'table':
            paras.append(make_table(content))
        elif kind == 'spacer':
            paras.append(SPACER_PARA)

        prev_kind = kind

    paras.append(SPACER_PARA)

    section_xml = SEC_OPEN + ''.join(paras) + SEC_CLOSE

    tmp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(TEMPLATE_PATH, 'r') as z:
            z.extractall(tmp_dir)

        sec_path = os.path.join(tmp_dir, 'Contents', 'section0.xml')
        with open(sec_path, 'w', encoding='utf-8') as f:
            f.write(section_xml)

        if os.path.exists(output_path):
            os.remove(output_path)

        with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zout:
            for root, dirs, files in os.walk(tmp_dir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    arcname = os.path.relpath(fpath, tmp_dir)
                    zout.write(fpath, arcname)

        return output_path
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 3:
        print('Usage: python hwpx_builder.py <markdown_file> <output.hwpx>')
        sys.exit(1)
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        md = f.read()
    result = build_hwpx(md, sys.argv[2])
    print(f'Generated: {result}')

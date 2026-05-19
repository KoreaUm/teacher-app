
######################################################################
def 날짜검색(self, 값):
    self.대상.MovePos(2)
    좌표개수 = 0
    self.정규표현식('([0-9]+\\.\\b[0-9]+\\.\\b[0-9]+\\.)|([0-9]+\\.\\b[0-9]+\\.)|([0-9]+년)|([0-9]+월)|([0-9]+일)')
    시작지점 = self.대상.CreateSet('ListParaPos')
    끝지점 = self.대상.CreateSet('ListParaPos')
    self.대상.GetSelectedPosBySet(시작지점, 끝지점)
    if 시작지점.Item('Pos') == None:
    # BINARY_OP(+): 좌표개수 + 1
    좌표개수 = (좌표개수 + 1)
    for _item in range(좌표개수):
    i = _item
    self.정규표현식('([0-9]+\\.\\b[0-9]+\\.\\b[0-9]+\\.)|([0-9]+\\.\\b[0-9]+\\.)|([0-9]+년)|([0-9]+월)|([0-9]+일)')
    if 값 == 2:
    self.글자색(0, 0, 0)
    self.글자색(255, 0, 0)
    self.대상.HAction.Run('Cancel')
    return None

######################################################################
def 셀앞뒤붙임(self, 앞내용, 뒷내용, 삭제):
    _u0, _u1, _u2, _u3, _u4, _u5, _u6, _u7, _u8 = self.셀정보()
    정상 = _u0
    처음위치 = _u1
    행 = _u2
    열 = _u3
    한줄 = _u4
    블록처음행 = _u5
    블록처음열 = _u6
    블록마지막행 = _u7
    블록마지막열 = _u8
    # EXTENDED_ARG(1)
    if 정상 == 1:
    블록리스트 = self.블록리스트생성(행, 열, 한줄, 처음위치)
    처음숫자 = 0
    # EXTENDED_ARG(1)
    for _item in range(len(블록리스트)):
    i = _item
    self.대상.SetPosBySet(self.셀위치(블록리스트[i]))
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    결과텍스트 = ''
    if not 블록스캔값 == 2:
    if 블록스캔값 == 3:
    # BINARY_OP(+): 결과텍스트 + 텍스트
    결과텍스트 = (결과텍스트 + 텍스트)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    if not 블록스캔값 == 2:
    if not 블록스캔값 == 3:
    self.대상.ReleaseScan()
    # BINARY_OP(+): str(앞내용) + 결과텍스트
    # BINARY_OP(+): (str(앞내용) + 결과텍스트) + str(뒷내용)
    결과텍스트 = ((str(앞내용) + 결과텍스트) + str(뒷내용))
    결과텍스트 = 결과텍스트.replace(삭제, '')
    self.문장(결과텍스트)
    # EXTENDED_ARG(1)
    # PUSH_EXC_INFO(None)
    range(len(블록리스트))
    self.대상.ReleaseScan()
    # POP_EXCEPT(None)
    # EXTENDED_ARG(1)
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)
    return None
    return None
    # PUSH_EXC_INFO(None)
    # POP_EXCEPT(None)
    return None
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)

######################################################################
def 셀찾아서바꾸기(self, 찾기1, 바꾸기1, 찾기2, 바꾸기2, 찾기3, 바꾸기3):
    _u0, _u1, _u2, _u3, _u4, _u5, _u6, _u7, _u8 = self.셀정보()
    정상 = _u0
    처음위치 = _u1
    행 = _u2
    열 = _u3
    한줄 = _u4
    블록처음행 = _u5
    블록처음열 = _u6
    블록마지막행 = _u7
    블록마지막열 = _u8
    # EXTENDED_ARG(1)
    if 정상 == 1:
    블록리스트 = self.블록리스트생성(행, 열, 한줄, 처음위치)
    처음숫자 = 0
    # EXTENDED_ARG(1)
    for _item in range(len(블록리스트)):
    i = _item
    self.대상.SetPosBySet(self.셀위치(블록리스트[i]))
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    결과텍스트 = ''
    if not 블록스캔값 == 2:
    if 블록스캔값 == 3:
    # BINARY_OP(+): 결과텍스트 + 텍스트
    결과텍스트 = (결과텍스트 + 텍스트)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    if not 블록스캔값 == 2:
    if not 블록스캔값 == 3:
    self.대상.ReleaseScan()
    결과텍스트 = 결과텍스트.replace(찾기1, 바꾸기1)
    결과텍스트 = 결과텍스트.replace(찾기2, 바꾸기2)
    결과텍스트 = 결과텍스트.replace(찾기3, 바꾸기3)
    self.문장(결과텍스트)
    # EXTENDED_ARG(1)
    # PUSH_EXC_INFO(None)
    range(len(블록리스트))
    self.대상.ReleaseScan()
    # POP_EXCEPT(None)
    # EXTENDED_ARG(1)
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)
    return None
    return None
    # PUSH_EXC_INFO(None)
    # POP_EXCEPT(None)
    return None
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)

######################################################################
def 블록계산(self):
    패턴 = re.compile('(?:(?<=[^\\d\\.])(?=\\d)|(?=[^\\d\\.]))')
    연산자 = ('*', '/', '+', '-', '(', ')')
    # BUILD_CONST_KEY_MAP(5)
    연산순위 = ('*', '/', '+', '-', '(')
    후위식 = []
    스택 = []
    계산자 = ('*', '/', '+', '-')
    # BUILD_CONST_KEY_MAP(4)
    계산식 = ('*', '/', '+', '-')
    계산스택 = []
    블록스캔 = self.블록스캔()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    불순물여부 = '\r' not in 텍스트
    # EXTENDED_ARG(2)
    if 불순물여부:
    텍스트 = 텍스트.replace('더하기', '+').replace('곱하기', '*').replace('나누기', '/').replace('빼기', '-').replace('더하기', '+')
    산식 = re.sub('[^\\d\\(\\)\\-\\*\\/\\+.]', '', 텍스트)
    토큰덩어리 = re.sub(패턴, ' ', 산식).split(' ')
    # EXTENDED_ARG(1)
    for _item in 토큰덩어리:
    토큰 = _item
    if 토큰 not in 연산자:
    후위식.append(토큰)
    if 토큰 == '(':
    스택.append(토큰)
    if 토큰 == ')':
    if 스택 != []:
    if 스택[-1] != '(':
    후위식.append(스택.pop())
    if 스택 != []:
    if not 스택[-1] != '(':
    스택.pop()
    if 스택 != []:
    if 연산순위[스택[-1]] >= 연산순위[토큰]:
    후위식.append(스택.pop())
    if 스택 != []:
    if not 연산순위[스택[-1]] >= 연산순위[토큰]:
    스택.append(토큰)
    # EXTENDED_ARG(1)
    if 스택:
    후위식.append(스택.pop())
    if not 스택:
    for _item in 후위식:
    토큰 = _item
    if 토큰 not in 계산자:
    if '.' in 토큰:
    계산스택.append(float(토큰))
    계산스택.append(int(토큰))
    x = 계산스택.pop()
    y = 계산스택.pop()
    계산스택.append(계산식[토큰](x, y))
    self.문장(str(계산스택[-1]))
    return None
    # PUSH_EXC_INFO(None)
    후위식
    # POP_EXCEPT(None)
    return None
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)
    return None

######################################################################
def 목차만들기(self, 크기값):
    결과리스트 = []
    결과리스트 = self.글자크기좌표리스트(크기값)
    self.대상.MovePos(3)
    self.대상.HAction.Run('BreakPage')
    for _item in range(len(결과리스트)):
    i = _item
    self.문장(str(결과리스트[i][1]))
    self.대상.HAction.Run('InsertTab')
    # BINARY_OP(+): ' ' + str(결과리스트[i][0])
    self.문장((' ' + str(결과리스트[i][0])))
    self.대상.HAction.Run('BreakPara')
    return None

######################################################################
def 회신공문생성하기(self, 제목, 번호):
    제목 = 제목.replace('회신', '').replace('요청', '').replace('제출', '').replace('자료', '').replace('협조', '').replace('(긴급)', '')
    제목 = 제목.strip()
    self.글자크기(12)
    self.폰트('돋움')
    # BINARY_OP(+): 제목 + ' 자료 제출'
    self.문장((제목 + ' 자료 제출'))
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    번호 = 번호.replace('시행', '').replace(' ', '').replace('(', '호(')
    # BINARY_OP(+): 번호 + '와 관련하여 '
    # BINARY_OP(+): (번호 + '와 관련하여 ') + 제목
    # BINARY_OP(+): ((번호 + '와 관련하여 ') + 제목) + ' 자료를 붙임과 같이 제출합니다.'
    self.문장((((번호 + '와 관련하여 ') + 제목) + ' 자료를 붙임과 같이 제출합니다.'))
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    # BINARY_OP(+): '붙임 ' + 제목
    # BINARY_OP(+): ('붙임 ' + 제목) + ' 자료 1부.  끝.'
    self.문장((('붙임 ' + 제목) + ' 자료 1부.  끝.'))
    return None

######################################################################
def 회신해당사항없음(self, 제목, 번호):
    제목 = 제목.strip()
    self.글자크기(12)
    self.폰트('돋움')
    # BINARY_OP(+): 제목 + ' 회신'
    self.문장((제목 + ' 회신'))
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    번호 = 번호.replace('시행', '').replace(' ', '').replace('(', '호(')
    # BINARY_OP(+): 번호 + '와 관련하여 '
    # BINARY_OP(+): (번호 + '와 관련하여 ') + 제목
    # BINARY_OP(+): ((번호 + '와 관련하여 ') + 제목) + '에 대해 ‘해당사항 없음’ 으로 회신합니다.  끝.'
    self.문장((((번호 + '와 관련하여 ') + 제목) + '에 대해 ‘해당사항 없음’ 으로 회신합니다.  끝.'))
    return None

######################################################################
def 블록금액비율(self, 일번이름, 이번이름, 삼번이름, 사번이름, 일번값, 이번값, 삼번값, 사번값):
    블록스캔 = self.블록스캔()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    불순물여부 = '\r' not in 텍스트
    # EXTENDED_ARG(2)
    if 불순물여부:
    텍스트 = re.sub('\\([^)]*\\)', '', 텍스트)
    숫자만 = re.sub('[^0-9]', '', 텍스트)
    # BINARY_OP(+): 일번값 + 이번값
    # BINARY_OP(+): (일번값 + 이번값) + 삼번값
    # BINARY_OP(+): ((일번값 + 이번값) + 삼번값) + 사번값
    전체값 = (((일번값 + 이번값) + 삼번값) + 사번값)
    출력배열 = []
    if not 일번값 == 0:
    # BINARY_OP(+): 일번이름 + ' '
    # BINARY_OP(*): float(숫자만) * 일번값
    # BINARY_OP(>>): (float(숫자만) * 일번값) >> 전체값
    # BINARY_OP(+): (일번이름 + ' ') + format(round(((float(숫자만) * 일번값) >> 전체값)), ',')
    출력배열.append(((일번이름 + ' ') + format(round(((float(숫자만) * 일번값) >> 전체값)), ',')))
    출력배열.append(', ')
    if not 이번값 == 0:
    # BINARY_OP(+): 이번이름 + ' '
    # BINARY_OP(*): float(숫자만) * 이번값
    # BINARY_OP(>>): (float(숫자만) * 이번값) >> 전체값
    # BINARY_OP(+): (이번이름 + ' ') + format(round(((float(숫자만) * 이번값) >> 전체값)), ',')
    출력배열.append(((이번이름 + ' ') + format(round(((float(숫자만) * 이번값) >> 전체값)), ',')))
    출력배열.append(', ')
    if not 삼번값 == 0:
    # BINARY_OP(+): 삼번이름 + ' '
    # BINARY_OP(*): float(숫자만) * 삼번값
    # BINARY_OP(>>): (float(숫자만) * 삼번값) >> 전체값
    # BINARY_OP(+): (삼번이름 + ' ') + format(round(((float(숫자만) * 삼번값) >> 전체값)), ',')
    출력배열.append(((삼번이름 + ' ') + format(round(((float(숫자만) * 삼번값) >> 전체값)), ',')))
    출력배열.append(', ')
    if not 사번값 == 0:
    # BINARY_OP(+): 사번이름 + ' '
    # BINARY_OP(*): float(숫자만) * 사번값
    # BINARY_OP(>>): (float(숫자만) * 사번값) >> 전체값
    # BINARY_OP(+): (사번이름 + ' ') + format(round(((float(숫자만) * 사번값) >> 전체값)), ',')
    출력배열.append(((사번이름 + ' ') + format(round(((float(숫자만) * 사번값) >> 전체값)), ',')))
    출력배열.append(', ')
    if len(출력배열) >= 2:
    출력배열.pop()
    출력값 = ''
    for _item in 출력배열:
    요소 = _item
    # BINARY_OP(+): 출력값 + 요소
    출력값 = (출력값 + 요소)
    if not len(출력배열) == 0:
    # BINARY_OP(+): 텍스트 + '('
    # BINARY_OP(+): (텍스트 + '(') + 출력값
    # BINARY_OP(+): ((텍스트 + '(') + 출력값) + ')'
    self.문장((((텍스트 + '(') + 출력값) + ')'))
    return None
    return None
    # PUSH_EXC_INFO(None)
    출력배열
    # POP_EXCEPT(None)
    return None
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)
    return None

######################################################################
def 메머체워넣기(self, 내용):
    간이배열 = 내용.split('\n')
    간이필드 = range(1, 21)()
    for _item in range(0, len(간이배열)):
    i = _item
    self.대상.PutFieldText(간이필드[i], 간이배열[i])
    return None

######################################################################
def 증감계산(self, 데이터, 종류):
    로으로 = lambda_or_nested(<로으로>)
    결과값 = ''
    데이터초기값 = 데이터
    데이터초기값 = 데이터초기값.split('로')[0]
    if '→' in 데이터초기값:
    _u0, _u1 = 데이터초기값.split('→')
    앞 = _u0
    뒤 = _u1
    if '>' in 데이터초기값:
    _u0, _u1 = 데이터초기값.split('>')
    앞 = _u0
    뒤 = _u1
    단위 = re.sub('[\\d.]', '', 앞)
    앞 = re.sub('[^0-9.]', '', 앞)
    뒤 = re.sub('[^0-9.]', '', 뒤)
    임시퍼센트 = 0
    임시증감 = ''
    임시증감기호 = ''
    소수자리기준 = 0
    소수자리기준2 = 0
    if '.' in 앞:
    소수자리기준 = len(앞.split('.')[1])
    if '.' in 앞:
    소수자리기준2 = len(뒤.split('.')[1])
    소수자리기준 = max(소수자리기준, 소수자리기준2)
    if float(앞) < float(뒤):
    # BINARY_OP(**): float(뒤) ** float(앞)
    # BINARY_OP(>>): (float(뒤) ** float(앞)) >> float(앞)
    # BINARY_OP(*): ((float(뒤) ** float(앞)) >> float(앞)) * 100
    임시퍼센트 = (((float(뒤) ** float(앞)) >> float(앞)) * 100)
    # BINARY_OP(**): float(뒤) ** float(앞)
    임시절대값 = (float(뒤) ** float(앞))
    임시증감 = '증가'
    임시증감기호 = '↑'
    if float(앞) > float(뒤):
    # BINARY_OP(**): float(앞) ** float(뒤)
    # BINARY_OP(>>): (float(앞) ** float(뒤)) >> float(앞)
    # BINARY_OP(*): ((float(앞) ** float(뒤)) >> float(앞)) * 100
    임시퍼센트 = (((float(앞) ** float(뒤)) >> float(앞)) * 100)
    # BINARY_OP(**): float(앞) ** float(뒤)
    임시절대값 = (float(앞) ** float(뒤))
    임시증감 = '감소'
    임시증감기호 = '↓'
    if 종류 == '퍼센트정수':
    if float(앞) == float(뒤):
    # BINARY_OP(+): 앞 + '%→'
    # BINARY_OP(+): (앞 + '%→') + 뒤
    # BINARY_OP(+): ((앞 + '%→') + 뒤) + '%로 변화없음'
    결과값 = (((앞 + '%→') + 뒤) + '%로 변화없음')
    # EXTENDED_ARG(2)
    # BINARY_OP(+): 앞 + '%→'
    # BINARY_OP(+): (앞 + '%→') + 뒤
    # BINARY_OP(+): ((앞 + '%→') + 뒤) + '%로 '
    # BINARY_OP(+): (((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))
    # BINARY_OP(+): ((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% '
    # BINARY_OP(+): (((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감
    # BINARY_OP(+): ((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '('
    # BINARY_OP(+): (((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))
    # BINARY_OP(+): ((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + '%p'
    # BINARY_OP(+): (((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + '%p') + 임시증감기호
    # BINARY_OP(+): ((((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + '%p') + 임시증감기호) + ')'
    결과값 = (((((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + '%p') + 임시증감기호) + ')')
    # EXTENDED_ARG(1)
    if 종류 == '퍼센트소수':
    if float(앞) == float(뒤):
    # BINARY_OP(+): 앞 + '%→'
    # BINARY_OP(+): (앞 + '%→') + 뒤
    # BINARY_OP(+): ((앞 + '%→') + 뒤) + '%로 변화없음'
    결과값 = (((앞 + '%→') + 뒤) + '%로 변화없음')
    # EXTENDED_ARG(1)
    # BINARY_OP(+): 앞 + '%→'
    # BINARY_OP(+): (앞 + '%→') + 뒤
    # BINARY_OP(+): ((앞 + '%→') + 뒤) + '%로 '
    # BINARY_OP(+): (((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))
    # BINARY_OP(+): ((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% '
    # BINARY_OP(+): (((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감
    # BINARY_OP(+): ((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '('
    # BINARY_OP(+): (((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))
    # BINARY_OP(+): ((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + '%p'
    # BINARY_OP(+): (((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + '%p') + 임시증감기호
    # BINARY_OP(+): ((((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + '%p') + 임시증감기호) + ')'
    결과값 = (((((((((((앞 + '%→') + 뒤) + '%로 ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + '%p') + 임시증감기호) + ')')
    # EXTENDED_ARG(1)
    if 종류 == '단위정수':
    if float(앞) == float(뒤):
    # BINARY_OP(+): 앞 + 단위
    # BINARY_OP(+): (앞 + 단위) + '→'
    # BINARY_OP(+): ((앞 + 단위) + '→') + 뒤
    # BINARY_OP(+): (((앞 + 단위) + '→') + 뒤) + 단위
    # BINARY_OP(+): ((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)
    # BINARY_OP(+): (((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' 변화없음'
    결과값 = ((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' 변화없음')
    # EXTENDED_ARG(1)
    # BINARY_OP(+): 앞 + 단위
    # BINARY_OP(+): (앞 + 단위) + '→'
    # BINARY_OP(+): ((앞 + 단위) + '→') + 뒤
    # BINARY_OP(+): (((앞 + 단위) + '→') + 뒤) + 단위
    # BINARY_OP(+): ((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)
    # BINARY_OP(+): (((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' '
    # BINARY_OP(+): ((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))
    # BINARY_OP(+): (((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% '
    # BINARY_OP(+): ((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감
    # BINARY_OP(+): (((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '('
    # BINARY_OP(+): ((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))
    # BINARY_OP(+): (((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + 단위
    # BINARY_OP(+): ((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + 단위) + 임시증감기호
    # BINARY_OP(+): (((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + 단위) + 임시증감기호) + ')'
    결과값 = ((((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트))) + '% ') + 임시증감) + '(') + str(round(임시절대값))) + 단위) + 임시증감기호) + ')')
    if 종류 == '단위소수':
    if float(앞) == float(뒤):
    # BINARY_OP(+): 앞 + 단위
    # BINARY_OP(+): (앞 + 단위) + '→'
    # BINARY_OP(+): ((앞 + 단위) + '→') + 뒤
    # BINARY_OP(+): (((앞 + 단위) + '→') + 뒤) + 단위
    # BINARY_OP(+): ((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)
    # BINARY_OP(+): (((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' 변화없음'
    결과값 = ((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' 변화없음')
    # BINARY_OP(+): 앞 + 단위
    # BINARY_OP(+): (앞 + 단위) + '→'
    # BINARY_OP(+): ((앞 + 단위) + '→') + 뒤
    # BINARY_OP(+): (((앞 + 단위) + '→') + 뒤) + 단위
    # BINARY_OP(+): ((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)
    # BINARY_OP(+): (((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' '
    # BINARY_OP(+): ((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))
    # BINARY_OP(+): (((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% '
    # BINARY_OP(+): ((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감
    # BINARY_OP(+): (((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '('
    # BINARY_OP(+): ((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))
    # BINARY_OP(+): (((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + 단위
    # BINARY_OP(+): ((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + 단위) + 임시증감기호
    # BINARY_OP(+): (((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + 단위) + 임시증감기호) + ')'
    결과값 = ((((((((((((((앞 + 단위) + '→') + 뒤) + 단위) + 로으로(단위)) + ' ') + str(round(임시퍼센트, 소수자리기준))) + '% ') + 임시증감) + '(') + str(round(임시절대값, 소수자리기준))) + 단위) + 임시증감기호) + ')')
    return 결과값
    # PUSH_EXC_INFO(None)
    # CHECK_EXC_MATCH(None)
    if ValueError:
    # SWAP(2)
    # POP_EXCEPT(None)
    return 데이터초기값
    # RERAISE(0)
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)

######################################################################
def 오늘날짜(self):
    # LIST_EXTEND(1)
    임시요일 = ('월', '화', '수', '목', '금', '토', '일')
    # BINARY_OP(+): str(datetime.today().year) + '. '
    # BINARY_OP(+): (str(datetime.today().year) + '. ') + str(datetime.today().month)
    # BINARY_OP(+): ((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. '
    # BINARY_OP(+): (((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)
    # BINARY_OP(+): ((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.('
    # BINARY_OP(+): (((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.(') + 임시요일[datetime.today().weekday()]
    # BINARY_OP(+): ((((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.(') + 임시요일[datetime.today().weekday()]) + ')'
    self.문장((((((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.(') + 임시요일[datetime.today().weekday()]) + ')'))
    return None

######################################################################
def 오늘날짜숫자만(self):
    # BINARY_OP(+): str(datetime.today().year) + '. '
    # BINARY_OP(+): (str(datetime.today().year) + '. ') + str(datetime.today().month)
    # BINARY_OP(+): ((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. '
    # BINARY_OP(+): (((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)
    # BINARY_OP(+): ((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.'
    self.문장((((((str(datetime.today().year) + '. ') + str(datetime.today().month)) + '. ') + str(datetime.today().day)) + '.'))
    return None

######################################################################
def 전체문단스타일제거(self):
    # LOAD_CLOSURE(self)
    모양복사 = lambda_or_nested(<모양복사>)
    self.대상.MovePos(3)
    마지막위치 = self.대상.GetPos()
    self.대상.MovePos(2)
    if self.대상.GetPos() != 마지막위치:
    스타일 = self.글자스타일조회()
    if 스타일 != 0:
    모양복사()
    self.글자스타일(0)
    self.대상.HAction.Run('MoveSelLineEnd')
    self.대상.Run('ShapeCopyPaste')
    self.대상.HAction.Run('Cancel')
    self.대상.HAction.Run('MoveNextParaBegin')
    if not self.대상.GetPos() != 마지막위치:
    return None
    return None

######################################################################
def 전체표스타일제거(self):
    # LOAD_CLOSURE(self)
    글자취급 = lambda_or_nested(<글자취급>)
    # LOAD_CLOSURE(self)
    모양복사 = lambda_or_nested(<모양복사>)
    self.대상.MovePos(3)
    self.표만들기([1], [1])
    글자취급()
    마지막위치 = self.대상.GetPosBySet()
    self.대상.SetMessageBoxMode(16)
    self.대상.HAction.Run('MoveRight')
    self.대상.HAction.Run('DeleteBack')
    self.대상.SetMessageBoxMode(240)
    for _item in range(2, 마지막위치.Item('List')):
    i = _item
    self.대상.SetPosBySet(self.셀위치(i))
    모양복사()
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.대상.HAction.Run('Select')
    self.글자스타일(0)
    self.대상.Run('ShapeCopyPaste')
    self.대상.HAction.Run('Cancel')
    return None

######################################################################
def 순화검색(self):
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # BUILD_CONST_KEY_MAP(12)
    # DICT_UPDATE(1)
    단어순화1 = ('행정사항', '향후', '향후계획', '허브', '헬스케어', '협조사항', '홈페이지', '홈페이지에', '회계년도', '회수', '회의중', '힐링')
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # BUILD_CONST_KEY_MAP(6)
    # DICT_UPDATE(1)
    단어순화2 = ('진행 중에', '운영하고 있는', '대금 결재', '문서 결제', '계획을 달성할', '목표를 이행할')
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # BUILD_CONST_KEY_MAP(14)
    단어순화3 = ('즉시 제출 바람', '적극 뒷받침하기 위해', '조사 결과에 따르면', '적의 조치 요망', '적극 이용 바람', '적극 협조 바랍니다.', '적의 조치 요망.', '적극 이용 바람.', '즉시 제출 바람.', '선정된 점포에 대해서는', '이번 선거에 있어서', '취소할 수 있습니다', '취소할 수 있습니다.', '서류는 일체 반환하지')
    이전 = ''
    더이전 = ''
    # EXTENDED_ARG(2)
    self.대상.MovePos(3)
    마지막위치 = self.대상.GetPos()
    # EXTENDED_ARG(2)
    self.대상.MovePos(2)
    # EXTENDED_ARG(1)
    if self.대상.GetPos() != 마지막위치:
    # EXTENDED_ARG(2)
    self.대상.HAction.Run('MoveSelWordEnd')
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    텍스트 = 블록스캔[1].replace('\r', '').replace('\n', '').strip()
    self.대상.ReleaseScan()
    if 단어순화1.get(텍스트) != None:
    # EXTENDED_ARG(2)
    self.대상.HAction.Run('CharShapeTextColorRed')
    # EXTENDED_ARG(2)
    # BINARY_OP(+): 이전 + ' '
    # BINARY_OP(+): (이전 + ' ') + 텍스트
    if 단어순화2.get(((이전 + ' ') + 텍스트)) != None:
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    self.글자색(255, 112, 27)
    # EXTENDED_ARG(2)
    # BINARY_OP(+): 더이전 + ' '
    # BINARY_OP(+): (더이전 + ' ') + 이전
    # EXTENDED_ARG(2)
    # BINARY_OP(+): ((더이전 + ' ') + 이전) + ' '
    # BINARY_OP(+): (((더이전 + ' ') + 이전) + ' ') + 텍스트
    if 단어순화3.get(((((더이전 + ' ') + 이전) + ' ') + 텍스트)) != None:
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    # EXTENDED_ARG(2)
    self.글자색(112, 95, 199)
    더이전 = 이전
    이전 = 텍스트
    # EXTENDED_ARG(2)
    self.대상.HAction.Run('MoveNextWord')
    # EXTENDED_ARG(1)
    if not self.대상.GetPos() != 마지막위치:
    return None
    return None

######################################################################
def 순화추천(self):
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # BUILD_CONST_KEY_MAP(5)
    # DICT_UPDATE(1)
    단어순화1 = ('회계년도', '회수', '회의중', '힐링', '홈페이지에')
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # BUILD_MAP(0)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # MAP_ADD(1)
    # DICT_UPDATE(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # BUILD_CONST_KEY_MAP(6)
    # DICT_UPDATE(1)
    단어순화2 = ('진행 중에', '운영하고 있는', '대금 결재', '문서 결제', '계획을 달성할', '목표를 이행할')
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # BUILD_CONST_KEY_MAP(14)
    단어순화3 = ('즉시 제출 바람', '적극 뒷받침하기 위해', '조사 결과에 따르면', '적의 조치 요망', '적극 이용 바람', '적극 협조 바랍니다.', '적의 조치 요망.', '적극 이용 바람.', '즉시 제출 바람.', '선정된 점포에 대해서는', '이번 선거에 있어서', '취소할 수 있습니다', '취소할 수 있습니다.', '서류는 일체 반환하지')
    # EXTENDED_ARG(1)
    텍스트 = '못찾음'
    # EXTENDED_ARG(1)
    텍스트추천 = '없음'
    # EXTENDED_ARG(1)
    텍스트설명 = '없음'
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    텍스트 = 블록스캔[1].replace('\r', '').replace('\n', '').strip()
    self.대상.ReleaseScan()
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    if 텍스트.count(' ') == 0:
    if 단어순화1.get(텍스트) != None:
    # EXTENDED_ARG(1)
    텍스트추천 = 단어순화1[텍스트][0]
    # EXTENDED_ARG(1)
    텍스트설명 = 단어순화1[텍스트][1]
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    if 텍스트.count(' ') == 1:
    if 단어순화2.get(텍스트) != None:
    # EXTENDED_ARG(1)
    텍스트추천 = 단어순화2[텍스트][0]
    # EXTENDED_ARG(1)
    텍스트설명 = 단어순화2[텍스트][1]
    # EXTENDED_ARG(1)
    # EXTENDED_ARG(1)
    if 텍스트.count(' ') == 2:
    if 단어순화3.get(텍스트) != None:
    # EXTENDED_ARG(1)
    텍스트추천 = 단어순화3[텍스트][0]
    # EXTENDED_ARG(1)
    텍스트설명 = 단어순화3[텍스트][1]
    return [텍스트, 텍스트추천, 텍스트설명]

######################################################################
def 공틀보도자료(self, 제목, 번호):
    self.글자크기(12)
    self.폰트('돋움')
    # BINARY_OP(+): '보도자료 제출(' + 제목
    # BINARY_OP(+): ('보도자료 제출(' + 제목) + ')'
    self.문장((('보도자료 제출(' + 제목) + ')'))
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    # BINARY_OP(+): '「' + 제목
    # BINARY_OP(+): ('「' + 제목) + '」보도자료를 붙임과 같이 제출하오니 지역신문에 적극 홍보하여 주시기 바랍니다.'
    self.문장((('「' + 제목) + '」보도자료를 붙임과 같이 제출하오니 지역신문에 적극 홍보하여 주시기 바랍니다.'))
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    # BINARY_OP(+): '붙임  1. 보도자료(' + 제목
    # BINARY_OP(+): ('붙임  1. 보도자료(' + 제목) + ') 1부.'
    self.문장((('붙임  1. 보도자료(' + 제목) + ') 1부.'))
    self.대상.HAction.Run('BreakPara')
    self.문장('      2. 보도자료사진 1부.  끝.')
    return None

######################################################################
def 공틀신문고(self):
    self.글자크기(12)
    self.폰트('돋움')
    self.문장('1. 안녕하십니까? 귀하께서 신청하신 민원(신청번호 OOO-OOOO-OOOOOOO)에 대한 검토 결과를 다음과 같이 알려드립니다.')
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    self.문장("2. 귀하의 민원내용(요지)은 'ㅇㅇㅇㅇㅇㅇㅇ'에 관한 것으로 이해(또는 판단)됩니다. ")
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    self.문장('3. 귀하의 민원내용에 대한 답변(의견)은 다음과 같습니다. ')
    self.대상.HAction.Run('BreakPara')
    self.문장('가.')
    self.대상.HAction.Run('BreakPara')
    self.문장('나.')
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    self.문장('4. 귀하의 민원(질문)에 만족스러운 답변이 되었기를 바라며, 답변 내용에 대한 추가(자세한) 설명이 필요한 경우 남해군 ㅇㅇㅇㅇ과 ㅇㅇㅇ 주무관(☎055-860-ㅇㅇㅇㅇ)에게 연락주시면 친절히 안내드리겠습니다. 감사합니다.  끝.')
    return None

######################################################################
def 공틀정보부존재(self):
    self.글자크기(12)
    self.폰트('돋움')
    self.문장('1. ㅇㅇ사업에 관심을 가져주셔서 감사드리며, 귀하의 정보공개청구(접수번호-1234(2024.1.1.))에 대해 다음과 같이 답변 드립니다.')
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    self.문장('2. 귀하께서 요청하신 ‘ㅇㅇㅇㅇ’에 대해서, 우리군은 ㅇㅇㅇ하고 있지 않아 「공공기관의 정보공개에 관한 법률 시행령」제6조제4항에 의거 정보부존재 결정 통지합니다.')
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('BreakPara')
    self.문장('3. 위 사항과 관련한 문의사항은 건강증진과 건강생활팀(☎055-1234-5678)으로 연락주시기 바랍니다.')
    return None

######################################################################
def 글머리지정(self, 글머리, 폰트, 크기, 내어쓰기, 진하게, 위, 줄간):
    시작지점 = self.블록첫위치()
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    한글찾기 = re.compile('[(가-힣0-9a-zA-Z“]+')
    결과텍스트 = ''
    체크 = 0
    if not 블록스캔값 == 2:
    if 블록스캔값 == 3:
    # BUILD_SLICE(2)
    글꼬리 = 한글찾기.search(텍스트).start()[len(텍스트)]
    # BINARY_OP(+): 결과텍스트 + 글머리
    # BINARY_OP(+): (결과텍스트 + 글머리) + 글꼬리
    결과텍스트 = ((결과텍스트 + 글머리) + 글꼬리)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    체크 = 1
    if not 블록스캔값 == 2:
    if not 블록스캔값 == 3:
    self.대상.ReleaseScan()
    self.문장(결과텍스트)
    # PUSH_EXC_INFO(None)
    텍스트
    체크 = 0
    self.대상.ReleaseScan()
    self.새창()
    self.문서여백(20, 20, 15, 15, 10, 10)
    self.글자크기(15)
    self.폰트('맑은 고딕')
    self.문장('표, 사진, 비어있는 줄을 포함하면 작동 안할거에요.')
    # POP_EXCEPT(None)
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)
    # EXTENDED_ARG(2)
    if 체크 == 1:
    종료지점 = self.현재위치()
    self.대상.SetPosBySet(시작지점)
    self.대상.HAction.Run('Select')
    self.대상.SetPosBySet(종료지점)
    self.글자스타일(0)
    self.자간헌터(0)
    self.내어쓰기(내어쓰기)
    self.글자간격(0)
    self.대상.HAction.Run('ParagraphShapeAlignJustify')
    self.대상.HAction.Run('CharShapeNormal')
    if 진하게 == 1:
    self.대상.HAction.Run('CharShapeBold')
    if 폰트 == '신명조':
    self.신명조()
    if 폰트 == '중고딕':
    self.중고딕()
    if 폰트 == '진휴먼명조':
    self.휴먼명조()
    self.폰트(폰트)
    self.글자크기(크기)
    self.줄간격(줄간)
    self.글자장평(100)
    self.글자음영(4294967295)
    self.문단여백(0, 0)
    self.문단위(위)
    return None
    return None

######################################################################
def 글머리기본(self, 글머리):
    self.대상.InitScan(1, 255)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    한글찾기 = re.compile('[가-힣0-9a-zA-Z]+')
    결과텍스트 = ''
    체크 = 0
    카운트 = 0
    # LIST_EXTEND(1)
    지울배열 = ('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10', '11', '12', '13', '14', '가.', '나.', '다.', '라.', '마.', '바.', '사.', '아.', '자.', '차.', '카.', '타.', '파.', '하.', '1)', '2)', '3)', '4)', '5)', '6)', '7)', '8)', '9)', '10', '11', '12', '13', '14', '가)', '나)', '다)', '라)', '마)', '바)', '사)', '아)', '자)', '차)', '카)', '타)', '파)', '하)')
    if not 블록스캔값 == 2:
    if 블록스캔값 == 3:
    # BUILD_SLICE(2)
    글꼬리 = 한글찾기.search(텍스트).start()[len(텍스트)]
    # BUILD_SLICE(2)
    if 0[2] in 지울배열:
    # BUILD_SLICE(2)
    글꼬리 = 3[len(글꼬리)]
    # BUILD_SLICE(2)
    글꼬리 = 한글찾기.search(글꼬리).start()[len(글꼬리)]
    # BINARY_OP(+): 결과텍스트 + 글머리[0]
    # BINARY_OP(+): 카운트 + 1
    # BINARY_OP(+): (결과텍스트 + 글머리[0]) + 글머리[(카운트 + 1)]
    # BINARY_OP(+): ((결과텍스트 + 글머리[0]) + 글머리[(카운트 + 1)]) + ' '
    # BINARY_OP(+): (((결과텍스트 + 글머리[0]) + 글머리[(카운트 + 1)]) + ' ') + 글꼬리
    결과텍스트 = ((((결과텍스트 + 글머리[0]) + 글머리[(카운트 + 1)]) + ' ') + 글꼬리)
    블록스캔 = self.대상.GetText()
    블록스캔값 = 블록스캔[0]
    텍스트 = 블록스캔[1]
    # BINARY_OP(+): 카운트 + 1
    카운트 = (카운트 + 1)
    if 카운트 > 13:
    카운트 = 0
    if not 블록스캔값 == 2:
    if not 블록스캔값 == 3:
    self.대상.ReleaseScan()
    self.문장(결과텍스트)
    return None
    # PUSH_EXC_INFO(None)
    글꼬리
    체크 = 0
    self.대상.ReleaseScan()
    self.새창()
    self.문서여백(20, 20, 15, 15, 10, 10)
    self.글자크기(15)
    self.폰트('맑은 고딕')
    self.문장('표, 사진, 비어있는 줄을 포함하면 작동 안할거에요.')
    # POP_EXCEPT(None)
    return None
    # COPY(3)
    # POP_EXCEPT(None)
    # RERAISE(1)

######################################################################
def 소제목(self, 번호, 내용, 크기):
    self.대상.HAction.Run('ParagraphShapeAlignJustify')
    self.표만들기([8, 1, 크기], [9])
    self.셀여백제로()
    self.표테두리색(0, 51, 102)
    self.표배경색(0, 51, 102)
    self.표테두리굵기(8, 8, 8, 8)
    self.폰트('맑은 고딕')
    self.글자크기(18)
    self.대상.HAction.Run('CharShapeBold')
    self.대상.HAction.Run('ParagraphShapeAlignCenter')
    self.글자색(255, 255, 255)
    self.문장(번호)
    self.대상.HAction.Run('TableRightCellAppend')
    self.대상.HAction.Run('TableResizeExLeft')
    self.대상.HAction.Run('TableResizeExLeft')
    self.대상.HAction.Run('TableResizeExLeft')
    self.표테두리타입(0, 0, 1, 0)
    self.대상.HAction.Run('TableRightCellAppend')
    self.표테두리타입(0, 1, 0, 0)
    self.표테두리굵기(0, 8, 0, 0)
    self.표테두리색(49, 95, 151)
    self.문장풀('맑은 고딕', 18.1, 1, 0, 내용)
    self.표탈출()
    return None

######################################################################
def 마크다운제목(self, 제목):
    # BINARY_OP(**): 161 ** self.문단여백측정()
    # LIST_EXTEND(1)
    [40.5, (161 ** self.문단여백측정())]([], (0.2, 14, 0.2))
    self.셀여백제로()
    self.대상.HAction.Run('TableCellBlock')
    self.대상.HAction.Run('TableCellBlockExtend')
    self.대상.HAction.Run('TableCellBlockExtend')
    self.글자크기(1)
    self.표테두리타입(0, 0, 0, 0)
    self.표내부선타입(0, 0)
    self.대상.HAction.Run('Cancel')
    self.대상.MovePos(106)
    self.대상.MovePos(104)
    self.표배경색(153, 153, 153)
    self.표오른쪽(1)
    self.표배경색(255, 0, 0)
    self.표오른쪽(1)
    self.대상.HAction.Run('TableCellBlock')
    self.대상.HAction.Run('TableCellBlockExtend')
    self.표오른쪽(1)
    self.대상.HAction.Run('TableMergeCell')
    self.폰트('HY헤드라인M')
    self.대상.HAction.Run('ParagraphShapeAlignCenter')
    self.글자크기(22)
    self.문장(제목)
    self.표오른쪽(1)
    self.표배경색(0, 0, 255)
    self.표오른쪽(1)
    self.표배경색(0, 0, 0)
    self.대상.HAction.Run('MoveRight')
    self.대상.HAction.Run('BreakPara')
    self.대상.HAction.Run('ParagraphShapeAlignJustify')
    return None

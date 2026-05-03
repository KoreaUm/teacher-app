(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">👥 학생 명단</h1>
    <div class="page-header-actions">
      <input type="text" id="st-search" class="input" placeholder="이름 검색..." style="width:180px">
      <button class="btn btn-secondary" id="st-template-btn">CSV 양식 다운로드</button>
      <button class="btn btn-secondary" id="st-csv-btn">📥 CSV 가져오기</button>
      <input type="file" id="st-csv-input" accept=".csv" style="display:none">
      <button class="btn btn-primary" id="st-add-btn">+ 학생 추가</button>
    </div>
  </div>
  <div id="student-grid" class="student-grid"></div>
  </div>`;
}
async function init(){
  await refresh();
  document.getElementById('st-search').oninput=e=>refresh(e.target.value);
  document.getElementById('st-add-btn').onclick=()=>showStudentModal(null);
  document.getElementById('st-template-btn').onclick=downloadStudentTemplate;
  document.getElementById('st-csv-btn').onclick=()=>document.getElementById('st-csv-input').click();
  document.getElementById('st-csv-input').onchange=e=>importCSV(e.target.files[0]);
}
async function refresh(q=''){
  let students=await api.getStudents();
  if(q)students=students.filter(s=>s.name.includes(q)||String(s.number).includes(q));
  const grid=document.getElementById('student-grid');
  if(!grid)return;
  if(!students.length){grid.innerHTML='<div class="empty-state"><div class="icon">👥</div><p>등록된 학생이 없습니다.</p></div>';return;}
  grid.innerHTML=students.map(s=>`
    <div class="student-card" onclick="window.__stEdit(${s.id})">
      <div class="num">${s.number}번</div>
      <div class="name">${s.name}</div>
      ${s.phone?`<div class="phone">${s.phone}</div>`:''}
      ${s.parent_phone?`<div class="phone" style="color:var(--text3)">학부모: ${s.parent_phone}</div>`:''}
    </div>`).join('');
}
window.__stEdit=async(id)=>{
  const students=await api.getStudents();
  showStudentModal(students.find(x=>x.id===id));
};
function showStudentModal(s){
  const isEdit=!!s;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'학생 정보 수정':'학생 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row row-2">
      <div><label>번호 *</label><input class="input" id="s-num" type="number" value="${s?s.number:''}"></div>
      <div><label>이름 *</label><input class="input" id="s-name" value="${s?s.name:''}"></div>
    </div>
    <div class="form-row row-2">
      <div><label>성별</label><select class="input" id="s-gender"><option value="">선택</option><option ${s&&s.gender==='남'?'selected':''}>남</option><option ${s&&s.gender==='여'?'selected':''}>여</option></select></div>
      <div><label>생년월일</label><input class="input" type="date" id="s-birth" value="${s?s.birth_date:''}"></div>
    </div>
    <div class="form-row row-2">
      <div><label>학생 전화</label><input class="input" id="s-phone" value="${s?s.phone:''}"></div>
      <div><label>학부모 전화</label><input class="input" id="s-pphone" value="${s?s.parent_phone:''}"></div>
    </div>
    <div class="form-row"><label>주소</label><input class="input" id="s-addr" value="${s?s.address:''}"></div>
    <div class="form-row"><label>메모</label><textarea class="input" id="s-note" style="height:60px">${s?s.note:''}</textarea></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="s-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="s-save">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('s-del').onclick=async()=>{
    if(confirm(`${s.name} 학생을 삭제하시겠습니까?`)){await api.deleteStudent(s.id);closeModal();refresh();}
  };
  document.getElementById('s-save').onclick=async()=>{
    const num=parseInt(document.getElementById('s-num').value),name=document.getElementById('s-name').value.trim();
    if(!name||!num){toast('번호와 이름을 입력하세요','error');return;}
    const data={number:num,name,gender:document.getElementById('s-gender').value,birth_date:document.getElementById('s-birth').value,phone:document.getElementById('s-phone').value,parent_phone:document.getElementById('s-pphone').value,address:document.getElementById('s-addr').value,note:document.getElementById('s-note').value};
    if(isEdit)await api.updateStudent(s.id,data);else await api.addStudent(data);
    toast(isEdit?'수정되었습니다':'추가되었습니다','success');closeModal();refresh();
  };
}
async function importCSV(file){
  if(!file)return;
  const input=document.getElementById('st-csv-input');
  const text=await file.text();const lines=parseCSV(text).filter(row=>row.some(cell=>String(cell||'').trim()));const rows=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].map(c=>String(c||'').trim());
    if(cols.length<2)continue;
    rows.push({number:parseInt(cols[0])||i,name:cols[1]||'',gender:cols[2]||'',birth_date:cols[3]||'',phone:cols[4]||'',parent_phone:cols[5]||'',address:cols[6]||'',note:cols[7]||''});
  }
  if(input)input.value='';
  if(!rows.length){toast('CSV 파일을 확인하세요','error');return;}
  if(confirm(`학생 ${rows.length}명을 가져오시겠습니까?`)){await api.importStudentsCSV(rows);toast(`${rows.length}명 완료`,'success');refresh();}
}
function downloadStudentTemplate(){
  downloadCSV('학생명단_양식.csv', [
    ['번호','이름','성별','생년월일','학생전화','학부모전화','주소','메모'],
    ['1','홍길동','남','2010-03-15','010-1234-5678','010-2345-6789','충북 충주시 ○○로 1','상담 시 참고할 메모'],
    ['2','김하늘','여','2010-07-22','010-3456-7890','010-4567-8901','충북 충주시 △△길 2','']
  ]);
}
function downloadCSV(filename, rows){
  const csv=rows.map(row=>row.map(cell=>`"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
  URL.revokeObjectURL(url);
}
function parseCSV(text){
  const rows=[];let row=[];let cell='';let quoted=false;
  for(let i=0;i<String(text||'').length;i++){
    const ch=text[i];const next=text[i+1];
    if(ch==='"'){
      if(quoted&&next==='"'){cell+='"';i++;}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){
      row.push(cell);cell='';
    }else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell);rows.push(row);row=[];cell='';
    }else{
      cell+=ch;
    }
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}
window.registerPage('students',{render,init,refresh:()=>refresh()});
})();

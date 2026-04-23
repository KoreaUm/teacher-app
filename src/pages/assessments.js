(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📊 수행평가</h1>
    <button class="btn btn-primary" id="as-add">+ 평가 추가</button></div>
  <div id="as-list" style="display:flex;flex-direction:column;gap:12px"></div>
  </div>`;
}
async function init(){await refresh();document.getElementById('as-add').onclick=()=>showM(null);}
async function refresh(){
  const list=document.getElementById('as-list');if(!list)return;
  const items=await api.getAssessments();
  if(!items.length){list.innerHTML='<div class="empty-state"><div class="icon">📊</div><p>수행평가가 없습니다.</p></div>';return;}
  list.innerHTML=items.map(a=>`<div class="card" style="padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div><span style="font-size:15px;font-weight:700">${a.name}</span>
        <span class="badge badge-accent" style="margin-left:8px">${a.subject}</span>
        <span class="badge badge-gray" style="margin-left:4px">${a.type}</span></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="window.__asSc(${a.id})">점수 입력</button>
        <button class="btn btn-secondary btn-sm" onclick="window.__asE(${a.id})">수정</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text2)">만점: ${a.max_score}점 · 날짜: ${a.date||'-'}</div>
  </div>`).join('');
}
window.__asE=async(id)=>{const items=await api.getAssessments();showM(items.find(a=>a.id===id));};
window.__asSc=async(id)=>{
  const items=await api.getAssessments();const a=items.find(x=>x.id===id);
  const students=await api.getStudents();const scores=await api.getAssessmentScores(id);
  const sm={};for(const s of scores)sm[s.student_id]=s.score;
  showModal(`<div class="modal-header"><span class="modal-title">점수 입력 - ${a.name}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body" style="max-height:400px;overflow-y:auto">
    <table style="width:100%"><thead><tr><th>번호</th><th>이름</th><th>점수 (/${a.max_score})</th></tr></thead>
    <tbody>${students.map(s=>`<tr><td>${s.number}</td><td>${s.name}</td>
    <td><input class="input" type="number" id="sc-${s.id}" value="${sm[s.id]!==undefined?sm[s.id]:''}" max="${a.max_score}" min="0" style="height:30px"></td></tr>`).join('')}</tbody>
    </table>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-close>닫기</button>
    <button class="btn btn-primary" id="sc-sv">저장</button></div>`);
  document.getElementById('sc-sv').onclick=async()=>{
    for(const s of students){const v=document.getElementById(`sc-${s.id}`).value;if(v!=='')await api.setAssessmentScore({assessment_id:id,student_id:s.id,score:parseFloat(v)});}
    toast('저장되었습니다','success');closeModal();
  };
};
function showM(a){
  const isEdit=!!a;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'평가 수정':'평가 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row"><label>평가명 *</label><input class="input" id="as-n" value="${a?a.name:''}"></div>
    <div class="form-row row-2">
      <div><label>교과</label><input class="input" id="as-s" value="${a?a.subject:''}"></div>
      <div><label>유형</label><select class="input" id="as-t">${['수행','지필','실기','기타'].map(t=>`<option ${a&&a.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-row row-2">
      <div><label>날짜</label><input class="input" type="date" id="as-d" value="${a?a.date:today()}"></div>
      <div><label>만점</label><input class="input" type="number" id="as-m" value="${a?a.max_score:100}"></div>
    </div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="as-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="as-sv">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('as-del').onclick=async()=>{await api.deleteAssessment(a.id);closeModal();refresh();};
  document.getElementById('as-sv').onclick=async()=>{
    const name=document.getElementById('as-n').value.trim();if(!name){toast('이름을 입력하세요','error');return;}
    const data={name,subject:document.getElementById('as-s').value,type:document.getElementById('as-t').value,date:document.getElementById('as-d').value,max_score:parseFloat(document.getElementById('as-m').value)||100,weight:1};
    if(isEdit)await api.updateAssessment(a.id,data);else await api.addAssessment(data);
    toast('저장되었습니다','success');closeModal();refresh();
  };
}
window.registerPage('assessments',{render,init,refresh});
})();
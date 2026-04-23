(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">💬 상담 일지</h1>
    <button class="btn btn-primary" id="co-add">+ 상담 추가</button></div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>날짜</th><th>학생</th><th>유형</th><th>내용</th><th>후속조치</th><th></th></tr></thead>
    <tbody id="co-body"></tbody>
  </table></div></div>`;
}
async function init(){await refresh();document.getElementById('co-add').onclick=()=>showM(null);}
async function refresh(){
  const b=document.getElementById('co-body');if(!b)return;
  const rows=await api.getCounseling({});
  if(!rows.length){b.innerHTML='<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text3)">상담 기록이 없습니다.</td></tr>';return;}
  b.innerHTML=rows.map(r=>`<tr><td>${r.date}</td><td>${r.name||'전체'}</td>
  <td><span class="badge badge-accent">${r.type}</span></td>
  <td class="truncate" style="max-width:200px">${r.content}</td>
  <td class="truncate" style="max-width:150px">${r.follow_up}</td>
  <td><button class="btn btn-secondary btn-xs" onclick="window.__coE(${r.id})">수정</button></td></tr>`).join('');
}
window.__coE=async(id)=>{const rows=await api.getCounseling({});showM(rows.find(r=>r.id===id));};
async function showM(r){
  const students=await api.getStudents();const isEdit=!!r;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'상담 수정':'상담 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row row-2">
      <div><label>날짜</label><input class="input" type="date" id="co-d" value="${r?r.date:today()}"></div>
      <div><label>유형</label><select class="input" id="co-t">${['개인','집단','학부모','전화','기타'].map(t=>`<option ${r&&r.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
    </div>
    <div class="form-row"><label>학생</label><select class="input" id="co-s">
      <option value="">전체/미지정</option>
      ${students.map(s=>`<option value="${s.id}" ${r&&r.student_id===s.id?'selected':''}>${s.number}번 ${s.name}</option>`).join('')}
    </select></div>
    <div class="form-row"><label>상담 내용</label><textarea class="input" id="co-c" style="height:100px">${r?r.content:''}</textarea></div>
    <div class="form-row"><label>결과</label><textarea class="input" id="co-r" style="height:60px">${r?r.result:''}</textarea></div>
    <div class="form-row"><label>후속 조치</label><textarea class="input" id="co-f" style="height:60px">${r?r.follow_up:''}</textarea></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="co-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="co-sv">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('co-del').onclick=async()=>{await api.deleteCounseling(r.id);closeModal();refresh();};
  document.getElementById('co-sv').onclick=async()=>{
    const data={date:document.getElementById('co-d').value,type:document.getElementById('co-t').value,student_id:parseInt(document.getElementById('co-s').value)||null,content:document.getElementById('co-c').value,result:document.getElementById('co-r').value,follow_up:document.getElementById('co-f').value};
    if(isEdit)await api.updateCounseling(r.id,data);else await api.addCounseling(data);
    toast('저장되었습니다','success');closeModal();refresh();
  };
}
window.registerPage('counseling',{render,init,refresh});
})();
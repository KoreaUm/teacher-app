(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">🤖 AI 분석</h1></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:12px">📝 학생 종합 분석</div>
      <div class="form-row"><label>학생 선택</label><select class="input" id="ai-stu"></select></div>
      <button class="btn btn-primary" id="ai-ab" style="width:100%;margin-bottom:12px">🤖 AI 분석 시작</button>
      <div id="ai-ar" style="font-size:13px;line-height:1.7;color:var(--text);white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;min-height:120px"></div>
    </div>
    <div class="card" style="padding:20px;display:flex;flex-direction:column">
      <div class="card-title" style="margin-bottom:12px">💬 AI 대화</div>
      <div id="ai-log" style="flex:1;overflow-y:auto;background:var(--bg);border-radius:8px;padding:12px;margin-bottom:8px;font-size:13px;min-height:200px"></div>
      <div style="display:flex;gap:8px">
        <input class="input" id="ai-ci" placeholder="질문을 입력하세요...">
        <button class="btn btn-primary" id="ai-cs">전송</button>
      </div>
    </div>
  </div>
  </div>`;
}
async function init(){
  const students=await api.getStudents();
  const sel=document.getElementById('ai-stu');
  sel.innerHTML=students.map(s=>`<option value="${s.id}">${s.number}번 ${s.name}</option>`).join('');
  document.getElementById('ai-ab').onclick=analyze;
  document.getElementById('ai-cs').onclick=chat;
  document.getElementById('ai-ci').onkeydown=e=>{if(e.key==='Enter')chat();};
}
async function analyze(){
  const sid=parseInt(document.getElementById('ai-stu').value);
  const apiKey=await api.getSetting('ai_api_key','');
  if(!apiKey){toast('설정에서 AI API 키를 입력하세요','error');return;}
  const students=await api.getStudents();const s=students.find(x=>x.id===sid);
  const co=await api.getCounseling({student_id:sid});
  const ob=await api.getObservations({student_id:sid});
  const att=await api.getAttendanceStats(new Date().getFullYear(),0);
  const as=att.find(a=>a.id===sid);
  const text=`학생: ${s.name} (${s.number}번)\n결석: ${as?as.absent:0}회, 지각: ${as?as.late:0}회\n상담 ${co.length}건:\n${co.slice(0,3).map(c=>`- ${c.date}: ${c.content.slice(0,50)}`).join('\n')}\n관찰 ${ob.length}건:\n${ob.slice(0,3).map(o=>`- ${o.date}[${o.subject}]: ${o.content.slice(0,50)}`).join('\n')}`;
  const btn=document.getElementById('ai-ab'),ar=document.getElementById('ai-ar');
  btn.disabled=true;btn.textContent='분석 중...';ar.textContent='AI가 분석 중입니다...';
  const model=await api.getSetting('ai_model','claude-opus-4-5');
  const provider=await api.getSetting('ai_provider','claude');
  const result=await api.aiExtractTodos(apiKey,model,provider,`다음 학생 정보를 분석해주세요:\n\n${text}`);
  btn.disabled=false;btn.textContent='🤖 AI 분석 시작';
  ar.textContent=result.error?`오류: ${result.error}`:result.result||'분석 결과 없음';
}
async function chat(){
  const input=document.getElementById('ai-ci'),msg=input.value.trim();if(!msg)return;
  const apiKey=await api.getSetting('ai_api_key','');
  if(!apiKey){toast('설정에서 AI API 키를 입력하세요','error');return;}
  const log=document.getElementById('ai-log');
  log.innerHTML+=`<div style="margin-bottom:8px"><strong style="color:var(--accent)">나: </strong>${msg}</div>`;
  input.value='';
  const model=await api.getSetting('ai_model','claude-opus-4-5');
  const provider=await api.getSetting('ai_provider','claude');
  const result=await api.aiExtractTodos(apiKey,model,provider,msg);
  const resp=result.error?`오류: ${result.error}`:result.result||'';
  log.innerHTML+=`<div style="margin-bottom:8px;padding:8px;background:var(--hover);border-radius:6px"><strong style="color:var(--text2)">AI: </strong>${resp}</div>`;
  log.scrollTop=log.scrollHeight;
}
window.registerPage('ai_analysis',{render,init});
})();
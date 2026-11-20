// Configure URL e chave publicavel em js/config.js (nunca use service_role).
const client = window.supabase?.createClient(window.ESI_SUPABASE_URL || "", window.ESI_SUPABASE_ANON_KEY || "");
let cloudData = {students:[],payments:[],expenses:[],grades:[]};
const getData = () => cloudData;
const fmtDate = s => s ? String(s).split("-").reverse().join("/") : "—";
const configured = () => Boolean(window.ESI_SUPABASE_URL && window.ESI_SUPABASE_ANON_KEY && !window.ESI_SUPABASE_URL.includes('SEU-PROJETO'));
const showError = e => {console.error(e); let el=document.querySelector('#cloud-alert'); if(!el){el=document.createElement('p');el.id='cloud-alert';el.className='cloud-alert';document.querySelector('.page-content, .login-card, main')?.prepend(el);}if(el)el.textContent='Erro ao acessar a nuvem: '+(e?.message||String(e));};
async function loadData(){
  const tables=['students','payments','expenses','grades'];
  const responses=await Promise.all(tables.map(t=>client.from(t).select('*').order('created_at',{ascending:true})));
  for(let i=0;i<responses.length;i++)if(responses[i].error)throw responses[i].error;
  const [students,payments,expenses,grades]=responses.map(r=>r.data);
  const names=new Map(students.map(s=>[s.id,s.name]));
  cloudData={
    students:students.map(s=>({...s,guardian:s.guardian_name,relation:s.guardian_relation,phone:s.guardian_phone,email:s.guardian_email,classroom:s.classroom})),
    payments:payments.map(p=>({...p,student:names.get(p.student_id)||'Aluno removido',due:fmtDate(p.due_date),value:Number(p.amount),status:p.status==='paid'?'Pago':'Pendente'})),
    expenses:expenses.map(p=>({...p,due:fmtDate(p.due_date),value:Number(p.amount)})),
    grades:grades.map(g=>({...g,student:names.get(g.student_id)||'Aluno removido',classroom:students.find(s=>s.id===g.student_id)?.classroom||'—',grade:Number(g.score)}))
  };
}
async function currentSchool(){
 const {data,error}=await client.from('memberships').select('school_id').limit(1).maybeSingle();
 if(error)throw error;
 if(!data)throw new Error('Sua conta ainda não foi vinculada à escola. Consulte o README.');
 return data.school_id;
}
const money = n => n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const initials = name => name.split(" ").filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const esc = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const statusClass = status => status==="Pago"||status==="Ativo"?"status-paid":"status-pending";

async function requireAuth(){
  if(!configured())throw new Error('Configure js/config.js com a URL e a chave publicável do Supabase.');
  const {data:{session},error}=await client.auth.getSession();
  if(error)throw error;
  if(!session){location.replace('index.html');return false;}
  return true;
}
function setupLogin(){
  const form=document.querySelector('#login-form');if(!form)return;
  if(!configured()){document.querySelector('#login-error').textContent='Configure js/config.js antes de entrar.';return;}
  client.auth.getSession().then(({data})=>{if(data.session)location.replace('dashboard.html')});
  form.addEventListener('submit',async e=>{
    e.preventDefault();const btn=form.querySelector('button[type=submit]');btn.disabled=true;
    const email=document.querySelector('#username').value.trim(),password=document.querySelector('#password').value;
    const {error}=await client.auth.signInWithPassword({email,password});
    btn.disabled=false;
    if(error)document.querySelector('#login-error').textContent='Não foi possível entrar: '+error.message;
    else location.replace('dashboard.html');
  });
}
function setupShell(){
  const page=document.body.dataset.page;
  document.querySelector(`[data-nav="${page}"]`)?.classList.add("active");
  document.querySelector("#logout")?.addEventListener("click",async()=>{await client.auth.signOut();location.href="index.html";});
  const sidebar=document.querySelector("#sidebar"), overlay=document.querySelector("#sidebar-overlay");
  document.querySelector("#menu-toggle")?.addEventListener("click",()=>{sidebar.classList.toggle("open");overlay.classList.toggle("show");});
  overlay?.addEventListener("click",()=>{sidebar.classList.remove("open");overlay.classList.remove("show");});
}
function person(name){return `<span class="person-cell"><span class="person-avatar">${esc(initials(name))}</span>${esc(name)}</span>`;}
function renderDashboard(){
  const d=getData(), received=d.payments.filter(p=>p.status==="Pago").reduce((s,p)=>s+p.value,0), open=d.payments.filter(p=>p.status==="Pendente").reduce((s,p)=>s+p.value,0), expenses=d.expenses.reduce((s,p)=>s+p.value,0), avg=d.grades.length?d.grades.reduce((s,g)=>s+g.grade,0)/d.grades.length:0;
  document.querySelector("#stat-students").textContent=d.students.length;
  document.querySelector("#stat-receivable").textContent=money(open);
  document.querySelector("#stat-payable").textContent=money(expenses);
  document.querySelector("#stat-average").textContent=avg.toFixed(1).replace(".",",");
  document.querySelector("#grade-ring-value").textContent=avg.toFixed(1).replace(".",",");
  document.querySelector("#grade-count").textContent=`${d.grades.length} avaliações`;
  document.querySelector("#grade-students").textContent=new Set(d.grades.map(g=>g.student)).size;
  document.querySelector("#grade-progress").style.width=`${Math.min(100,avg*10)}%`;
  document.querySelector("#recent-students").innerHTML=d.students.slice(-5).reverse().map(s=>`<tr><td>${person(s.name)}</td><td>${esc(s.classroom)}</td><td>${esc(s.guardian)}</td><td><span class="status status-active">Ativo</span></td></tr>`).join("");
  drawChart(received,open,expenses);
}
function drawChart(received,open,expenses){
  const canvas=document.querySelector("#finance-chart");if(!canvas)return;
  const ctx=canvas.getContext("2d"),w=canvas.clientWidth,h=canvas.clientHeight,ratio=window.devicePixelRatio||1;
  canvas.width=w*ratio;canvas.height=h*ratio;ctx.scale(ratio,ratio);ctx.clearRect(0,0,w,h);
  const max=Math.max(received+open,expenses,1000)*1.18, base=h-30, top=16, chartH=base-top;
  ctx.font="10px DM Sans";ctx.fillStyle="#929cad";ctx.strokeStyle="#edf0f5";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){let y=top+chartH*i/4;ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(w-8,y);ctx.stroke();ctx.fillText(i===0?"":(max*(1-i/4)/1000).toFixed(0)+"k",2,y+3);}
  const groups=[{label:"Recebimentos",values:[received,open],colors:["#776be0","#b8b1f3"]},{label:"Despesas",values:[expenses],colors:["#e4a45c"]}];
  const centers=[w*.34,w*.72], barW=Math.min(36,w*.11);
  groups.forEach((g,i)=>{let total=g.values.reduce((a,b)=>a+b,0),x=centers[i]-(g.values.length*barW+(g.values.length-1)*7)/2;g.values.forEach((v,j)=>{let bh=v/max*chartH;ctx.fillStyle=g.colors[j];ctx.beginPath();ctx.roundRect(x+j*(barW+7),base-bh,barW,bh,5);ctx.fill();});ctx.fillStyle="#667286";ctx.textAlign="center";ctx.fillText(g.label,centers[i],h-8);});
}
function renderStudents(){
  const d=getData(), tbody=document.querySelector("#students-table");if(!tbody)return;
  const draw=()=>{let q=document.querySelector("#student-search").value.toLowerCase();let rows=d.students.filter(s=>[s.name,s.classroom,s.guardian].join(" ").toLowerCase().includes(q));tbody.innerHTML=rows.map(s=>`<tr><td>${person(s.name)}</td><td>${esc(s.classroom)}</td><td>${esc(s.guardian)}</td><td>${esc(s.phone)}</td><td><span class="status status-active">Ativo</span></td></tr>`).join("")||'<tr><td colspan="5">Nenhum aluno encontrado.</td></tr>';document.querySelector("#student-count").textContent=`Exibindo ${rows.length} de ${d.students.length} alunos`;};
  document.querySelector("#student-search").addEventListener("input",draw);draw();
}
function renderGuardians(){
  const d=getData(),tbody=document.querySelector("#guardians-table");if(!tbody)return;
  const draw=()=>{let q=document.querySelector("#guardian-search").value.toLowerCase();let rows=d.students.filter(s=>[s.guardian,s.name,s.phone,s.email].join(" ").toLowerCase().includes(q));tbody.innerHTML=rows.map(s=>`<tr><td>${person(s.guardian)}</td><td>${esc(s.name)}</td><td>${esc(s.relation||"—")}</td><td>${esc(s.phone)}</td><td>${esc(s.email||"—")}</td></tr>`).join("")||'<tr><td colspan="5">Nenhum responsável encontrado.</td></tr>';document.querySelector("#guardian-total").textContent=`${rows.length} responsáveis`;};
  document.querySelector("#guardian-search").addEventListener("input",draw);draw();
}
function renderFinance(){
  const d=getData(),received=d.payments.filter(p=>p.status==="Pago").reduce((s,p)=>s+p.value,0),open=d.payments.filter(p=>p.status==="Pendente").reduce((s,p)=>s+p.value,0),expenses=d.expenses.reduce((s,p)=>s+p.value,0);
  document.querySelector("#total-received").textContent=money(received);document.querySelector("#total-open").textContent=money(open);document.querySelector("#total-expenses").textContent=money(expenses);
  const tbody=document.querySelector("#payments-table"),filter=document.querySelector("#payment-filter");
  const draw=()=>{let rows=d.payments.filter(p=>filter.value==="todos"||p.status===filter.value);tbody.innerHTML=rows.map(p=>`<tr><td>${person(p.student)}</td><td>${esc(p.description)}</td><td>${esc(p.due)}</td><td><strong>${money(p.value)}</strong></td><td><span class="status ${statusClass(p.status)}">${p.status}</span></td></tr>`).join("")||'<tr><td colspan="5">Nenhum pagamento encontrado.</td></tr>';};
  filter.addEventListener("change",draw);draw();
  document.querySelector("#expenses-table").innerHTML=d.expenses.map(p=>`<tr><td>${esc(p.description)}</td><td>${esc(p.category)}</td><td>${esc(p.due)}</td><td><strong>${money(p.value)}</strong></td></tr>`).join("");
}
function renderGrades(){
  const d=getData(),tbody=document.querySelector("#grades-table"),avg=d.grades.length?d.grades.reduce((s,g)=>s+g.grade,0)/d.grades.length:0;
  document.querySelector("#grades-average").textContent=avg.toFixed(1).replace(".",",");
  const draw=()=>{let q=document.querySelector("#grade-search").value.toLowerCase();let rows=d.grades.filter(g=>[g.student,g.subject,g.classroom].join(" ").toLowerCase().includes(q));tbody.innerHTML=rows.map(g=>`<tr><td>${person(g.student)}</td><td>${esc(g.classroom)}</td><td>${esc(g.subject)}</td><td><strong>${g.grade.toFixed(1).replace(".",",")}</strong></td><td><span class="status ${g.grade>=7?"status-paid":"status-pending"}">${g.grade>=7?"Aprovado":"Em recuperação"}</span></td></tr>`).join("")||'<tr><td colspan="5">Nenhuma nota encontrada.</td></tr>';};
  document.querySelector("#grade-search").addEventListener("input",draw);draw();
}
function setupStudentForm(){
 const form=document.querySelector('#student-form');if(!form)return;
 form.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('button[type=submit]'),feedback=document.querySelector('#form-feedback');btn.disabled=true;feedback.textContent='Salvando na nuvem...';
  try{
   const school_id=await currentSchool();
   const payload={school_id,name:document.querySelector('#student-name').value.trim(),birth:document.querySelector('#student-birth').value||null,classroom:document.querySelector('#student-class').value.trim(),guardian_name:document.querySelector('#guardian-name').value.trim(),guardian_relation:document.querySelector('#guardian-relation').value,guardian_phone:document.querySelector('#guardian-phone').value.trim(),guardian_email:document.querySelector('#guardian-email').value.trim()||null};
   const {error}=await client.from('students').insert(payload);if(error)throw error;
   feedback.textContent='Aluno salvo na nuvem com sucesso!';form.reset();setTimeout(()=>location.href='alunos.html',700);
  }catch(err){feedback.textContent='Erro: '+err.message;}finally{btn.disabled=false;}
 });
}
function makeCloudForms(){
 const page=document.body.dataset.page;
 if(!['financeiro','notas'].includes(page))return;
 const panel=document.createElement('article');panel.className='panel cloud-form-panel';
 if(page==='financeiro'){
  panel.innerHTML=`<h3>Adicionar lançamento</h3><form id="cloud-record-form" class="cloud-record-form"><label>Tipo<select name="kind"><option value="payment">Mensalidade / recebimento</option><option value="expense">Despesa</option></select></label><label class="student-field">Aluno<select name="student_id" id="record-student"></select></label><label>Descrição<input name="description" required maxlength="180"></label><label>Vencimento<input name="due_date" type="date" required></label><label>Valor (R$)<input name="amount" type="number" step="0.01" min="0.01" required></label><label class="payment-field">Status<select name="status"><option value="pending">Pendente</option><option value="paid">Pago</option></select></label><label class="expense-field" hidden>Categoria<input name="category" value="Geral"></label><button class="btn btn-primary" type="submit">Salvar na nuvem</button><p class="cloud-form-message" aria-live="polite"></p></form>`;
 }else{
  panel.innerHTML=`<h3>Lançar nota</h3><form id="cloud-record-form" class="cloud-record-form"><label>Aluno<select name="student_id" id="record-student" required></select></label><label>Disciplina<input name="subject" maxlength="120" required></label><label>Nota (0 a 10)<input name="score" type="number" min="0" max="10" step="0.1" required></label><button class="btn btn-primary" type="submit">Salvar nota</button><p class="cloud-form-message" aria-live="polite"></p></form>`;
 }
 document.querySelector('.page-content').prepend(panel);
 const select=panel.querySelector('#record-student');select.innerHTML='<option value="">Selecione o aluno</option>'+getData().students.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
 const form=panel.querySelector('form'),kind=form.elements.namedItem('kind');
 if(kind){const toggle=()=>{let expense=kind.value==='expense';panel.querySelector('.student-field').hidden=expense;panel.querySelector('.payment-field').hidden=expense;panel.querySelector('.expense-field').hidden=!expense;select.required=!expense;};kind.addEventListener('change',toggle);toggle();}
 form.addEventListener('submit',async e=>{
  e.preventDefault();const btn=form.querySelector('button'),msg=form.querySelector('.cloud-form-message');btn.disabled=true;msg.textContent='Salvando...';
  try{
   const school_id=await currentSchool(),v=Object.fromEntries(new FormData(form));let table,payload;
   if(page==='notas'){table='grades';payload={school_id,student_id:v.student_id,subject:v.subject.trim(),score:Number(v.score)};}
   else if(v.kind==='expense'){table='expenses';payload={school_id,description:v.description.trim(),category:v.category.trim()||'Geral',due_date:v.due_date,amount:Number(v.amount)};}
   else {if(!v.student_id)throw Error('Selecione um aluno.');table='payments';payload={school_id,student_id:v.student_id,description:v.description.trim(),due_date:v.due_date,amount:Number(v.amount),status:v.status};}
   const {error}=await client.from(table).insert(payload);if(error)throw error;
   await loadData();page==='notas'?renderGrades():renderFinance();form.reset();if(kind)kind.dispatchEvent(new Event('change'));msg.textContent='Registro salvo na nuvem!';
  }catch(err){msg.textContent='Erro: '+err.message;}finally{btn.disabled=false;}
 });
}
async function start(){
 setupLogin();const page=document.body.dataset.page;if(!page||page==='login')return;
 try{
  if(!await requireAuth())return;
  setupShell();await loadData();
  if(page==='dashboard'){renderDashboard();window.addEventListener('resize',()=>{const d=getData();drawChart(d.payments.filter(p=>p.status==='Pago').reduce((s,p)=>s+p.value,0),d.payments.filter(p=>p.status==='Pendente').reduce((s,p)=>s+p.value,0),d.expenses.reduce((s,p)=>s+p.value,0));});}
  if(page==='alunos')renderStudents();if(page==='responsaveis')renderGuardians();if(page==='financeiro')renderFinance();if(page==='notas')renderGrades();if(page==='cadastro')setupStudentForm();makeCloudForms();
  // Atualiza consultas ao retornar à aba; outros computadores veem as alterações.
  document.addEventListener('visibilitychange',async()=>{if(document.hidden||page==='cadastro')return;try{await loadData();if(page==='dashboard')renderDashboard();if(page==='alunos')renderStudents();if(page==='responsaveis')renderGuardians();if(page==='financeiro')renderFinance();if(page==='notas')renderGrades();}catch(e){showError(e);}});
 }catch(err){showError(err);}
}
document.addEventListener('DOMContentLoaded',start);

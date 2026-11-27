/* Gestion AS — application professeur (intégrée au portail Mes Apps EPS). 100 % local. */
(function(){
'use strict';
const A=window.ASCORE,$=id=>document.getElementById(id),esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const INS=A.ACT_ID,GES='gestion_as',PRE='gestion_as_presences',QK='gestion_as_file_v1';
let L=[],logo=null,queue=[];
$('saison').textContent='Saison '+A.SAISON;$('ver').textContent='v'+(window.VERSION||'');
const im=new Image();im.onload=()=>{logo=im};im.src='img/logo-as.png';
try{queue=JSON.parse(localStorage.getItem(QK)||'[]')}catch(e){queue=[]}
const saveQ=()=>{try{localStorage.setItem(QK,JSON.stringify(queue))}catch(e){}};
function toast(t){const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),3200)}
const G=e=>(e.ext&&e.ext[GES])||{},R=e=>(e.ext&&e.ext[INS])||null,PL=e=>((e.ext&&e.ext[PRE])||{}).lignes||[];
const inscrit=e=>{const g=G(e);return g.Inscrit?g.Inscrit==='Oui':!!(R(e)&&Object.keys(R(e)).length)};
const licence=e=>G(e).Licence||(R(e)||{}).Licence||'';
const jo=e=>G(e).Jeune_officiel||(R(e)||{}).Jeune_officiel||'';
const byName=(a,b)=>(a.nom+a.prenom).localeCompare(b.nom+b.prenom,'fr');
const nomc=e=>e.nom+' '+A.tc(e.prenom);
async function load(){L=(await EPS.all()).sort(byName);render()}

/* ---------- Onglets ---------- */
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{fermeScan();document.querySelectorAll('.tabs button').forEach(x=>x.classList.toggle('on',x===b));document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id===b.dataset.p));render()});

/* ---------- Application d'une inscription à un élève ---------- */
async function applique(e,rec,pres,extra){
 await EPS.setExt(INS,e.id,rec);
 const g={Inscrit:'Oui'};if(extra&&extra.licence)g.Licence=extra.licence;if(rec.Licence&&!G(e).Licence)g.Licence=rec.Licence;if(rec.Jeune_officiel&&!G(e).Jeune_officiel)g.Jeune_officiel=rec.Jeune_officiel;
 await EPS.setExt(GES,e.id,g);
 for(const p of pres||[])await EPS.addLigne(PRE,e.id,{Date:p.Date,Activite:p.Activite||'',Presence:'Oui'});
}
async function recoit(it,silencieux){ // it={nom,prenom,classe,naissance,record,presences}
 const m=A.matchEleve(L,it);
 if(m.statut==='certain'){await applique(m.eleve,it.record,it.presences);await load();if(!silencieux)toast('✅ '+nomc(m.eleve)+' enregistré(e)'+(m.notes.length?' ('+m.notes[0]+')':''));return'ok'}
 const k=A.norm(it.nom+it.prenom+it.classe);queue=queue.filter(x=>x.k!==k);
 queue.push({k,nom:it.nom,prenom:it.prenom,classe:it.classe,naissance:it.naissance||'',record:it.record,presences:it.presences||[],cands:m.candidats.map(c=>c.eleve.id),notes:m.notes});
 saveQ();render();if(!silencieux)toast('⚠ '+it.nom+' '+it.prenom+' : à rapprocher');return'queue'}
async function traiteTexte(t){
 const ty=A.typeCode(t);
 if(ty==='inscription'){const d=A.decodeInscription(t);return recoit({nom:d.nom,prenom:d.prenom,classe:d.classe,naissance:d.record.Naissance,record:d.record})}
 if(ty==='carte')throw new Error('Ceci est une carte d’adhérent : utilisez l’onglet Appel.');
 throw new Error('Code non reconnu.');
}

/* ---------- Scanner caméra ---------- */
let stream=null,scanOn=false,lastTxt='',lastT=0;
async function scanner(onCode,titre){
 try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})}catch(e){toast('Caméra indisponible : '+e.message);return}
 const v=$('vid');v.srcObject=stream;await v.play();$('scan').classList.add('on');$('scanTx').textContent=titre;scanOn=true;
 const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
 const tick=async()=>{if(!scanOn)return;
  if(v.videoWidth){const s=Math.min(1,720/v.videoWidth);cv.width=v.videoWidth*s;cv.height=v.videoHeight*s;cx.drawImage(v,0,0,cv.width,cv.height);
   const r=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height,{inversionAttempts:'dontInvert'});
   if(r&&r.data&&(r.data!==lastTxt||Date.now()-lastT>3000)){lastTxt=r.data;lastT=Date.now();
    let msg='';try{msg=await onCode(r.data)||''}catch(e){msg='❌ '+e.message}
    if(msg){const f=$('flash');f.textContent=msg;f.hidden=false;clearTimeout(f._t);f._t=setTimeout(()=>f.hidden=true,2200)}}}
  requestAnimationFrame(tick)};tick()}
function fermeScan(){if(!scanOn&&!stream)return;scanOn=false;if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('scan').classList.remove('on')}
$('scanX').onclick=fermeScan;document.addEventListener('visibilitychange',()=>{if(document.hidden)fermeScan()});window.addEventListener('pagehide',fermeScan);

$('bScan').onclick=()=>scanner(async t=>{const r=await traiteTexte(t);setTimeout(fermeScan,900);return r==='ok'?'✅ Inscription enregistrée':'⚠ À rapprocher'},'Scannez le QR « Mon AS » de l’élève');
$('bPaste').onclick=()=>{$('pasteTx').value='';$('dPaste').showModal()};$('pasteX').onclick=()=>$('dPaste').close();
$('pasteOk').onclick=async()=>{try{await traiteTexte($('pasteTx').value);$('dPaste').close()}catch(e){toast(e.message)}};

/* ---------- Import de fichiers ---------- */
const readText=async f=>{const b=await f.arrayBuffer();try{return new TextDecoder('utf-8',{fatal:true}).decode(b)}catch(e){return new TextDecoder('windows-1252').decode(b)}};
async function importeFichier(f){
 if(/\.xlsx$/i.test(f.name)){
  const orph=[],r=await EPS.importXLSX(await f.arrayBuffer(),f.name,{ignorerEleves:true,orphelins:orph});
  let n=0;for(const id of r.ids||[]){const e=(await EPS.all()).find(x=>x.id===id);if(e&&R(e)&&!G(e).Inscrit){await EPS.setExt(GES,id,{Inscrit:'Oui'});n++}}
  let q=0;for(const o of orph.filter(o=>o.app===INS)){await load();const rec=Object.assign({},o.champs);if(!rec.Naissance&&o.naissance)rec.Naissance=A.isoDate(o.naissance);
   const mk={};Object.keys(rec).forEach(k=>mk[k]=rec[k]);if(await recoit({nom:o.nom,prenom:o.prenom,classe:o.classe,naissance:rec.Naissance,record:mk},true)==='ok')n++;else q++}
  await load();return f.name+' : '+(r.ids||[]).length+' élève(s) rattaché(s)'+(q?', '+q+' à rapprocher':'')}
 const p=LEGACY.parse(await readText(f));let ok=0,q=0;
 for(const s of p.eleves){const rec=Object.assign({},s.record);
  if(await recoit({nom:s.nom,prenom:s.prenom,classe:s.classe,naissance:s.naissance,record:rec,presences:s.presences},true)==='ok')ok++;else q++}
 await load();return f.name+' (format '+p.type+') : '+ok+' rapproché(s) automatiquement'+(q?', '+q+' à rapprocher':'')}
$('bFile').onclick=()=>$('fileIn').click();
$('fileIn').onchange=async ev=>{const out=[];for(const f of ev.target.files){try{out.push(await importeFichier(f))}catch(e){out.push(f.name+' : '+e.message)}}ev.target.value='';alert(out.join('\n'))};

/* ---------- File « À rapprocher » ---------- */
function renderQueue(){
 $('nbq').hidden=!queue.length;$('nbq').textContent=queue.length;
 $('queue').innerHTML=queue.map((q,i)=>{const cs=q.cands.map(id=>L.find(e=>e.id===id)).filter(Boolean);
  return`<div class="queue"><h3>${esc(q.nom)} ${esc(q.prenom)} <span class="pill">${esc(q.classe)}</span></h3><div class="sb hint">${esc((q.notes||[]).join(' · '))}</div>
  <div class="cands">${cs.map(e=>`<button class="btn b sm" data-lie="${i}|${e.id}">C'est ${esc(nomc(e))} (${esc(e.classe)})</button>`).join('')}</div>
  <div class="row" style="margin-top:6px"><button class="btn r sm" data-cherche="${i}">Chercher dans la liste…</button><button class="btn r sm" data-cree="${i}">Créer l'élève</button><button class="btn r sm" data-ignore="${i}">Ignorer</button></div></div>`}).join('')}
$('queue').onclick=async ev=>{const b=ev.target.closest('button');if(!b)return;
 const d=b.dataset;
 if(d.lie){const[i,id]=d.lie.split('|');const q=queue[+i],e=L.find(x=>x.id===id);await applique(e,q.record,q.presences);queue.splice(+i,1);saveQ();await load();toast('✅ '+nomc(e))}
 else if(d.ignore){queue.splice(+d.ignore,1);saveQ();render()}
 else if(d.cree){const q=queue[+d.cree];const e=await EPS.putEleve({nom:q.nom,prenom:q.prenom,classe:q.classe});await applique(e,q.record,q.presences);queue.splice(+d.cree,1);saveQ();await load();toast('Élève créé : '+nomc(e))}
 else if(d.cherche){const q=queue[+d.cherche];const s=prompt('Nom de l’élève dans la liste du portail :',q.nom);if(!s)return;
  const r=L.filter(e=>A.norm(e.nom+e.prenom).includes(A.norm(s))).slice(0,6);if(!r.length)return toast('Aucun résultat');
  q.cands=r.map(e=>e.id);saveQ();render()}};

/* ---------- Liste des élèves ---------- */
const classes=()=>[...new Set(L.map(e=>e.classe).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{numeric:true}));
function fillSel(sel,all){const v=sel.value,c=classes();sel.innerHTML='<option value="">Toutes les classes</option>'+c.map(x=>`<option>${esc(x)}</option>`).join('');if(c.includes(v))sel.value=v}
function pills(e){const g=G(e),p=[];
 p.push(`<span class="pill ${g.Cotisation==='Oui'?'ok':'ko'}">${g.Cotisation==='Oui'?'cotisation ✓':'cotisation ✗'}</span>`);
 p.push(`<span class="pill ${licence(e)?'ok':'or'}">${licence(e)?'licence '+esc(licence(e)):'licence ?'}</span>`);
 p.push(`<span class="pill ${g.Dossier_papier==='Oui'?'ok':'or'}">${g.Dossier_papier==='Oui'?'fiche ✓':'fiche ?'}</span>`);
 const n=PL(e).length;if(n)p.push(`<span class="pill">${n} présence${n>1?'s':''}</span>`);return p.join('')}
function renderList(){
 $('vide').hidden=!!L.length;
 const q=A.norm($('q').value),cl=$('fcl').value,st=$('fst').value;
 let l=L.filter(e=>(!cl||e.classe===cl));
 if(q)l=l.filter(e=>A.norm(e.nom+e.prenom+e.classe).includes(q));
 else l=l.filter(e=>st==='all'?true:st==='ins'?inscrit(e):inscrit(e)&&(st==='coti'?G(e).Cotisation!=='Oui':st==='lic'?!licence(e):G(e).Dossier_papier!=='Oui'));
 $('cnt').textContent=l.length+' élève'+(l.length>1?'s':'')+(q?' (recherche dans toute la liste)':'');
 $('lst').innerHTML=l.slice(0,300).map(e=>`<li><div class="cl"><span class="nm">${esc(e.nom)} ${esc(A.tc(e.prenom))}</span> <span class="sb">· ${esc(e.classe)}</span> <span class="pls">${inscrit(e)?pills(e):'<span class="pill">non inscrit</span>'}</span></div><button class="btn b sm" data-id="${esc(e.id)}">Fiche</button></li>`).join('')}
['q','fcl','fst'].forEach(i=>$(i).addEventListener('input',renderList));
$('lst').onclick=ev=>{const c=ev.target.closest('button[data-id]');if(c)fiche(c.dataset.id)};
function renderKpis(){const I=L.filter(inscrit);
 $('kpis').innerHTML=[[I.length,'Inscrits'],[I.filter(e=>G(e).Cotisation!=='Oui').length,'Cotisation due'],[I.filter(e=>!licence(e)).length,'Sans licence'],[I.filter(e=>G(e).Dossier_papier!=='Oui').length,'Sans fiche']].map(([n,t])=>`<div class="kpi"><b>${n}</b><span>${t}</span></div>`).join('')}

/* ---------- Fiche élève ---------- */
let curId=null;
function fiche(id){const e=L.find(x=>x.id===id);if(!e)return;curId=id;const r=R(e)||{};
 $('fTitre').textContent=nomc(e)+' · '+(e.classe||'');
 const kv=[['Naissance',A.frDate(r.Naissance||e.naissance)+(r.Lieu_naissance?' à '+r.Lieu_naissance:'')],['Sexe',r.Sexe],['Responsable',[r.Nom_responsable,r.Qualite_responsable&&'('+r.Qualite_responsable+')'].filter(Boolean).join(' ')],['Téléphone',r.Telephone_responsable],['E-mail',r.Mail_responsable],['Activités',r.Activites],['Compétitions',r.Competitions_UNSS],['Sport partagé',r.Sport_partage],['Club',r.Club],['Droit à l’image',r.Droit_image],['Inscription du',A.frDate(r.Date_signature)]].filter(x=>x[1]);
 $('fInfo').innerHTML=kv.length?'<div class="kv">'+kv.map(([k,v])=>`<b>${k}</b><span>${esc(v)}</span>`).join('')+'</div>':'<p class="hint">Pas encore de fiche d’inscription reçue.</p>';
 const g=G(e);$('fIns').checked=inscrit(e);$('fCoti').checked=g.Cotisation==='Oui';$('fPap').checked=g.Dossier_papier==='Oui';$('fLic').value=licence(e);$('fJo').value=jo(e);$('fNotes').value=g.Notes||'';
 $('dFiche').showModal()}
$('fX').onclick=()=>$('dFiche').close();
$('fOk').onclick=async()=>{await EPS.setExt(GES,curId,{Inscrit:$('fIns').checked?'Oui':'Non',Cotisation:$('fCoti').checked?'Oui':'Non',Dossier_papier:$('fPap').checked?'Oui':'Non',Licence:A.clean($('fLic').value),Jeune_officiel:A.clean($('fJo').value),Notes:A.clean($('fNotes').value)});$('dFiche').close();await load()};
$('fDel').onclick=async()=>{await EPS.setExt(GES,curId,{Inscrit:'Non'});$('dFiche').close();await load()};

/* ---------- Cartes ---------- */
function renderCartes(){fillSel($('ccl'));const cl=$('ccl').value,keep=new Set([...document.querySelectorAll('#clst input:checked')].map(i=>i.value));
 const l=L.filter(e=>inscrit(e)&&(!cl||e.classe===cl));
 $('clst').innerHTML=l.map(e=>`<li><label class="cl ck" style="font-weight:700"><input class="chkcol" type="checkbox" value="${esc(e.id)}" ${keep.has(e.id)?'checked':''}><span>${esc(e.nom)} ${esc(A.tc(e.prenom))} <span class="sb">· ${esc(e.classe)} · ${licence(e)?esc(licence(e)):'licence en attente'}</span></span></label></li>`).join('')||'<li class="hint">Aucun inscrit pour l’instant.</li>'}
$('ccl').onchange=renderCartes;$('cAll').onchange=ev=>document.querySelectorAll('#clst input').forEach(i=>i.checked=ev.target.checked);
const sel=()=>[...document.querySelectorAll('#clst input:checked')].map(i=>L.find(e=>e.id===i.value)).filter(Boolean);
const dataCarte=e=>({nom:e.nom,prenom:e.prenom,classe:e.classe,licence:licence(e),jo:jo(e)});
$('cPng').onclick=()=>{const s=sel()[0];if(!s)return toast('Cochez au moins un élève');const c=A.cardCanvas(document,dataCarte(s),{logo}),d=$('cprev');d.hidden=false;d.width=c.width;d.height=c.height;d.getContext('2d').drawImage(c,0,0)};
$('cPdf').onclick=()=>{const s=sel();if(!s.length)return toast('Cochez au moins un élève');
 const P=new jspdf.jsPDF({unit:'mm',format:'a4'}),W=85.6,H=54,gx=(210-2*W)/3,gy=(297-5*H)/6;
 s.forEach((e,k)=>{if(k&&k%10===0)P.addPage();const p=k%10,x=gx+(p%2)*(W+gx),y=gy+Math.floor(p/2)*(H+gy);
  P.addImage(A.cardCanvas(document,dataCarte(e),{logo},1011).toDataURL('image/png'),'PNG',x,y,W,H);P.setDrawColor(190);P.setLineWidth(.1);P.roundedRect(x,y,W,H,3,3)});
 P.save('Cartes_AS_'+A.SAISON+'.pdf')};

/* ---------- Appel ---------- */
$('aDate').value=A.today();
$('aActs').innerHTML=A.ACT_AS.map(a=>`<option value="${esc(a)}">`).join('');
try{$('aAct').value=localStorage.getItem('gestion_as_act')||''}catch(e){}
$('aAct').oninput=()=>{try{localStorage.setItem('gestion_as_act',$('aAct').value)}catch(e){}renderAppel()};$('aDate').oninput=renderAppel;
const seance=()=>({Date:A.isoDate($('aDate').value)||A.today(),Activite:A.clean($('aAct').value)});
const estPresent=(e,s)=>PL(e).some(l=>l.Date===s.Date&&(l.Activite||'')===s.Activite);
async function marque(e,v){const s=seance();if(v){await EPS.addLigne(PRE,e.id,{Date:s.Date,Activite:s.Activite,Presence:'Oui'})}
 else{const l=PL(e).filter(x=>!(x.Date===s.Date&&(x.Activite||'')===s.Activite));await EPS.setExt(PRE,e.id,{lignes:l})}await load()}
function renderAppel(){const s=seance();
 const pr=L.filter(e=>estPresent(e,s));$('aN').textContent='('+pr.length+')';
 $('aPres').innerHTML=pr.map(e=>`<li><span class="nm">${esc(nomc(e))} <span class="sb">· ${esc(e.classe)}</span></span><button class="btn r sm" data-no="${esc(e.id)}">Retirer</button></li>`).join('')||'<li class="hint">Personne pour l’instant.</li>';
 const q=A.norm($('aQ').value);
 $('aRes').innerHTML=q.length<2?'':L.filter(e=>A.norm(e.nom+e.prenom).includes(q)&&!estPresent(e,s)).slice(0,6).map(e=>`<li><span class="nm">${esc(nomc(e))} <span class="sb">· ${esc(e.classe)}</span> ${inscrit(e)?'':'<span class="pill or">non inscrit</span>'}</span><button class="btn sm" data-ok="${esc(e.id)}">Présent</button></li>`).join('');
 renderStats()}
$('aQ').oninput=renderAppel;
$('aRes').onclick=async ev=>{const b=ev.target.closest('[data-ok]');if(b){await marque(L.find(e=>e.id===b.dataset.ok),true);$('aQ').value='';renderAppel()}};
$('aPres').onclick=async ev=>{const b=ev.target.closest('[data-no]');if(b)await marque(L.find(e=>e.id===b.dataset.no),false)};
function trouveCarte(t){const c=A.parseCardPayload(t);if(!c)return null;
 const e=L.find(x=>A.cardId(x)===c.id);if(e)return e;
 const m=A.matchEleve(L,c);return m.statut==='certain'?m.eleve:null}
$('aScan').onclick=()=>{if(!A.clean($('aAct').value)&&!confirm('Aucune activité saisie : l’appel sera enregistré sans activité. Continuer ?'))return;
 scanner(async t=>{const e=trouveCarte(t);if(!e){if(A.typeCode(t)==='inscription')return'Ceci est un QR d’inscription';return'❌ Carte non reconnue'}
  if(estPresent(e,seance()))return'Déjà présent(e) : '+nomc(e);await marque(e,true);return'✅ '+nomc(e)+(inscrit(e)?'':' (non inscrit)')},'Flashez les cartes d’AS')};
function renderStats(){
 const I=L.filter(e=>PL(e).length||inscrit(e)),seances=new Map();
 L.forEach(e=>PL(e).forEach(l=>{const k=l.Date+'|'+(l.Activite||'');if(!seances.has(k))seances.set(k,{d:l.Date,a:l.Activite||'',n:0});seances.get(k).n++}));
 if(!seances.size){$('stats').innerHTML='<p class="hint">Les statistiques apparaîtront après le premier appel.</p>';return}
 const S=[...seances.values()],N=S.length,tot=S.reduce((a,s)=>a+s.n,0),pc=(a,b)=>b?Math.round(100*a/b):0;
 const act={};S.forEach(s=>{const a=s.a||'(sans activité)';act[a]=act[a]||{s:0,p:0};act[a].s++;act[a].p+=s.n});
 const bar=p=>`<div class="bar2"><i style="width:${Math.min(100,p)}%"></i></div>`;
 const tb=(h,rows)=>'<div style="overflow:auto"><table class="st"><tr>'+h.map(x=>`<th>${x}</th>`).join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')+'</table></div>';
 const el=I.map(e=>({e,n:PL(e).length})).sort((a,b)=>b.n-a.n||byName(a.e,b.e));
 $('stats').innerHTML=`<p class="hint"><b>${N}</b> séance${N>1?'s':''} · <b>${tot}</b> présences · moyenne <b>${(tot/N).toFixed(1)}</b> par séance</p>`+
  '<h2>Par activité</h2>'+tb(['Activité','Séances','Présences','Moy.'],Object.entries(act).sort((a,b)=>a[0].localeCompare(b[0],'fr')).map(([a,v])=>[esc(a),v.s,v.p,(v.p/v.s).toFixed(1)]))+
  '<h2 style="margin-top:14px">Par élève</h2>'+tb(['Élève','Classe','Prés.','Assiduité'],el.slice(0,150).map(x=>[esc(nomc(x.e)),esc(x.e.classe),x.n,bar(pc(x.n,N))]))}

/* ---------- Données ---------- */
const dl=(blob,n)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=n;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),3000)};
$('xAS').onclick=async()=>{try{EPS.downloadXLSX(await EPS.exportXLSX({apps:[INS,GES,PRE],ids:L.filter(e=>inscrit(e)||PL(e).length).map(e=>e.id)}),'Gestion_AS_'+A.SAISON+'.xlsx')}catch(e){toast(e.message)}};
$('xAll').onclick=async()=>{try{EPS.downloadXLSX(await EPS.exportXLSX(),'Mes_Apps_EPS_global.xlsx')}catch(e){toast(e.message)}};
$('xOpuss').onclick=()=>{const rows=[['Nom','Prénom','Sexe','Date de naissance','Classe','N° licence','N° jeune officiel','Activités','Compétitions','Sport partagé']];
 L.filter(inscrit).forEach(e=>{const r=R(e)||{};rows.push([e.nom,A.tc(e.prenom),r.Sexe||'',A.frDate(r.Naissance||e.naissance),e.classe,licence(e),jo(e),r.Activites||'',r.Competitions_UNSS||'',r.Sport_partage||''])});
 const csv='﻿'+rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(';')).join('\r\n');dl(new Blob([csv],{type:'text/csv;charset=utf-8'}),'Inscrits_AS_'+A.SAISON+'.csv')};
$('iEleves').onclick=()=>$('fEleves').click();
$('fEleves').onchange=async ev=>{const f=ev.target.files[0];ev.target.value='';if(!f)return;try{const r=await EPS.importFile(f);await load();toast('Import : '+(r.add||0)+' ajouté(s), '+(r.upd||0)+' mis à jour')}catch(e){alert(e.message)}};
$('clearAS').onclick=async()=>{if(!confirm('Effacer inscriptions, suivi et présences AS de TOUS les élèves ?'))return;await EPS.delExtTous([INS,GES,PRE]);queue=[];saveQ();await load();toast('Données AS effacées')};
async function renderMeta(){try{const m=await EPS.meta();$('meta').textContent=m?'Dernier import : '+m.n+' ('+new Date(m.v).toLocaleString('fr-FR')+')':'Aucun import pour l’instant.'}catch(e){}}

function render(){fillSel($('fcl'));renderKpis();renderList();renderQueue();renderCartes();renderAppel();renderMeta()}
load();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
window.__gas={load,recoit,traiteTexte,importeFichier,get L(){return L},get queue(){return queue},fiche};
})();

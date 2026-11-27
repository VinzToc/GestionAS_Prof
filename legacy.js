/* legacy.js — import des anciens fichiers : « Gestion AS via l'ENT » (CSV ENT + présences) et « Gestion AS Pronote » (sauvegarde CSV).
   Résultat : liste d'élèves {nom,prenom,classe,naissance,sexe,tel,record,gestion,presences:[{Date,Activite}]} prête à être rapprochée de la liste du portail. */
(function(root){
'use strict';
const A=root.ASCORE;
function parseCSV(t){t=t.replace(/^﻿/,'');const f=t.split('\n')[0];const d=[';',',','\t'].sort((a,b)=>f.split(b).length-f.split(a).length)[0];
 const rows=[];let r=[],c='',q=false;
 for(let i=0;i<t.length;i++){const ch=t[i];
  if(q){if(ch=='"'){if(t[i+1]=='"'){c+='"';i++}else q=false}else c+=ch}
  else if(ch=='"')q=true;else if(ch==d){r.push(c);c=''}
  else if(ch=='\n'||ch=='\r'){if(ch=='\r'&&t[i+1]=='\n')i++;r.push(c);rows.push(r);r=[];c=''}else c+=ch}
 if(c||r.length){r.push(c);rows.push(r)}
 return rows.filter(x=>x.some(v=>v.trim()))}
const up=x=>x===x.toUpperCase()&&x!==x.toLowerCase();
function splitName(u){const w=A.clean(u).split(' ');let i=0;while(i<w.length-1&&up(w[i]))i++;if(i===0)i=1;return[w.slice(0,i).join(' '),w.slice(i).join(' ')]}
const yes=v=>{const s=A.norm(v);return s!==''&&!['non','0','false','no','n'].includes(s)};
const oui=v=>/^(oui|1|x|true|yes|o)$/i.test(A.clean(v));
function actsMap(s){const out=[];A.actsFromString(String(s||'').replace(/,/g,';')).forEach(a=>{const n=A.norm(a);const hit=A.ACT_AS.find(x=>A.norm(x)===n||(n.length>3&&(A.norm(x).includes(n)||n.includes(A.norm(x)))));if(hit&&!out.includes(hit))out.push(hit)});return out}
function parse(text){
 const rows=parseCSV(text);if(rows.length<2)throw new Error('Fichier vide.');
 const h=rows[0].map(x=>x.trim()),n=h.map(A.norm),col=(...ks)=>{for(const k of ks){const i=n.findIndex(x=>x===A.norm(k));if(i>=0)return i}return -1};
 const ent=n.includes('utilisateur'),pro=n[0]==='nomprenom'||n.includes('inscritasetlicencieunss');
 if(!ent&&!pro)throw new Error('Format non reconnu (ni export ENT « Utilisateur », ni sauvegarde Gestion AS Pronote).');
 const pres=[];h.forEach((x,i)=>{const m=x.match(/^Présence (\d{4}-\d{2}-\d{2})(?: \| (.+))?$/);if(m)pres.push([i,m[1],m[2]||''])});
 const g=(r,i)=>i>=0?A.clean(r[i]):'';
 const ic={cl:col('classe','classepronote'),nais:col('date de naissance','datedenaissance'),sexe:col('sexe'),tel:col('numero telephone responsable','telephone'),acts:col('activites pratiquees','activites'),
  comp:col('competitions unss'),club:col('pratique sportive en club'),handi:col('je suis pratiquant handisport / sport partage','sport partage / handisport','sport partage'),autor:col('autorisation parentale'),
  lic:col('n licence unss','n° licence unss'),insc:col('inscrit as et licencie unss'),user:col('utilisateur'),date:col('date de reponse')};
 const out=[];
 for(const r of rows.slice(1)){
  let nom,pre;if(ent&&ic.user>=0)[nom,pre]=splitName(g(r,ic.user));else[nom,pre]=splitName(g(r,0));
  if(!nom)continue;
  const sx=g(r,ic.sexe).toUpperCase(),acts=actsMap(g(r,ic.acts));
  const pr=[];pres.forEach(([i,d,a])=>{if(yes(r[i]))pr.push({Date:d,Activite:a})});
  const hasData=ent||acts.length||pr.length||yes(g(r,ic.insc))||g(r,ic.lic);
  if(!hasData)continue;
  const rec={};
  if(ic.date>=0&&A.isoDate(g(r,ic.date)))rec.Date_signature=A.isoDate(g(r,ic.date));
  if(ic.nais>=0&&A.isoDate(g(r,ic.nais)))rec.Naissance=A.isoDate(g(r,ic.nais));
  if(sx.startsWith('F')||sx.startsWith('M'))rec.Sexe=sx.startsWith('F')?'Fille':'Garçon';
  if(ic.tel>=0&&g(r,ic.tel))rec.Telephone_responsable=g(r,ic.tel).replace(/[^\d+]/g,'');
  if(acts.length)rec.Activites=A.sortActs(acts).join(' ; ');
  if(ic.comp>=0)rec.Competitions_UNSS=oui(g(r,ic.comp))?'Oui':'Non';
  if(ic.handi>=0)rec.Sport_partage=oui(g(r,ic.handi))?'Oui':'Non';
  if(ic.club>=0&&g(r,ic.club))rec.Club=g(r,ic.club);
  if(ic.autor>=0)rec.Autorisation_parentale=oui(g(r,ic.autor))?'Oui':'Non';
  if(ic.lic>=0&&g(r,ic.lic))rec.Licence=g(r,ic.lic);
  out.push({nom,prenom:pre,classe:g(r,ic.cl),naissance:A.isoDate(g(r,ic.nais)),record:rec,presences:pr,
   inscrit:ent?true:(ic.insc>=0?yes(g(r,ic.insc)):true)});
 }
 return{type:ent?'ENT':'Pronote',eleves:out};
}
const API={parse,parseCSV,splitName};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.LEGACY=API;
})(typeof window!=='undefined'?window:globalThis);

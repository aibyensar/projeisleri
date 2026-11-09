// Kod.gs denemesi (Google nesneleri sahte): node evrak/apps-script/test/dene.js evrak/apps-script/Kod.gs
// Bütün tetikleyici işlevleri tanımlı mı, e-posta gidiyor mu, telefon durumu doğru mu.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const mkFile=(n,c)=>({getName:()=>n,getBlob:()=>({getDataAsString:()=>c}),setTrashed(v){this.tr=v},getDateCreated:()=>new Date()});
const bild=[mkFile('20261109-001.json',JSON.stringify({konu:'AGY Evrak — X · 1 evrak · HAZIR',metin:'1 evrak geldi'}))];
const mk=(n,subs=[],files=[])=>({getName:()=>n,getFolders(){let i=0;return{hasNext:()=>i<subs.length,next:()=>subs[i++]}},getFoldersByName(a){const f=subs.find(x=>x.getName()===a);return{hasNext:()=>!!f,next:()=>f}},createFolder(a){const f=mk(a);subs.push(f);return f},getOwner:()=>({getEmail:()=>'sahip@gmail.com'}),getFiles(){let i=0;return{hasNext:()=>i<files.length,next:()=>files[i++]}},getFilesByName(a){const l=files.filter(x=>x.getName()===a&&!x.tr);let i=0;return{hasNext:()=>i<l.length,next:()=>l[i++]}},createFile(a,c){const f=mkFile(a,c);files.push(f);return f},getDateCreated:()=>new Date(Date.now()-2*3600000)});
const root=mk('root',[mk('AGY Evrak',[mk('0-Gelen'),mk('Çizilecek Projeler',[mk('1 HAZIR · 2026-11-07 · AHMET USTA – Yılmaz Apt · İç Tesisat')]),mk('7-Bildirim',[],bild)])]);
const sent=[],trig=[];
Object.assign(global,{DriveApp:{getRootFolder:()=>root},Session:{getEffectiveUser:()=>({getEmail:()=>''})},
Utilities:{formatDate:(d,tz,f)=>f==='H'?'8':f==='yyyy-MM-dd'?'2026-11-09':'09.11.2026'},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
MailApp:{sendEmail:o=>sent.push(o.subject)},ScriptApp:{getService:()=>({getUrl:()=>'https://script.google.com/x/exec'}),getProjectTriggers:()=>[],deleteTrigger(){},newTrigger:f=>{const b={timeBased:()=>b,everyMinutes:()=>b,everyHours:()=>b,create:()=>trig.push(f)};return b}},
ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:1}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
eval(src+';Object.assign(global,{kurulum,saatlik,doGet,bildirimGonder,bilgiKaydet,formsuzPaketler})');
console.log(kurulum()); console.log('tetikleyiciler:',trig,'gönderilen:',sent,'silindi:',!!bild[0].tr);
console.log(doGet({parameter:{durum:'1',anahtar:'BURAYA-KENDİ-GİZLİ-ANAHTARINIZ'}}).s);
console.log(doGet({parameter:{}}).s);
// 0-Gelen'e iki paket koy: biri formlu (hemen e-posta), biri formsuz (saatlik hatırlatma)
const ag=root.getFoldersByName('AGY Evrak').next(); const g0=ag.getFoldersByName('0-Gelen').next();
const pk1=g0.createFolder('20261109-100000'); pk1.createFile('01_a.jpg','x'); pk1.createFile('02_b.pdf','x');
const pk2=g0.createFolder('20261109-110000'); pk2.createFile('01_c.jpg','x');
sent.length=0;
console.log(bilgiKaydet('20261109-100000',{elektrikci:'ahmet usta',proje:'Yılmaz Apt',tur:'İç Tesisat',acil:true,tamam:false}));
const pj=JSON.parse(pk1.getFilesByName('paket.json').next().getBlob().getDataAsString());
formsuzPaketler();
console.log('gönderilen:',sent,'epostaGitti:',pj.epostaGitti);
if(sent.length!==2||!pj.epostaGitti||!/AHMET USTA – Yılmaz Apt · 2 evrak · EVRAK EKSİK · ACİL/.test(sent[0])||!/1 evrak geldi, bilgisi girilmedi/.test(sent[1])){console.error('HATA');process.exit(1)}
console.log('TAMAM');

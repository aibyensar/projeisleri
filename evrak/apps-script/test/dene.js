// Kod.gs denemesi (Google nesneleri sahte): node evrak/apps-script/test/dene.js evrak/apps-script/Kod.gs
// Bütün tetikleyici işlevleri tanımlı mı, e-posta gidiyor mu, telefon durumu doğru mu.
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const mkFile=(n,c)=>({getName:()=>n,getBlob:()=>({getDataAsString:()=>c}),setTrashed(v){this.tr=v},getDateCreated:()=>new Date()});
const bild=[mkFile('20261109-001.json',JSON.stringify({konu:'AGY Evrak — X · 1 evrak · HAZIR',metin:'1 evrak geldi'}))];
const mk=(n,subs=[],files=[])=>({getName:()=>n,getFolders(){let i=0;return{hasNext:()=>i<subs.length,next:()=>subs[i++]}},getFoldersByName(a){const f=subs.find(x=>x.getName()===a);return{hasNext:()=>!!f,next:()=>f}},createFolder(a){const f=mk(a);subs.push(f);return f},getOwner:()=>({getEmail:()=>'sahip@gmail.com'}),getFiles(){let i=0;return{hasNext:()=>i<files.length,next:()=>files[i++]}}});
const root=mk('root',[mk('AGY Evrak',[mk('Çizilecek Projeler',[mk('1 HAZIR · 2026-11-07 · AHMET USTA – Yılmaz Apt · İç Tesisat')]),mk('7-Bildirim',[],bild)])]);
const sent=[],trig=[];
Object.assign(global,{DriveApp:{getRootFolder:()=>root},Session:{getEffectiveUser:()=>({getEmail:()=>''})},
Utilities:{formatDate:(d,tz,f)=>f==='H'?'8':f==='yyyy-MM-dd'?'2026-11-09':'09.11.2026'},PropertiesService:{getScriptProperties:()=>({getProperty:()=>null,setProperty(){}})},
MailApp:{sendEmail:o=>sent.push(o.subject)},ScriptApp:{getProjectTriggers:()=>[],deleteTrigger(){},newTrigger:f=>{const b={timeBased:()=>b,everyMinutes:()=>b,everyHours:()=>b,create:()=>trig.push(f)};return b}},
ContentService:{createTextOutput:s=>({s,setMimeType(){return this}}),MimeType:{JSON:1}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})}});
eval(src+';Object.assign(global,{kurulum,saatlik,doGet,bildirimGonder})');
console.log(kurulum()); console.log('tetikleyiciler:',trig,'gönderilen:',sent,'silindi:',!!bild[0].tr);
console.log(doGet({parameter:{durum:'1',anahtar:'BURAYA-KENDİ-GİZLİ-ANAHTARINIZ'}}).s);
console.log(doGet({parameter:{}}).s);

// GERILIMDUSUMU komutunu örnek cevaplarla çalıştırır, çıkan yazıları ve hataları gösterir.
// Çalıştırma: node autocad/test/calistir.js
const fs = require('fs');
const path = require('path');
const L = require('./autolisp.js');

L.yukle(fs.readFileSync(path.join(__dirname, '..', 'GERILIMDUSUMU.lsp'), 'utf8'));

const senaryolar = {
  'Branşman mevcut (proje örneği 1)': [
    'Evet', '32200', '(16220*0,45)+5000',
    'NYY', '4x6', 'Havai', '15', '',          // branşman: tip, kesit, döşeme, uzunluk, faz (Enter)
    '2',                                     // iç hat sayısı
    'Trifaze', 'NYM', '5x6', '9', '5000', '',
    'Monofaze', 'NYA', '2.5', '4', '2500', 'TN3 Panosu ... NOLU Nolu Linye İçin',
    '2.5', '0,0'
  ],
  'Monofaze branşman 2x6': [
    'Evet', '', '8000', 'NYY', '2x6', '', '15', '', '2',
    '', '', '', '', '', '', '', '', '', '', '', '', '', '0,0'
  ],
  'Branşman yok (proje örneği 2)': [
    'Hayir', '36140', '13136+4380', '',      // kurulu, talep, bağlantı faz (Enter)
    '2',
    'Trifaze', 'NYM', '4x10', '4', '13136', '',
    'Monofaze', 'NYA', '2.5', '6', '2500', '.',
    '', '0,0'
  ],
};

let hataVar = false;
for (const [ad, girdi] of Object.entries(senaryolar)) {
  const r = L.komut('GERILIMDUSUMU', girdi);
  console.log(`\n===== ${ad}: ${r.tamam ? 'TAMAM' : 'HATA → ' + r.hata}`);
  if (!r.tamam) { hataVar = true; console.log(L.durum.cikti.split('\n').slice(-12).join('\n')); continue; }
  const yazilar = L.durum.nesneler.filter(n => n.tip === 'MTEXT').sort((a, b) => b.y - a.y || a.x - b.x);
  console.log(yazilar.map(n => n.yazi.replace(/\\P/g, ' | ')).join('\n'));
  console.log(`-- ${L.durum.nesneler.length} nesne; komutlar: ${L.durum.komutlar.join(' ; ')}`);
  console.log('-- son mesaj:', L.durum.cikti.trim().split('\n').slice(-2).join(' / '));
}
process.exit(hataVar ? 1 : 0);

// autocad/ICTESISAT.lsp dosyasını üretir: kaynak LISP + veri/katalog.js içindeki kablo değerleri.
// Çalıştırma: node autocad/olustur.js
const fs = require('fs');
const path = require('path');
const KATALOG = require('../veri/katalog.js');
const KABLOLAR = require('../veri/kablolar.js');

const num = v => /^[\d.,]+$/.test(v) ? +v.replace(',', '.') : null;
const etiket = r => r[0].replace(/^\*/, '').replace(/r[em](?=\/)/, '').split(' ')[0];
const lispSayi = v => v == null ? 'nil' : String(v);

const tipler = [...new Set(KATALOG.map(t => t.kablo))];
const kayitlar = tipler.map(tip => {
  const satirlar = KATALOG.filter(t => t.kablo === tip).flatMap(t => t.satirlar.map(r => {
    const et = etiket(r);
    const S = +et.match(/^(?:\d+x)?([\d.]+)/)[1];
    return `("${et}" ${S} (${r.slice(t.akimSutun).map(num).map(lispSayi).join(' ')}))`;
  }));
  const k = KABLOLAR[tip];
  return `  ("${tip}" "${k.iletken}" (${k.sutunlar.map(s => `"${s}"`).join(' ')})\n   (${satirlar.join('\n    ')}))`;
});

const veri = `;;; Kablo verisi: (tip iletken (döşemeler) ((etiket kesit (akımlar)) ...))
;;; Kaynak: Öznur Kablo ürün katalogları (oznurkablo.com.tr), Kasım 2026
(setq *ict-kablolar* '(\n${kayitlar.join('\n')}\n))`;

const kaynak = fs.readFileSync(path.join(__dirname, 'kaynak', 'ictesisat-kaynak.lsp'), 'utf8');
const cikti = kaynak.replace(';;@@VERI@@', veri).replace(/\r?\n/g, '\r\n');
fs.writeFileSync(path.join(__dirname, 'ICTESISAT.lsp'), cikti, 'utf8');

// Parantez dengesi kontrolü (yazıların ve yorumların dışında)
let derinlik = 0, yazida = false, yorumda = false, enDusuk = 0;
for (let i = 0; i < cikti.length; i++) {
  const c = cikti[i];
  if (yorumda) { if (c === '\n') yorumda = false; continue; }
  if (yazida) { if (c === '\\') { i++; continue; } if (c === '"') yazida = false; continue; }
  if (c === ';') yorumda = true;
  else if (c === '"') yazida = true;
  else if (c === '(') derinlik++;
  else if (c === ')') { derinlik--; enDusuk = Math.min(enDusuk, derinlik); }
}
if (derinlik !== 0 || enDusuk < 0) { console.error('Parantez hatası: derinlik', derinlik, 'en düşük', enDusuk); process.exit(1); }
console.log('ICTESISAT.lsp üretildi:', cikti.length, 'karakter,', tipler.length, 'kablo tipi. Parantezler dengeli.');

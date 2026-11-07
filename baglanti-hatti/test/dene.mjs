// Deneme: GDZ görüşü ve iç tesisat PDF'lerini okur, hesabı yapar, şablonu doldurur.
// Kullanım: node dene.mjs <gdz.pdf> <ic-tesisat.pdf> <cikis-klasoru> [cu|al] [en-kucuk-kesit]
// pdf.js gerekir: npm install pdfjs-dist@4.10.38 (yolu PDFJS ortam değişkeniyle de verilebilir)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjs = await import(process.env.PDFJS || 'pdfjs-dist/legacy/build/pdf.mjs');
const BHP = require('../../ortak/bhp.js');

async function sayfalar(dosya) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(dosya)), verbosity: 0 }).promise;
  const out = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pg = await doc.getPage(p), vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    out.push(tc.items.filter(i => i.str.trim()).map(i => {
      const t = pdfjs.Util.transform(vp.transform, i.transform);
      return { s: i.str, x: t[4], y: t[5], egik: Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01 };
    }).filter(o => !o.egik));
  }
  return out;
}
const [gdzP, icP, cikis, iletken = 'al', enKucuk = '16'] = process.argv.slice(2);
const g = BHP.gdzOku(await sayfalar(gdzP));
const gs = await sayfalar(gdzP);
const i = BHP.icTesisatOku((await sayfalar(icP))[0]);
console.log('GDZ', g, '\nuydu sayfası', BHP.uyduSayfasi(gs) + 1);
console.log('İÇ TESİSAT', i);
const b = BHP.birlestir(g, i);
console.log('BİRLEŞİK', b);
const k = BHP.kabloOner(iletken, b.talepW, b.uzunluk, +enKucuk);
console.log('KABLO', k, BHP.hesap(k, b.talepW, b.uzunluk));
const ad = b.basvuruNo || 'bhp';
const d = BHP.degerler(b, k, `${ad}-uydu.jpg`, `${ad}-vaziyet.jpg`);
const sablon = fs.readFileSync(new URL('../BHP-SABLON.dxf', import.meta.url), 'utf8');
fs.mkdirSync(cikis, { recursive: true });
fs.writeFileSync(path.join(cikis, `BHP-${ad}.dxf`), BHP.doldur(sablon, d));
console.log('yazıldı', path.join(cikis, `BHP-${ad}.dxf`));

// Resimden okuma akışını sahte (önceden yazılmış) cevaplarla dener: node resimden-oku-dene.js <geçici klasör> (klasörde nd/node_modules ve ic/ic1.pdf)
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], NM = S + '/nd/node_modules/';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u = r.request().url();
    const yol = u.includes('pdf.worker') ? NM + 'pdfjs-dist/build/pdf.worker.min.mjs' : u.includes('pdf.min') ? NM + 'pdfjs-dist/build/pdf.min.mjs' : NM + 'jszip/dist/jszip.min.js';
    r.fulfill({ path: yol, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }); });
  p.on('pageerror', e => console.log('HATA', e.message));
  await p.addInitScript(() => {
    window.__istek = [];
    const cevap = (istem, o) => {
      window.__istek.push({ ilk: istem.slice(0, 60), resim: o.images.length });
      if (/hangi resimde/.test(istem)) return { antet: { resim: 1, kutu: [0, 0.5, 0.6, 1] }, guc: { resim: 2, kutu: [0.2, 0, 0.8, 0.5] }, pano: { resim: 4, kutu: [0.5, 0.1, 0.9, 0.9] } };
      if (/yakın çekimler/.test(istem)) return { kutular: [[0.1, 0.1, 0.9, 0.9], null, [0.2, 0.2, 0.8, 0.8]] };
      if (/ANTETİ/.test(istem)) return { malSahibi: 'ÖRNEK MAL SAHİBİ', kuruluW: 122640, talepW: 32962, bagimsiz: '6', alan: '450' };
      if (/GÜÇ DAĞILIM \/ DAĞITIM TABLOSU\. Tablonun/.test(istem)) return { satirlar: ['TZA-1', 'TZA-2', 'TZB-1', 'TZB-2', 'TZC-1', 'TZC-2'].map((t, i) => ({ bb: String(i + 1), tablo: t, kurulu: '20440 W', baglanti: '12776 W', sayac: '3*10 A', kullanim: 'MESKEN', tesis: '' })) };
      if (/SAYAÇ PANOSU \/ ANA GİRİŞ \/ KOLON/.test(istem)) return { korumalar: [{ tur: 'tmsyks', deger: '4x100A 300mA' }], sayac: '3x10', reaktif: false, onu: [{ kime: ['hepsi'], deger: '3x32A 6kA' }] };
      return {};
    };
    window.claude = { use: async n => n === 'sample' ? { limits: async () => ({ images: { maxCount: 5 } }), json: async (i, o) => cevap(i, o) } : null };
  });
  await p.goto('http://localhost:8765/araclar/baglanti-hatti.html');
  await p.waitForTimeout(1500);
  await p.setInputFiles('#f-ic', S + '/ic/ic1.pdf');
  await p.waitForFunction(() => /Resimden okundu|bulunamadı|Okunamadı \(|İzin verilmedi/.test(document.getElementById('d-ro-ic').textContent), null, { timeout: 120000 });
  console.log('ro:', await p.textContent('#d-ro-ic'));
  console.log('satir:', await p.textContent('#d-satir'));
  console.log('istekler:', JSON.stringify(await p.evaluate(() => window.__istek)));
  console.log('mal sahibi:', await p.inputValue('#a-malSahibi'), '| k1:', await p.inputValue('#a-k1tur'), await p.inputValue('#a-k1deger'));
  console.log('onu ilk satır:', await p.$eval('#satirlar input[data-k=onu]', e => e.value));
  await b.close();
})();

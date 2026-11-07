// Güç tablosunun tekrar okunmasını ve elle gösterilmesini sahte cevaplarla dener.
// node guc-tekrar-dene.js <geçici klasör> <iç tesisat.pdf>   (klasörde nd/node_modules: pdfjs-dist, jszip; depo kökünde http.server 8765)
// 1) ilk okumada güç tablosu "bulunamadı" → 2) "tekrar oku" (yeri yeniden aranır) → 3) "ben göstereyim" ile sürükleyip okuma
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
    window.__istek = []; window.__yerArama = 0;
    const cevap = (istem, o) => {
      window.__istek.push(istem.slice(0, 50).replace(/\n/g, ' '));
      if (/hangi resimde/.test(istem)) {
        window.__yerArama++;
        if (window.__yerArama === 1) return { antet: { resim: 1, kutu: [0, 0.6, 0.3, 1] }, guc: null, pano: null };   // ilk seferde tablo bulunamaz
        return { guc: { resim: 2, kutu: [0.2, 0.15, 0.98, 0.6] } };
      }
      if (/yakın çekimler/.test(istem)) return { kutular: [[0.1, 0.1, 0.9, 0.9]] };
      if (/ANTETİ/.test(istem)) return { malSahibi: 'ÖRNEK MAL SAHİBİ', kuruluW: 122640, talepW: 32962, bagimsiz: '6', alan: '450' };
      if (/kırmızı numaralar/.test(istem)) { const m = istem.match(/\(1\.\.(\d+)\)/); window.__bant = m && m[1];
        return { kuruluBirim: 'W', bantlar: [{ no: 1, tur: 'baslik' }].concat(['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((t, i) => ({ no: i + 2, tur: 'veri', bb: String(i + 1), tablo: t, kurulu: '20440', baglanti: '12776', sayac: '3x10 A', kullanim: 'MESKEN', tesis: '' }))) }; }
      return {};
    };
    window.claude = { use: async n => n === 'sample' ? { limits: async () => ({ images: { maxCount: 5 } }), json: async (i, o) => cevap(i, o) } : null };
  });
  await p.goto('http://localhost:8765/araclar/baglanti-hatti.html');
  await p.waitForTimeout(1500);
  await p.setInputFiles('#f-ic', process.argv[3]);
  await p.waitForFunction(() => /Resimden okundu|bulunamadı|Okunamadı/.test(document.getElementById('d-ro-ic').textContent), null, { timeout: 60000 });
  console.log('1) ro:', await p.textContent('#d-ro-ic'));
  console.log('   guc kutusu görünür:', await p.isVisible('#gucTekrar'), '|', await p.textContent('#d-guc'));
  console.log('   satir:', await p.textContent('#d-satir'));
  await p.fill('#a-malSahibi', 'ELLE DÜZELTİLMİŞ');                 // tekrar okuma bu bilgiyi bozmamalı
  await p.click('#b-guc-tekrar');
  await p.waitForFunction(() => /okundu:|bulunamadı|okunamadı|Okunamadı|İzin/.test(document.getElementById('d-guc').textContent), null, { timeout: 60000 });
  console.log('2) guc:', await p.textContent('#d-guc'));
  console.log('   satir:', await p.textContent('#d-satir'), '| mal sahibi:', await p.inputValue('#a-malSahibi'));
  console.log('   resim kutusu:', await p.isVisible('#gucResimKutu'), '| bant:', await p.evaluate(() => window.__bant));
  await p.click('#b-guc-goster');
  await p.waitForFunction(() => /sürükleyin/.test(document.getElementById('gucSecDurum').textContent), null, { timeout: 30000 });
  const sur = async (a, c) => { const kutu = await (await p.$('#gucSecKutu')).boundingBox(); await p.mouse.move(kutu.x + kutu.width * a[0], kutu.y + kutu.height * a[1]); await p.mouse.down();
    await p.mouse.move(kutu.x + kutu.width * c[0], kutu.y + kutu.height * c[1], { steps: 8 }); await p.mouse.up(); };
  await sur([0.6, 0.2], [0.98, 0.6]);
  await p.click('#b-guc-yakin');
  await p.waitForFunction(() => /sürükleyin/.test(document.getElementById('gucSecDurum').textContent), null, { timeout: 30000 });
  await sur([0.02, 0.02], [0.98, 0.98]);
  await p.screenshot({ path: S + '/guc-secim.png' });
  await p.evaluate(() => { window.__bant = null; });
  await p.click('#b-guc-oku');
  await p.waitForFunction(() => window.__bant && /okundu:|okunamadı/.test(document.getElementById('d-guc').textContent), null, { timeout: 60000 });
  console.log('3) guc:', await p.textContent('#d-guc'), '| bant:', await p.evaluate(() => window.__bant));
  console.log('   indir:', await p.textContent('#d-indir'));
  console.log('istekler:', JSON.stringify(await p.evaluate(() => window.__istek)));
  await b.close();
})();

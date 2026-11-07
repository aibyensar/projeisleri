// Resimden okuma akışını sahte cevaplarla dener (bant numaralama, 3 okuma, hücre çoğunluğu, onay).
// node resimden-oku-dene.js <geçici klasör> <iç tesisat.pdf> '{"resim":1,"kutu":[x0,y0,x1,y1]}'  (klasörde nd/node_modules; numaralı tablo resmi numarali.jpg'ye yazılır)
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], NM = S + '/nd/node_modules/';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u = r.request().url();
    const yol = u.includes('pdf.worker') ? NM + 'pdfjs-dist/build/pdf.worker.min.mjs' : u.includes('pdf.min') ? NM + 'pdfjs-dist/build/pdf.min.mjs' : NM + 'jszip/dist/jszip.min.js';
    r.fulfill({ path: yol, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }); });
  p.on('pageerror', e => console.log('HATA', e.message));
  await p.addInitScript(g => { window.__GUC = g;
    window.__istek = [];
    const cevap = (istem, o) => {
      window.__istek.push({ ilk: istem.slice(0, 60), resim: o.images.length });
      if (/hangi resimde/.test(istem)) return { antet: { resim: 1, kutu: [0, 0.5, 0.6, 1] }, guc: window.__GUC, pano: { resim: 4, kutu: [0.5, 0.1, 0.9, 0.9] } };
      if (/yakın çekimler/.test(istem)) return { kutular: [[0.1, 0.1, 0.9, 0.9], window.__ince || null, [0.2, 0.2, 0.8, 0.8]] };
      if (/ANTETİ/.test(istem)) return { malSahibi: 'ÖRNEK MAL SAHİBİ', kuruluW: 122640, talepW: 32962, bagimsiz: '6', alan: '450' };
      if (/kırmızı numaralar/.test(istem)) { window.__g = (window.__g || 0) + 1; const m = istem.match(/\(1\.\.(\d+)\)/); window.__bant = m && m[1];
        const deg = window.__g === 2 ? '20400' : '20440';
        return { kuruluBirim: 'W', bantlar: [{ no: 1, tur: 'baslik' }, { no: 2, tur: 'baslik' }].concat(['TZA-1', 'TZA-2', 'TZB-1', 'TZB-2', 'TZC-1', 'TZC-2'].map((t, i) => ({ no: i + 3, tur: 'veri', bb: String(i + 1), tablo: t, kurulu: i === 0 ? deg : '20440', baglanti: '12776', sayac: '3*10 A', kullanim: 'MESKEN', tesis: '' }))) }; }
      if (/SAYAÇ PANOSU \/ ANA GİRİŞ \/ KOLON/.test(istem)) return { korumalar: [{ tur: 'tmsyks', deger: '4x100A 300mA' }], sayac: '3x10', reaktif: false, onu: [{ kime: ['hepsi'], deger: '3x32A 6kA' }] };
      return {};
    };
    window.claude = { use: async n => n === 'sample' ? { limits: async () => ({ images: { maxCount: 5 } }), json: async (i, o) => cevap(i, o) } : null };
  }, JSON.parse(process.argv[4] || 'null'));
  await p.goto('http://localhost:8765/araclar/baglanti-hatti.html');
  await p.waitForTimeout(1500);
  await p.setInputFiles('#f-ic', process.argv[3] || (S + '/ic/ic1.pdf'));
  await p.waitForFunction(() => /Resimden okundu|bulunamadı|Okunamadı \(|İzin verilmedi/.test(document.getElementById('d-ro-ic').textContent), null, { timeout: 120000 });
  console.log('ro:', await p.textContent('#d-ro-ic'));
  console.log('satir:', await p.textContent('#d-satir'));
  console.log('istekler:', JSON.stringify(await p.evaluate(() => window.__istek)));
  console.log('mal sahibi:', await p.inputValue('#a-malSahibi'), '| k1:', await p.inputValue('#a-k1tur'), await p.inputValue('#a-k1deger'));
  console.log('bant sayısı:', await p.evaluate(() => window.__bant), 'okuma sayısı:', await p.evaluate(() => window.__g));
  console.log('kırmızı hücre:', await p.$$eval('#satirlar input', l => l.filter(e => e.style.border).map(e => e.dataset.j + ':' + e.dataset.k)));
  const b64 = await p.evaluate(async () => { const src = document.getElementById('gucResim').src; const bl = await (await fetch(src)).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result.split(',')[1]); f.readAsDataURL(bl); }); });
  require('fs').writeFileSync(S + '/numarali.jpg', Buffer.from(b64, 'base64'));
  console.log('onu ilk satır:', await p.$eval('#satirlar input[data-k=onu]', e => e.value));
  await b.close();
})();

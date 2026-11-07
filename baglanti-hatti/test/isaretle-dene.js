// İç tesisat işaretleme ekranını sahte cevaplarla dener: yaklaş/uzaklaş/kaydır, antet → güç tablosu → kolon şeması çerçeveleme ve okuma,
// "tablo yok, elle gireceğim". node isaretle-dene.js <geçici klasör> <iç tesisat.pdf>
// (klasörde nd/node_modules: pdfjs-dist, jszip; depo kökünde python3 -m http.server 8765). Sahte PDF: test/sahte-ic.py
const { chromium } = require('playwright');
(async () => {
  const S = process.argv[2], NM = S + '/nd/node_modules/';
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route('https://cdnjs.cloudflare.com/**', r => { const u = r.request().url();
    const yol = u.includes('pdf.worker') ? NM + 'pdfjs-dist/build/pdf.worker.min.mjs' : u.includes('pdf.min') ? NM + 'pdfjs-dist/build/pdf.min.mjs' : NM + 'jszip/dist/jszip.min.js';
    r.fulfill({ path: yol, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' } }); });
  p.on('pageerror', e => console.log('HATA', e.message));
  await p.addInitScript(sen => {
    window.__istek = []; window.__senaryo = sen;
    const cevap = (istem, o) => {
      window.__istek.push(istem.slice(0, 40).replace(/\n/g, ' '));
      if (/ANTETİ/.test(istem)) return { malSahibi: 'ÖRNEK MAL SAHİBİ', kuruluW: 122640, talepW: 32962, bagimsiz: '6', alan: '450', yapiSinifi: 'III-B' };
      if (/kırmızı numaralar/.test(istem)) { const m = istem.match(/\(1\.\.(\d+)\)/); window.__bant = m && +m[1];
        return { kuruluBirim: 'W', bantlar: [{ no: 1, tur: 'baslik' }].concat(['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((t, i) => ({ no: i + 2, tur: 'veri', bb: String(i + 1), tablo: t, kurulu: window.__senaryo === 'D' ? '20000' : '20440', baglanti: '12776', sayac: '3x10 A', kullanim: 'MESKEN', tesis: '' }))) }; }
      const sen = window.__senaryo;
      if (/Yalnız SAYAÇLARA bak/.test(istem)) return { sayacSayisi: 6, onuOrtak: '3x25A', sayaclar: [] };
      if (/SAYAÇ PANOSU \/ ANA GİRİŞ \/ KOLON/.test(istem)) return { ana: [{ tur: 'tmsyks', deger: '4x100A 300mA' }], sayac: '3x10', reaktif: false,
        sayaclar: sen === 'B' ? [] : sen === 'A' ? ['TN-1', 'TN-2', 'TN-3', 'TN-4', 'TN-5', 'TN-6', 'UMUMİ'].map((t, i) => ({ no: i + 1, tablo: t, onu: i === 6 ? '3x40A' : '3x32A 6kA' }))
          : ['D1', 'D2', 'D3', 'D4', 'D5', 'D6'].map((t, i) => ({ no: i + 1, tablo: t, onu: '3x32A 6kA' })) };
      return {};
    };
    window.claude = { use: async n => n === 'sample' ? { limits: async () => ({ images: { maxCount: 5 } }), json: async (i, o) => cevap(i, o) } : null };
  }, process.env.SENARYO || '');
  await p.goto('http://localhost:8765/araclar/baglanti-hatti.html');
  await p.waitForTimeout(1500);
  await p.setInputFiles('#f-ic', process.argv[3]);
  await p.waitForSelector('#gPanel:not([hidden])', { timeout: 30000 }); await p.waitForTimeout(800);
  console.log('panel:', await p.textContent('#gTarif'));
  const gen = async () => p.$eval('#gTaban', c => Math.round(parseFloat(c.style.width)));
  const kutu = async () => { await p.$eval('#gKutu', e => e.scrollIntoView({ block: 'center' })); await p.waitForTimeout(300); return (await p.$('#gKutu')).boundingBox(); };
  // sayfa kesrinden ekran noktasına
  const ekran = async (fx, fy) => { const t = await (await p.$('#gTaban')).boundingBox(); return [t.x + t.width * fx, t.y + t.height * fy]; };
  const cer = async (a, c) => { await kutu(); const [x0, y0] = await ekran(...a), [x1, y1] = await ekran(...c);
    await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 10 }); await p.mouse.up(); };
  console.log('sığdırılmış genişlik:', await gen());
  await p.click('#gArti'); await p.click('#gArti'); console.log('+ + sonrası:', await gen());
  const k = await kutu(); await p.mouse.move(k.x + k.width / 2, k.y + k.height / 2); await p.mouse.wheel(0, -400); await p.waitForTimeout(100);
  console.log('tekerlek sonrası:', await gen());
  await p.click('#gMod button[data-v=kaydir]');
  const t0 = await (await p.$('#gTaban')).boundingBox();
  await p.mouse.move(k.x + 200, k.y + 200); await p.mouse.down(); await p.mouse.move(k.x + 100, k.y + 150, { steps: 5 }); await p.mouse.up();
  const t1 = await (await p.$('#gTaban')).boundingBox();
  for (let i = 0; i < 3; i++) await p.click('#gArti');
  console.log('3 kez daha + :', await gen());
  console.log('kaydırma:', Math.round(t1.x - t0.x), Math.round(t1.y - t0.y), '| keskin ayrıntı çizildi:', await p.waitForSelector('#gDetay:not([hidden])', { timeout: 5000 }).then(() => true).catch(() => false));
  await p.click('#gMod button[data-v=sec]'); await p.click('#gSigdir');
  // 1) antet (sahte PDF'te sol alttaki kutu)
  await cer([0.03, 0.72], [0.26, 0.99]);
  await p.click('#gOku');
  await p.waitForFunction(() => /Antet okundu|okunamadı|Okunamadı/.test(document.getElementById('d-g').textContent), null, { timeout: 30000 });
  console.log('1)', await p.textContent('#d-g'), '| mal sahibi:', await p.inputValue('#a-malSahibi'), '| yapı sınıfı:', await p.inputValue('#a-yapiSinifi'));
  console.log('   satırlar (antetten):', await p.textContent('#d-satir'));
  // 2) güç tablosu: yakınlaşıp çerçevele
  await p.click('#gArti');
  await cer([0.61, 0.22], [0.97, 0.58]);
  await p.screenshot({ path: S + '/isaretle.png' });
  await p.click('#gOku');
  await p.waitForFunction(() => /Güç tablosu okundu|okunamadı|Okunamadı/.test(document.getElementById('d-g').textContent), null, { timeout: 30000 });
  console.log('2)', await p.textContent('#d-g'), '| bant:', await p.evaluate(() => window.__bant));
  // 3) kolon şeması
  await p.click('#gSigdir');
  await cer([0.3, 0.1], [0.6, 0.6]);
  await p.click('#gOku');
  await p.waitForFunction(() => /Ana kesici|okunamadı|Okunamadı/.test(document.getElementById('d-g').textContent), null, { timeout: 30000 });
  console.log('3)', await p.textContent('#d-g'));
  console.log('   adımlar:', await p.textContent('#gAdimlar'), '| k1:', await p.inputValue('#a-k1tur'), await p.inputValue('#a-k1deger'), '| onu:', await p.$eval('#onuListe input', e => e.value));
  console.log('   onu sütunu:', JSON.stringify(await p.$$eval('#onuListe input', l => l.map(e => e.value + (e.style.border ? '(K)' : '')))), '| hepsi kutusu:', await p.inputValue('#a-onuHepsi'));
  if (process.env.SENARYO === 'C') { await p.fill('#a-onuHepsi', '3 x 20A 6kA');
    console.log('   elle hepsine:', JSON.stringify(await p.$$eval('#onuListe input', l => l.map(e => e.value + (e.style.border ? '(K)' : ''))))); }
  console.log('   güç tablosu sütunları:', await p.$$eval('#satirlar th', l => l.map(e => e.textContent).filter(Boolean).join(' | ')), '| liste açık:', await p.$eval('#onuDetay', d => !d.hidden && d.open));
  if (process.env.SENARYO === 'A') { await p.fill('#onuListe input[data-j="2"]', '3x25A'); for (const j of [0, 1, 3, 4, 5]) await p.fill(`#onuListe input[data-j="${j}"]`, '3x32A 6kA');
    console.log('   tek tek düzeltildi:', JSON.stringify(await p.$$eval('#onuListe input', l => l.map(e => e.value + (e.style.border ? '(K)' : '')))), '| hepsi kutusu:', await p.inputValue('#a-onuHepsi'), '|', await p.getAttribute('#a-onuHepsi', 'placeholder')); }
  console.log('   onaydan önce indir:', (await p.textContent('#d-indir')).slice(0, 260));
  await p.check('#panoOnay'); await p.check('#gucOnay');
  await p.screenshot({ path: S + '/genel.png', fullPage: true });
  console.log('   indir:', await p.textContent('#d-indir'));
  // 4) güç tablosu yok → elle
  await p.click('#gAdimlar button[data-i="1"]');
  console.log('4) yok düğmesi görünür:', await p.isVisible('#gYok'), '| çerçeve geri geldi:', await p.isVisible('#gCerceve'));
  await p.click('#gYok');
  console.log('  ', await p.textContent('#d-g'));
  console.log('   satırlar:', await p.textContent('#d-satir'), '| onu korundu:', await p.$eval('#onuListe input', e => e.value), '| resim kutusu gizli:', await p.isHidden('#gucResimKutu'), '| adımlar:', await p.textContent('#gAdimlar'));
  console.log('istekler:', JSON.stringify(await p.evaluate(() => window.__istek)));
  await b.close();
})();

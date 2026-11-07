// Tarayıcı denemesi (Playwright). Yollar eski oturuma göre yazılı: U = kullanıcı yüklemeleri, S = geçici klasör (nd/node_modules içinde pdfjs-dist, jszip).
// Önce depo kökünde: python3 -m http.server 8765 ; sonra: node tarayici.js. Faruk ve Ayşe işlerini doldurur, zip indirir.
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const U='/root/.claude/uploads/5db88c76-0a08-5947-9ba7-343c72b2a9e1/', S='/tmp/claude-0/-home-user-projeisleri/5db88c76-0a08-5947-9ba7-343c72b2a9e1/scratchpad';
  const f=n=>U+fs.readdirSync(U).find(x=>x.startsWith(n));
  const b = await chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } });
  async function is(ad, gdz, ic, tkgm, iletken, elle) {
    const p = await b.newPage({ viewport: { width: 420, height: 900 }, acceptDownloads: true });
    const NM=S+'/nd/node_modules/';
    await p.route('https://cdnjs.cloudflare.com/**', r => { const u=r.request().url();
      const yol = u.includes('pdf.worker') ? NM+'pdfjs-dist/build/pdf.worker.min.mjs' : u.includes('pdf.min') ? NM+'pdfjs-dist/build/pdf.min.mjs' : NM+'jszip/dist/jszip.min.js';
      r.fulfill({ path: yol, contentType: 'text/javascript', headers: {'Access-Control-Allow-Origin':'*'} }); });
    p.on('pageerror', e => console.log('HATA', e.message));
    await p.goto('http://localhost:8765/araclar/baglanti-hatti.html');
    await p.setInputFiles('#f-gdz', gdz);
    await p.waitForFunction(() => /^Okun/.test(document.getElementById('d-gdz').textContent), null, {timeout: 60000});
    await p.setInputFiles('#f-ic', ic);
    await p.waitForFunction(() => !/^(Okunuyor|Henüz)/.test(document.getElementById('d-ic').textContent), null, {timeout: 60000});
    await p.setInputFiles('#f-tkgm', tkgm); await p.waitForTimeout(1200);
    await p.click(`#iletken button[data-v=${iletken}]`);
    if (elle) await elle(p);
    const kutu = await p.$('#vazKutu'); const bb = await kutu.boundingBox();
    const tik = (u, v) => kutu.click({ position: { x: bb.width * u, y: bb.height * v } });
    await tik(0.30, 0.72);
    await p.click('#isaretMod button[data-v=ara]'); await tik(0.43, 0.62);
    await p.click('#isaretMod button[data-v=bina]'); await tik(0.62, 0.40);
    console.log(ad, 'isaret', await p.textContent('#d-isaret'));
    await p.waitForTimeout(500);
    console.log(ad, 'onizleme svg', await p.$$eval('#onizleme svg', x => x.length), 'not satiri', (await p.$eval('#notlar', t => t.value)).split('\n').length);
    for (const id of ['d-gdz','d-ic','d-indir','d-satir']) console.log(ad, id, await p.textContent('#'+id));
    console.log(ad, 'KESIT', await p.$eval('#kesit', s => s.options[s.selectedIndex].text));
    await p.screenshot({ path: `${S}/sayfa-${ad}.png`, fullPage: true });
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#indir')]);
    await dl.saveAs(`${S}/${ad}.zip`); console.log(ad, 'zip', dl.suggestedFilename());
  }
  await is('faruk', f('b75aa225'), f('72969736'), S.replace('scratchpad','images')+'/1.jpg', 'al');
  await is('ayse', f('c966c565'), f('22652968'), S.replace('scratchpad','images')+'/3.jpg', 'cu', async p => {
    const yaz = async (id, v) => { await p.fill('#'+id, String(v)); };
    for (const [k,v] of Object.entries({ 'a-kullanim':'KONUT','a-adres':'MURADİYE MAH. 407 SK. YUNUSEMRE/MANİSA','a-kat':'SIĞ+Z+3','a-alan':'922','a-bagimsiz':'14+1','a-talepW':57839,'a-kuruluW':198700,'a-k1deger':'4x125A 300mA',
      'u-adet':14,'u-kurulu':12820,'u-baglanti':6728,'u-okurulu':19220,'u-obaglanti':19220,'u-onu':'4x32A 10kA','u-oonu':'4x40A 10kA' })) await yaz(k, v);
    await p.selectOption('#a-k1tur','tmsyks');
    await p.click('#u-yap');
    await p.dispatchEvent('#a-talepW','input');
  });
  await b.close();
})();

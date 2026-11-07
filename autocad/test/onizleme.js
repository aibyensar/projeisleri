// GERILIMDUSUMU komutunu örnek cevaplarla çalıştırır ve çizileni siyah zeminde PNG olarak kaydeder.
// Çalıştırma: node autocad/test/onizleme.js <çıktı-klasörü>
const fs = require('fs');
const path = require('path');
const L = require('../../ortak/autolisp.js');

const { svg } = require('../../ortak/cizim-svg.js');

async function main() {
  const klasor = process.argv[2] || '.';
  L.yukle(fs.readFileSync(path.join(__dirname, '..', 'GERILIMDUSUMU.lsp'), 'utf8'));
  const senaryolar = {
    mevcut: ['Evet', '32200', '(16220*0,45)+5000', '4x6', 'NYY', 'Havai', '15', '', '2',
      '5000', '5x6', 'NYM', '9', 'Trifaze', '2500', '2.5', 'NYA', '4', 'Monofaze', '2.5', '0,0'],
    yok: ['Hayir', '36140', '13136+4380', '', '2',
      '13136', '4x10', 'NYM', '4', 'Trifaze', '2500', '2.5', 'NYA', '6', 'Monofaze', '2.5', '0,0'],
  };
  const { chromium } = require('playwright');
  const b = await chromium.launch();
  for (const [ad, girdi] of Object.entries(senaryolar)) {
    const r = L.komut('GERILIMDUSUMU', girdi);
    if (!r.tamam) { console.log(ad, 'HATA', r.hata); continue; }
    const s = svg(L.durum.nesneler);
    const kagit = svg(L.durum.nesneler, { kagit: true });
    fs.writeFileSync(path.join(klasor, `onizleme-${ad}.svg`), s);
    const p = await b.newPage({ viewport: { width: 900, height: 1200 } });
    await p.setContent(`<body style="margin:0;background:#000">${s.replace(/width="[\d.]+" height="[\d.]+"/, 'width="900"')}</body>`);
    await p.locator('svg').screenshot({ path: path.join(klasor, `onizleme-${ad}.png`) });
    const p2 = await b.newPage({ viewport: { width: 900, height: 1200 } });
    await p2.setContent(`<body style="margin:0;background:#fff">${kagit.replace(/width="[\d.]+" height="[\d.]+"/, 'width="900"')}</body>`);
    await p2.locator('svg').screenshot({ path: path.join(klasor, `onizleme-${ad}-kagit.png`) });
    console.log(ad, '→', path.join(klasor, `onizleme-${ad}.png`), L.durum.nesneler.length, 'nesne');
  }
  await b.close();
}
main();

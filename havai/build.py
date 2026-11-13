#!/usr/bin/env python3
"""havai/src → araclar/havai-cer.html (tek dosya). Bağlantı hattı aracının Havai bölümü bu sayfayı iframe ile açar."""
from pathlib import Path
R = Path(__file__).parent
core = (R/'src/cer-core.js').read_text('utf-8') + '\n' + (R/'src/kroki-rapor.js').read_text('utf-8')
core = core.replace("if (typeof module !== 'undefined') module.exports", "if (typeof module !== 'undefined' && module.exports) module.exports")
html = (R/'src/app.html').read_text('utf-8').replace('/*__CORE__*/', core).replace('/*__WAND__*/', (R/'src/parsel-bul.js').read_text('utf-8'))
hedef = R.parent/'araclar/havai-cer.html'
hedef.write_text(html, 'utf-8')
print(hedef.name, 'yazıldı,', len(html)//1024, 'KB')

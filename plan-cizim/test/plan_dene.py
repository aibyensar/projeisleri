"""İlk deneme: mimari JSON + plan kutusu → sembol ve linyeli PNG önizleme.
Kullanım: python3 plan-cizim/test/plan_dene.py <mimari.json> <çıktı.png> x0 y0 x1 y1
(mimari.json: baglanti-hatti/araclar/dwg-oku.mjs ile DWG'den üretilir; kullanıcı dosyaları depoya konmaz)"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Arc, Circle, Polygon

import mimari
import oda as O
import semboller as S
import yerlesim

_aile = 'DejaVu Sans'
for f in sorted(Path.home().joinpath('.fonts').glob('arial*.ttf')):
    font_manager.fontManager.addfont(str(f))
    _aile = font_manager.FontProperties(fname=str(f)).get_name()
plt.rcParams['font.family'] = _aile

SEMBOL = {
    'lamba': S.lamba, 'etanj_lamba': S.etanj_lamba, 'aplik': S.aplik, 'etanj_aplik': lambda: S.aplik(True),
    'anahtar': S.anahtar, 'vavien': S.vavien, 'komutator': S.komutator, 'etanj_anahtar': S.etanj_anahtar,
    'priz': S.priz, 'etanj_priz': S.etanj_priz, 'tv': S.tv_prizi, 'tablo': S.daire_tablosu,
}
RENK = {'aydinlatma': '#1f5fbf', 'priz': '#c0392b', 'cihaz': '#8e44ad'}


def sembol_ciz(ax, s, lw=0.9):
    f = SEMBOL.get(s['tur']) or (lambda: S.cihaz_prizi(s['tur'].split('_', 1)[1]))
    a = math.radians(s['aci'])
    ca, sa = math.cos(a), math.sin(a)
    T = lambda x, y: (s['x'] + x * ca - y * sa, s['y'] + x * sa + y * ca)
    for o in sorted(f(), key=lambda o: o[0] != 'daire'):      # önce daireler (beyaz dolgulu), sonra çizgiler
        t = o[0]
        if t == 'cizgi':
            p, q = T(o[1], o[2]), T(o[3], o[4])
            ax.plot([p[0], q[0]], [p[1], q[1]], 'k', lw=lw, solid_capstyle='round', zorder=5)
        elif t == 'daire':
            ax.add_patch(Circle(T(o[1], o[2]), o[3], fill=True, fc='white', ec='k', lw=lw, zorder=4.5))
        elif t == 'yay':
            ax.add_patch(Arc(T(o[1], o[2]), 2 * o[3], 2 * o[3], theta1=o[4] + s['aci'], theta2=o[5] + s['aci'], lw=lw, zorder=5))
        elif t == 'dolu':
            ax.add_patch(Polygon([T(x, y) for x, y in o[1]], closed=True, color='k', lw=0, zorder=5))
        elif t == 'yazi':
            p = T(o[1], o[2])
            ax.text(p[0], p[1], o[4], fontsize=4.5, zorder=6)


def main():
    yol, cikti = sys.argv[1], sys.argv[2]
    kutu = tuple(map(float, sys.argv[3:7]))
    plan = mimari.Plan(yol, kutu)
    iz, duvar, et, odalar, kapilar = O.bul(plan, kutu)
    Y = yerlesim.yerlestir(iz, odalar, kapilar, plan)

    x0, y0, x1, y1 = kutu
    fig, ax = plt.subplots(figsize=(16, 16 * (y1 - y0) / (x1 - x0)))
    for a, b, c, d, k in plan.cizgiler:
        if 'TEFR' in k.upper() or 'YAZI' in k.upper() or 'AKS' in k.upper():
            renk, lw = '0.78', 0.35
        else:
            renk, lw = '0.45', 0.5
        ax.plot([a, c], [b, d], color=renk, lw=lw, zorder=1)
    for o in odalar:
        if o.maske is not None:
            ax.text(o.x, o.y + 25, o.ad, fontsize=6, color='0.4', ha='center', zorder=2)

    # linyeler
    for l in Y.linyeler:
        r = RENK[l['sinif']]
        for i, s in enumerate(l['sira']):
            b = s.get('onceki') or l['tablo']
            ax.plot([b['x'], s['x']], [b['y'], s['y']], color=r, lw=0.8, zorder=3)
            if i == 0:
                mx, my = (b['x'] + s['x']) / 2, (b['y'] + s['y']) / 2
                ax.text(mx, my, l['ad'], fontsize=6, color=r, weight='bold', zorder=7,
                        bbox=dict(fc='white', ec='none', pad=0.3))
    for s in Y.semboller:                               # anahtar → lamba sortisi
        if s['tur'] in ('anahtar', 'vavien', 'etanj_anahtar'):
            for l in s.get('bagli') or []:
                ax.plot([s['x'], l['x']], [s['y'], l['y']], color=RENK['aydinlatma'], lw=0.5, ls=(0, (3, 2)), zorder=3)
    for s in Y.semboller:
        sembol_ciz(ax, s)

    ax.set_xlim(x0, x1); ax.set_ylim(y0, y1); ax.set_aspect('equal'); ax.axis('off')
    plt.savefig(cikti, dpi=130, bbox_inches='tight', facecolor='white')

    for o in odalar:
        print(f'{o.no:>2} {o.ad:<10} {o.tur:<8} daire {o.daire}  {o.alan:.1f}/{o.alan_yazi} m²  {o.supheli}')
    for l in Y.linyeler:
        print(f"daire {l['daire']} {l['ad']:<4} {l['sinif']:<10} {len(l['sira'])} sorti  {l['guc']:>5} W  {l['sigorta']}")
    for u in Y.uyarilar:
        print('UYARI', u)


if __name__ == '__main__':
    main()

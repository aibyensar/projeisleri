"""Sembol listesini PNG olarak çizer: python3 plan-cizim/test/sembol_sayfasi.py çıktı.png"""
import sys, math
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
from matplotlib.patches import Arc, Circle, Polygon
import semboller as S

_aile = 'DejaVu Sans'
for f in sorted(Path.home().joinpath('.fonts').glob('arial*.ttf')):
    font_manager.fontManager.addfont(str(f))
    _aile = font_manager.FontProperties(fname=str(f)).get_name()
plt.rcParams['font.family'] = _aile
LW = 1.1


def ciz(ax, liste, ox, oy, k=1.0):
    for o in liste:
        t = o[0]
        if t == 'cizgi':
            ax.plot([ox + k * o[1], ox + k * o[3]], [oy + k * o[2], oy + k * o[4]], 'k', lw=LW, solid_capstyle='round')
        elif t == 'daire':
            ax.add_patch(Circle((ox + k * o[1], oy + k * o[2]), k * o[3], fill=False, lw=LW))
        elif t == 'yay':
            ax.add_patch(Arc((ox + k * o[1], oy + k * o[2]), 2 * k * o[3], 2 * k * o[3], theta1=o[4], theta2=o[5], lw=LW))
        elif t == 'dolu':
            ax.add_patch(Polygon([(ox + k * x, oy + k * y) for x, y in o[1]], closed=True, color='k', lw=0))
        elif t == 'yazi':
            ax.text(ox + k * o[1], oy + k * o[2], o[4], fontsize=o[3] * 1.15, va='bottom', ha='left')


satir = sum(len(l) + 1 for _, l in S.LISTE)
H = 40
fig, ax = plt.subplots(figsize=(8.27, satir * 0.42 + 1.2))
y = 0
ax.text(0, 30, 'İÇ TESİSAT SEMBOL LİSTESİ (taslak 1)', fontsize=13, weight='bold')
ax.text(0, 14, 'TS EN 60617 / IEC 60617 esas alınmıştır · plan ölçeği 1/50', fontsize=8, color='0.35')
for grup, liste in S.LISTE:
    y -= H
    ax.text(0, y + 6, grup.upper(), fontsize=10, weight='bold', color='#16325c')
    ax.plot([0, 330], [y + 2, y + 2], color='#16325c', lw=0.8)
    for ad, f in liste:
        y -= H
        duvar = grup in ('Anahtar', 'Priz') or ad.startswith(('Aplik', 'Etanj aplik', 'Diafon'))
        if duvar:
            ax.plot([20, 70], [y - 12, y - 12], color='0.55', lw=2.2)   # duvar yüzü
            ciz(ax, f(), 45, y - 12, 1.6)
        else:
            ciz(ax, f(), 45, y, 1.6)
        ax.text(110, y, ad, fontsize=10, va='center')
ax.set_xlim(-5, 335); ax.set_ylim(y - 25, 45); ax.set_aspect('equal'); ax.axis('off')
plt.savefig(sys.argv[1], dpi=150, bbox_inches='tight', facecolor='white')

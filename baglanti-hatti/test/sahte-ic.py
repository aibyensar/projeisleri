# Deneme için sahte iç tesisat sayfası (yazısız, geniş): sağda 8 bantlı tablo, solda antet kutusu. python3 sahte-ic.py cikis.pdf
import sys, pymupdf
d = pymupdf.open(); p = d.new_page(width=2400, height=800)
x0, x1, y = 1500, 2300, 200
for i in range(9): p.draw_line((x0, y + i * 30), (x1, y + i * 30), width=1.5)
for x in range(x0, x1 + 1, 100): p.draw_line((x, y), (x, y + 240), width=1.5)
p.draw_rect(pymupdf.Rect(100, 600, 600, 780), width=1.5)
p.draw_rect(pymupdf.Rect(800, 100, 1400, 450), width=1.5)
d.save(sys.argv[1])

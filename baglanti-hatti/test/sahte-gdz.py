# Deneme için sahte GDZ bağlantı görüşü (yazılı PDF; kişisel bilgi yok). python3 sahte-gdz.py cikis.pdf [havai]
import sys, pymupdf
d = pymupdf.open(); p = d.new_page(width=595, height=842)
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
p.insert_font(fontname='dv', fontfile=F)
def yaz(x, y, t): p.insert_text((x, y), t, fontsize=9, fontname='dv')
y = 80
for et, de in [('Başvuru Numarası', 'ORNEK123'), ('Başvuru Sahibi', 'ÖRNEK MAL SAHİBİ'), ('Güç İstenen Yerin Adresi', 'ÖRNEK SK. NO:1/ÖRNEK MAH./YUNUSEMRE/MANİSA'),
               ('Güç İstenen Yeri Ada / Parsel', '123 / 4'), ('Kullanım Amacı', 'MESKEN'), ('Kurulu Güç (kW)', '122,64'), ('Talep Edilen Güç (kW)', '40'),
               ('Bağımsız Bölüm Sayısı', '6'), ('Kazı İzni Durumu', 'Var'), ('Bağlantı Şekli', 'Box Çıkışı')]:
    yaz(50, y, et); yaz(260, y, de); y += 18
yaz(50, y + 10, 'Enerji Alınacak Şebeke Noktası'); yaz(50, y + 26, 'ÖRNEK TR-1 BOX-12')
y += 60
for x, t in [(50, 'AG'), (90, 'BİNA'), (160, 'Havai' if len(sys.argv) > 2 else 'Yer altı'), (230, '40'), (290, '25'), (350, '5'), (410, '30')]: yaz(x, y, t)
# 2. sayfa: yazısız kroki (gerçek GDZ'de uydu görüntüsü) — basit şekiller
k = d.new_page(width=842, height=595)
k.draw_rect(pymupdf.Rect(40, 40, 802, 555), color=(0.3, 0.3, 0.3), fill=(0.55, 0.62, 0.5))
for i in range(6): k.draw_rect(pymupdf.Rect(90 + i * 115, 120, 170 + i * 115, 230), color=(0.9, 0.9, 0.9), fill=(0.75, 0.7, 0.65))
k.draw_line((40, 300), (802, 300), color=(0.95, 0.95, 0.95), width=18)
k.draw_line((380, 300), (380, 230), color=(1, 0, 0), width=3)
k.draw_circle((380, 300), 7, color=(1, 0, 0), fill=(1, 0, 0))
d.save(sys.argv[1])

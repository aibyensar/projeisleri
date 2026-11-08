"""Program simgesini (simge.ico) üretir; derleme sırasında çalışır."""
from PIL import Image, ImageDraw
r = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(r)
d.rounded_rectangle((8, 8, 248, 248), 56, fill=(21, 40, 75))
for y0, x1 in ((64, 184), (116, 160), (168, 184)):
    d.rectangle((72, y0, x1, y0 + 24), fill='white')
d.rectangle((72, 64, 96, 192), fill='white')
r.save('simge.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])

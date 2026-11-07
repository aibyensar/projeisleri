# AutoCAD komutu: GERILIMDUSUMU

İç tesisat akım kontrolü ve gerilim düşümü hesabını AutoCAD içinde yapar.
Soruları sırayla sorar, en sonda seçtiğiniz noktaya yazıları ve tek hat şemasını çizer.

Dosya: `GERILIMDUSUMU.lsp` (AutoCAD 2021 ve sonrası, tam sürüm)

## Kurulum (bir kere)

1. `GERILIMDUSUMU.lsp` dosyasını bilgisayarınızda sabit bir klasöre koyun.
   Örnek: `C:\ProjeIsleri\GERILIMDUSUMU.lsp`
2. AutoCAD'de komut satırına **`APPLOAD`** yazıp Enter'a basın.
3. Açılan pencerede alttaki **"Başlangıç Paketi" (Startup Suite)** bölümünde **"İçindekiler..." (Contents...)** düğmesine basın.
4. **"Ekle..." (Add...)** ile `GERILIMDUSUMU.lsp` dosyasını seçin, **Kapat**'a basın.
5. Üstteki listeden de aynı dosyayı seçip **"Yükle" (Load)** deyin, sonra **Kapat**.

Artık AutoCAD her açıldığında komut kendiliğinden yüklenir.

Güvenlik uyarısı çıkarsa **"Her zaman yükle" (Always Load)** seçin.

## Kullanım

Komut satırına **`GERILIMDUSUMU`** yazın. Sırayla şunlar sorulur. Köşeli parantezdeki `<...>` değer bir önceki cevabınızdır, Enter'a basarsanız o kullanılır.

1. Branşman mevcut mu? `Evet / Hayir`
2. Kurulu güç (W). Yazılmayacaksa `.` girin.
3. Talep güç (W). Sayı veya işlem yazabilirsiniz, örnek `(16220*0,45)+5000`.
4. Branşman mevcutsa: kablo tipi, kesit (örnek `4x6`), döşeme (`Yeralti / Havai`), uzunluk, faz.
   Faz kablodan tahmin edilir (2x, 3x → monofaze; 4x, 5x, 3x25/16 → trifaze), Enter ile kabul edin.
   Branşman yoksa bağlantının fazı sorulur.
5. İç hat sayısı (genelde 2: kolon hattı + linye hattı)
6. Her hat için: faz, kablo tipi, kesit, uzunluk, güç, açıklama

Hesapta %e1 branşman hattı, %e2 kolon hattı, %e3 linye hattıdır.
7. Yazı yüksekliği
8. Çizimde hesabın yerleşeceği nokta (sol üst köşe)

Hepsi tek seferde çizilir. Beğenmezseniz `U` (geri al) bir kerede hepsini siler.

## Ayarlar

**`GDAYAR`** komutuyla gerilim (380/220), k (56/35), cos φ (0,8) ve toplam düşüm sınırı (%1,5) değiştirilir.
Ayarlar bilgisayarda saklanır.

## Sorun çıkarsa

- Komut bir hatayla durursa komut satırında **`HATA (adım): ...`** yazar. **F2** ile komut geçmişini açıp bu satırı iletin.

- **Türkçe harfler bozuk çıkıyorsa:** komut satırına `LISPSYS` yazın, değeri `1` yapın ve AutoCAD'i yeniden açın.
- **√ veya ² işareti görünmüyorsa:** komut yazıları `ICT_ARIAL` yazı stiliyle (Arial) yazar. Çizimde bu stil başka bir fonta ayarlıysa Arial'e çevirin.

## Geliştirme

`node autocad/olustur.js` dosyayı yeniden üretir, `node autocad/test/calistir.js` komutu örnek cevaplarla AutoCAD olmadan dener.

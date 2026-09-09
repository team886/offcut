# Ekran görüntüsü listesi — 1280×800, 5 adet

**Hepsi demo bir konuşmadan üretilir.** Gerçek sohbet kullanılmaz: mağaza sayfası kalıcı, halka açık ve indekslenir; oraya konan özel veri geri alınamaz.

| # | Ne gösterir | Sağlayıcı | Neden bu |
|---|---|---|---|
| 1 | Sohbette gezici kod düğmesi, üreteceği dosya adıyla (`↓ backfill.py`) | Claude | Ürünün en sık kullanılan hâli. İlk görsel işi anlatmalı, özellik saymamalı |
| 2 | Sürüm menüsü, satır farklarıyla (`v3 +12 −3` · `v2 +180 −164`) | Claude | Başka üründe olmayan yetenek; "önceki sürüme dönebiliyorum" mesajı tek bakışta geçiyor |
| 3 | Popup öğe listesi — belgeler, kod, **araç çıktıları**, kaynaklar, ekler | ChatGPT | Listeleme çoklu sağlayıcı iddiasında; ikinci sağlayıcı görselle desteklenmeli. Araç çıktısı grubu farkı gösteren şey |
| 4 | Klasöre kaydetme + sürükle-bırak (dosya editöre düşerken) | — | "İndirilenler klasöründen geçmiyor" mesajı |
| 5 | Ayarlar: site listesi (adaptör/taban rozetleri), geçmiş kapalı, gizlilik satırı | — | Kurulumdaki izin uyarısının yarattığı endişeyi görselle karşılar |

## Kurallar

- **Gerçek araç/müşteri adı yok.** 3 numaralı görselde jenerik örnek kullanılır (`fetch_listings`, `search_events`) — bir araç adı tek başına iş bilgisi sızdırır.
- **Sağlayıcı logosu kullanılmaz.** Arayüz ekran görüntüsünde kaçınılmaz olarak görünen kısım dışında, hiçbir görselde sağlayıcı markası öğe olarak yer almaz (marka ihlali).
- **Tek dilde metin.** Görsellerdeki arayüz dili listelemenin diliyle aynı olmalı; TR listeleme için TR arayüz.

## Küçük promo (440×280)

Ink (#262624) zemin, ortada logo (16px'te seçilen kuş işareti, burada 128px formunda), altında kısa açıklamanın ilk yarısı. Sağlayıcı logosu yok.

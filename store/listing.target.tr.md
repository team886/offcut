# Mağaza listelemesi — TR

> **This is the TARGET listing, not the one to submit.** It describes the product at roughly v2.1 (`docs/ROADMAP.md`). The listing that ships with a release lives in `listing.en.md` / `listing.tr.md` and must describe only what that version does — the Chrome Web Store requires the description to match the functionality, and a user who installs on the strength of a feature that does not exist has been misled whether or not the store notices.

## Ad (mağaza ad alanı)
Offcut — AI Chat Downloader

## Kısa açıklama (132 karakter sınırı)
Sohbetlerinden çıkan kodu, belgeleri ve dosyaları çıkar, sürümle, taşı ve yeniden kullan.

*(89 karakter)*

## Uzun açıklama

**Neden bu izinleri istiyor?** Offcut, açtığın AI sohbetinin içeriğini okur — indirilecek şeyi bulmanın başka yolu yok. Okuduğu her şey senin tarayıcında kalır. Hiçbir sunucuya istek gitmez, hiçbir veri toplanmaz, analitik yoktur. Kurulumda gördüğün "verilerinizi okuyabilir ve değiştirebilir" uyarısı bu yüzden çıkar ve kapsamı yalnızca listelenen sohbet siteleridir.

**Ne yapar?**

Bir AI sohbetinde üretilen şeyler sohbetin içinde kalır. Kod bloğunu kopyalarsın, editöre yapıştırırsın, uzantıyı tahmin edersin. Bir belgenin önceki sürümüne dönmek istersen yolu yoktur. Bir aracın ürettiği 200 satırlık sonucu ararsan arayüz sana ilk onunu gösterir.

Offcut bunları dosyaya çevirir:

- **Kod blokları** — doğru uzantıyla, koddan türetilmiş anlamlı adla (`backfill.py`, `use-cart.ts`)
- **Belgeler ve canvas'lar** — her sürümü ayrı ayrı, aralarındaki farkı satır sayısıyla görerek
- **Araç / MCP çıktıları** — arayüzün kırptığı değil, tamamı; çağrı parametreleriyle birlikte
- **Kaynaklar** — arama yapan sohbetlerde kaynak listesi ayrı bir dosya olarak
- **Üretilen görseller** — anlamlı adla, tek tek ya da toplu
- **Yüklediğin ve üretilen dosyalar** — geri indir
- **Sohbetin tamamı** — Markdown olarak; istersen başka bir sağlayıcıda kaldığın yerden devam et

Dosyayı editörüne **sürükleyip bırakabilir**, sabit bir klasöre kaydedebilir, seçtiklerini tek zip olarak alabilirsin. İndirme geçmişini açarsan bir ay sonra "bunu almış mıydım, o zamandan beri değişti mi" sorusunun cevabını verir.

**Nerede çalışır?** Claude, ChatGPT, Gemini, Perplexity ve listeye eklenen diğer sohbet arayüzleri. Kendi kurduğun bir arayüz varsa (Open WebUI, LibreChat) tek tıkla ona da izin verebilirsin.

**Gizlilik.** Dış istek yok. Telemetri yok. Hesap yok. Ayarların dışında hiçbir şey saklanmaz — indirme geçmişini kendin açmadıkça o da yazılmaz.

---

Anthropic, OpenAI, Google ve Perplexity ile bağlantısı yoktur; adları yalnızca desteklenen hizmetleri belirtmek için kullanılır.

Sorun bildirimi: team@katatechnology.co

# Mağaza metni — TR — **v1.0**

> Yalnızca v1.0'ı anlatır. Her sürüm bu dosyayı günceller; ürünün varacağı hâl `listing.target.tr.md` içinde. §19.5 ön-yayın kontrolü: açıklama, gönderilen sürümün gerçekte yaptığıyla örtüşmek zorunda.

## Ad (mağaza ad alanı)
Magpie — AI Chat Downloader

## Kısa açıklama (132 karakter sınırı)
Yapay zekâ sohbetlerindeki kod bloklarını doğru uzantı ve anlamlı bir adla gerçek dosyaya çevirir.

*(97 karakter)*

## Uzun açıklama

**Ne yapar**

Sohbetteki bir kod bloğu, sayfadaki metinden ibarettir. Kullanmak için seçersiniz, kopyalarsınız, yeni dosya açarsınız, uzantıyı tahmin eder, bir ad uydurursunuz. Magpie onu dosya yapar.

- **Doğru uzantı**, bloğun dilinden — `.py`, `.ts`, `.sql`, `.sh` ve diğerleri.
- **Kodun kendisinden türetilen ad.** Fence içinde dosya adı varsa o kazanır; yoksa koddaki ilk gerçek tanım (`parseInvoice` → `parse-invoice.ts`), yoksa bloğun üstündeki başlık, yoksa numaralı yedek. Bilemediği yerde bunu söyler: kasıtlı görünen bir şey uydurmak yerine düpedüz `code-4.js` yazar.
- **İndirmeden önce adı düzeltin.** Ad bir sezgisel zincirden geliyor ve sezgisel olan yanılabilir; tıklayın, düzeltin. Uzantı sabit kalır — yanlış uzantı sessizce başarısız olur.
- **İsterseniz kopyalayın**, çoğu zaman asıl istediğiniz metnin kendisidir.
- **Bloğun üstünde bir kontrol**, üreteceği dosya adını daha basmadan gösterir; en son blok için `Alt+Shift+D`.

**Nerede çalışır**

Claude, ChatGPT, Gemini, Perplexity, DeepSeek, Mistral, Grok, Copilot, Kimi, Qwen, Z.ai ve T3 — on iki sohbet arayüzü, konuşma sayfalarında.

**Bu sürümün yapmadıkları**

Açıkça yazıyoruz, çünkü sohbetin ürettiğinin yarısını sessizce görmezden gelen bir indirici, sınırını söyleyenden kötüdür:

- Dokümanlar, artifact'ler, canvas'lar ve sürüm geçmişleri — **henüz yok**
- Ekler, araç çıktıları, kaynakça ve üretilen görseller — **henüz yok**
- Konuşmanın tamamını dışa aktarma, klasöre kaydetme, sürükle-bırak, toplu zip, indirme geçmişi — **henüz yok**

Sıradaki sürümler bunlar, bu sırayla.

**Gizlilik**

Dışarıya istek yok. Telemetri yok. Hesap yok. Sunucu yok. Magpie açık olan konuşma sayfasını okur — indirilebileceği bulmanın başka yolu yok — ve okuduğu her şey sekmede kalır. Sakladığı tek şey ayarlarınız.

Kurulumdaki "verilerinizi okuyabilir ve değiştirebilir" uyarısı bunu kasteder ve yalnızca yukarıdaki on iki siteyi kapsar.

---

Anthropic, OpenAI, Google, Perplexity, DeepSeek, Mistral, xAI, Microsoft, Moonshot, Alibaba, Z.ai veya T3 ile bağlantılı değildir; adları yalnızca desteklenen servisleri tanımlamak için kullanılır.

Sorun bildirimi: team@katatechnology.co

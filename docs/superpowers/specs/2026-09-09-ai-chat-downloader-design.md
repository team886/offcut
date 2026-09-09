# AI Chat Downloader — Tasarım Dokümanı

**Tarih:** 2026-09-09
**Durum:** Onaylandı, implementation plan bekliyor
**Hedef:** Chrome MV3 extension, Chrome Web Store'a yayınlanacak
**Kapsam:** **Claude, ChatGPT, Gemini, Perplexity** sohbetlerindeki artifact/canvas'lar, mesaj içi kod blokları ve yüklenen ekler

---

## 1. Problem

AI sohbet arayüzleri içeriği kopyalatır ama **dosya olarak indirtmez**. Bir React bileşenini, bir HTML sayfasını, mesajın ortasındaki bir Python fonksiyonunu ya da üç hafta önce yüklediğin CSV'yi diske almak istediğinde yol hep aynı: kopyala → editör aç → yeni dosya → yapıştır → uzantıyı doğru tahmin et → kaydet. Claude'da artifact'ın önceki bir versiyonuna dönmek istiyorsan hiç yolu yok — panel sadece güncel hâli gösterir.

Bu extension o boşluğu kapatır: **sohbetteki her indirilebilir şeye tek tıkla, doğru uzantıyla, mümkünse istenen versiyonda erişim.**

**Neden sabit bir liste, `<all_urls>` değil.** Genel web indiricisi yönü bilinçle reddedildi: `<all_urls>` host izni Web Store incelemesinin en sık ret sebebi ve kullanıcı güveninin en hızlı kaybı; "tek amaç" beyanı (mağaza formunda zorunlu) çöker. Sabit ve gerekçelendirilebilir bir liste — `claude.ai`, `chatgpt.com`, `gemini.google.com`, `perplexity.ai` — tek amacı korur: *AI sohbet asistanlarından kod ve doküman indirmek*. Dış istek yine yok; her sağlayıcıya yalnızca kullanıcının kendi oturumunda, kendi verisi için gidilir.

**Kabul edilen risk.** Dört sağlayıcı = dört bağımsız arayüz, dört bağımsız kırılma takvimi. Baskın maliyet kod değil bakımdır. Bu bilinçli bir karardır (bkz. §16 Riskler); tasarım bunu üç şeyle sınırlar: adaptör yalıtımı, sağlayıcıdan bağımsız DOM tabanı, ve bir adaptör bozulduğunda diğerlerinin etkilenmemesi.

## 2. Hedefler / Hedef olmayanlar

**Hedefler**
- Açık artifact/canvas'ı tek tıkla doğru uzantıyla indir
- Artifact'ın **her versiyonunu** ayrı ayrı indirilebilir yap
- **Mesaj içindeki kod bloklarını** dosya olarak indir (çoğu kod artifact olmuyor)
- **Kullanıcının sohbete yüklediği ekleri** geri indir
- Bir artifact'ın tüm versiyonlarını tek `.zip` olarak ver
- **Sohbetteki tüm öğeleri** (belge + kod + ek) tek `.zip` olarak ver
- Dosyayı **sürükleyip** editöre/masaüstüne bırakabil
- İstenirse sabit bir **klasöre** kaydet, her seferinde sormadan
- Bir belge **tamamlandığında** görünür ama rahatsız etmeyen bir sinyal ver
- Her davranış kapatılabilir olsun
- Kullanıcı verisi cihazdan çıkmasın

**Hedef değil**
- Toplu hesap yedeği (tüm sohbetleri gezmek)
- Artifact düzenleme / geri yükleme
- Listedeki dört sağlayıcı dışındaki siteler
- Kurumsal politika ile önceden yapılandırma (`storage.managed`) — talep gelirse eklenir, varsayım olarak inşa edilmez
- Sunucu, hesap, senkronizasyon
- **Çalıştırılabilir paket üretmek.** React artifact'ı tek başına `.tsx` olarak iner; `package.json`, bundler yapılandırması veya HTML sarmalayıcı üretmeyiz. Kullanıcı dosyayı kendi projesine taşır. Bu bilinçli bir sınır: "çalışan proje" üretmek ayrı bir üründür ve her framework için ayrı bakım demektir

**Doğrulanacak ön koşul — dört sağlayıcı için ayrı ayrı.** Adım 1'de her sağlayıcının kendi indirme/dışa aktarma düğmesini eklemiş olup olmadığı kontrol edilir (Claude'da artifact indirme, ChatGPT'de canvas dışa aktarma, Gemini'de Docs'a aktar, Perplexity'de dışa aktar). Eklemişse bu extension'ın değeri "indirme"den "**versiyon geçmişi + zip + toplu erişim**"e kayar; ürün yine geçerli ama mağaza metni ve README buna göre yazılır. Var olan bir düğmenin yanına ikinci düğme koymak, incelemede de kullanıcıda da zayıf durur.

## 3. Kritik iç görü — artifact bir op-log'dur

Artifact'ın "güncel hâli" hiçbir yerde tek parça durmaz. Konuşmada **operasyon kaydı** durur:

| komut | taşıdığı veri | sonuç |
|---|---|---|
| `create` | tam gövde | v1 |
| `update` | `old_str` → `new_str` | vN+1 |
| `rewrite` | tam gövde | vN+1 |

Yani vN'i elde etmek için v1'den başlayıp update'leri **sırayla replay etmek** gerekir.

```
ops      = [create(A), update(x→y), rewrite(B), update(p→q)]
versions = [A,         A',          B,          B']        ← fold prefix
```

Naif "son bloğu al" yaklaşımı, son op bir `update` ise kullanıcıya koca dosya yerine 5 satırlık diff indirir — **sessiz bozuk çıktı**. Versiyon seçimi bu fold'un yan ürünü olarak bedava gelir.

**Replay doğrulaması:** `update` uygularken `old_str` gövdede bulunamazsa o versiyonun rekonstrüksiyonu güvenilmez. O versiyon `ok:false` işaretlenir, UI'da `⚠ kısmi` görünür, dosya adına `-partial` eklenir. Sessizce yanlış içerik verilmez.

**`old_str` tekil olmalı.** Gövdede birden fazla kez geçiyorsa hangisinin değiştirileceği belirsizdir — ilkini değiştirip devam etmek sessizce yanlış dosya üretir. Kural: **0 eşleşme → `ok:false`; 2+ eşleşme → `ok:false`, `reason:"old_str_ambiguous"`; tam 1 eşleşme → uygula.** JS `String.replace` ilk eşleşmeyi değiştirir; bu davranışa güvenilmez, eşleşme sayısı açıkça sayılır.

**`old_str` eşleşmemesinin en olası sebebi satır sonudur.** Gövde `\r\n` taşıyıp `old_str` `\n` kullanıyorsa (veya tersi) eşleşme tutmaz. Bunu sessizce normalize edip uygulamak **içeriği değiştirmek** olur — yapmıyoruz. Bunun yerine mismatch raporlanır ve `docs/BREAKAGE.md` bu ihtimali ilk tanı maddesi olarak listeler. Aynı şekilde boş gövdeli bir `create` geçerli sayılır (0 baytlık dosya iner), çökme sebebi değildir.

**Başlık versiyona göre değişebilir.** Claude bir güncellemede artifact'ı yeniden adlandırabilir. Her `Version` kendi `title`'ını taşır; dosya adı **indirilen versiyonun** başlığından üretilir, artifact'ın güncel başlığından değil.

### 3.1 Konuşma ağacı — dallanma tuzağı

Konuşma düz bir liste değil, **ağaçtır**. Kullanıcı bir mesajı düzenlerse kardeş dal oluşur; terk edilmiş dal API yanıtında durmaya devam eder. Tüm mesajları düz okuyup op'ları sıraya dizmek, **terk edilmiş daldaki op'ları da replay'e karıştırır** — sonuç sessizce bozuk bir versiyon geçmişi.

Kural: `parent_message_uuid` zincirinden **yaprak → kök** yürünüp aktif dal çıkarılır, op'lar yalnızca o daldan toplanır. Aktif yaprak, `current_leaf_message_uuid` alanı varsa oradan; yoksa en yeni `created_at`'e sahip yapraktan alınır.

Bu, "hangi mesajları okuduğumuz" sorusunun tek doğru cevabı ve `selftest.js`'in dallanma testi bunu koruma altına alır.

**Sıralama zaman damgasıyla değil, dal konumuyla yapılır.** Bir mesajda birden fazla op olabilir ve hepsi aynı `created_at`'i taşır; ayrıca düzenlenen dallarda zaman damgaları geriye gidebilir. Op sırası = dal zincirindeki mesaj indeksi, sonra mesaj içindeki blok indeksi. `created_at` yalnızca **gösterim** içindir (menüdeki "14 dk önce"), sıralama için değil.

### 3.2 Yazılmakta olan artifact

Kullanıcı Claude hâlâ yazarken butona basabilir. O anda son op yarım gelmiş olabilir — `content` kesik, `old_str` henüz tamamlanmamış. Bunu indirmek yarım dosya demektir.

Kural: akış hâlâ sürüyorsa (panelde/kompozitörde durdurma göstergesi var ya da son mesaj `stop_reason` taşımıyor), son versiyon `⚠ yazılıyor` işaretlenir. Menü açılır, önceki **tamamlanmış** versiyonlar normal indirilir; yarım versiyonu seçmek için kullanıcının uyarıyı görüp yine de tıklaması gerekir. Varsayılan seçim yarım versiyona düşmez.

### 3.3 İndirilebilir öğe modeli

Üç kaynağın (artifact, kod bloğu, ek) tek bir modele indirgenmesi, boru hattının, UI'ın, zip'in ve adlandırmanın tek kod yolunda kalmasını sağlar:

```js
Item = {
  kind: "artifact" | "code" | "attachment",
  key,               // sohbet içinde kararlı kimlik (bkz. aşağıdaki kararlılık kuralı)
  title,             // görünen ad (kind'e göre türetilir)
  ext,               // ".tsx" | ".py" | ".csv" ...
  versions,          // Version[] — yalnızca artifact'ta >1 olur
  bytes | fetchBytes // ek'lerde içerik ayrı istekle gelir
}
```

**`key` akış sırasında kaymamalı.** Artifact/canvas'ta kimlik sağlayıcının kendi id'sinden gelir, sorun yok. Kod bloğunda doğal kimlik "mesaj indeksi + blok indeksi"dir; ama Claude yazarken **yeni bloklar araya değil sona eklenir**, dolayısıyla mevcut blokların indeksi sabit kalır — kural: kod bloğu anahtarı `msgIndex:blockIndex` olarak hesaplanır ve akış sırasında yeniden numaralandırılmaz. **DOM kademesinde mesaj indeksi olmayabilir**; orada anahtar, sohbet kökünde `SEL.codeBlock` ile bulunan blokların **belge sırasındaki indeksidir** (`code:<n>`). Aynı kararlılık kuralı geçerli: yeni bloklar sona eklendiği için mevcut indeksler kaymaz. Anahtar kayarsa açık menü yanlış öğeye bağlanır ve kullanıcı beklediğinden başka bir dosya indirir.

**Bu genelleştirme bugün bedava, sonra pahalı.** Normalde tek implementasyonlu soyutlama YAGNI'dir; ama ikinci ve üçüncü implementasyonun **isteneceğini bildiğimiz** an kural tersine döner. Kritik gözlem: `getConversation` zaten konuşmanın tamamını getiriyor — artifact'lar onun içinden süzdüğümüz bir alt küme. Kod blokları aynı yanıtın içinde, **ek ağ maliyeti sıfır**. "Artifact indirici" olmak mimari bir sınır değildi, sadece bir filtreydi.

### 3.3.1 Kod blokları

Kaynak: API kademesi varsa asistan mesajlarının metin blokları (Claude'da **aktif dal**, §3.1; dallanma kavramı olmayan sağlayıcılarda tüm görünür akış), fenced code (```lang) parse edilir. API kademesi yoksa `common-dom.js` DOM'dan `pre > code` toplar. Her iki yolda da ek ağ isteği yok.

**Kod bloğunun başlığı yoktur.** Ad şu zincirle türetilir, ilk tutan kazanır. Zincir **taban ad** üretir; uzantı ayrı belirlenir (aşağıda):

1. **Fence'te dosya adı** — ```python:app.py → taban `app`, uzantı `.py` (bu basamakta uzantı da fence'ten gelir, dil tablosuna bakılmaz)
2. **Kodun ilk anlamlı tanımı.** Dile göre tek bir regex, ilk eşleşmenin adı kebab-case'e çevrilir:
   ```
   py            ^\s*(?:class|def)\s+(\w+)
   js ts jsx tsx ^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class|const)\s+(\w+)
   go            ^\s*(?:func|type)\s+(\w+)
   java kt cs    ^\s*(?:public\s+|private\s+)?(?:final\s+)?(?:class|interface|enum)\s+(\w+)
   rs            ^\s*(?:pub\s+)?(?:fn|struct|enum|trait)\s+(\w+)
   rb            ^\s*(?:class|module|def)\s+(\w+)
   php           ^\s*(?:class|function)\s+(\w+)
   sql           ^\s*(?:CREATE|ALTER)\s+(?:TABLE|VIEW|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?[`\"]?(\w+)
   sh bash       ^\s*(\w+)\s*\(\)\s*\{
   ```
   Tablosu olmayan diller bu basamağı **atlar** — uydurma bir kural yanlış ad üretir, atlamak bir sonraki basamağa düşürür. Basamak best-effort'tur, hiçbir zaman hata vermez.
3. **Bloktan hemen önceki markdown başlığı** (`### Migration script` → `migration-script`)
4. **Sırayla:** `kod-3` — numara, o sohbetteki kod bloklarının görünme sırasıdır (§3.3'teki `key` ile aynı sıra, yeniden numaralandırılmaz)

**Uzantı** (1. basamak kazanmadıysa) fence dilinden, aşağıdaki tabloya göre:
```
py python → .py        js javascript node → .js    ts typescript → .ts
jsx → .jsx             tsx → .tsx                  go golang → .go
rs rust → .rs          rb ruby → .rb               java → .java
kt kotlin → .kt        cs csharp → .cs             cpp c++ cc → .cpp
c → .c                 php → .php                  swift → .swift
sh bash shell zsh → .sh   sql → .sql               yaml yml → .yaml
json → .json           xml → .xml                  html → .html
css → .css             scss sass → .scss           md markdown → .md
toml → .toml           ini → .ini                  diff patch → .diff
dockerfile → .dockerfile   (dilsiz / tanınmayan) → .txt
```
Bu tablo **çekirdeğe** aittir ve dört sağlayıcıda ortaktır; §6'daki MIME tablosu yalnızca Claude adaptörünündür.

Uzantı fence dilinden gelir; dil yoksa ve içerik ayırt edilemiyorsa `.txt`. Versiyon kavramı yok (`versions` tek elemanlı).

**Türetilen adlar çakışabilir.** Aynı sohbette iki blok da `class OrderService` içerebilir; ikisi de `order-service.py` olur. Tek dosya indirmede Chrome `(1)` ekler, ama **zip içinde iki özdeş ad bozuk arşiv demektir**. Kural: zip'e eklenirken `kod/` altında ad çakışması sayılır ve ikinciden itibaren `-2`, `-3` eklenir. Aynı kural klasöre kaydetmede de geçerli (§8.7.2).

**Üç satırdan kısa bloklar atlanır.** Ölçü **boş olmayan satır** sayısıdır (`trim()` sonrası boş olanlar sayılmaz), böylece iki satırlık kod + üç boş satır kontrol almaz. Tek satırlık `npm install x` veya bir değişken adı dosya değildir; her birine kontrol koymak arayüzü çöplüğe çevirir. Eşik `MIN_CODE_LINES = 3` olarak tek yerde tanımlıdır.

### 3.3.2 Ekler

Kaynak: konuşma yanıtındaki dosya/ek kayıtları. İçerik mesajda gömülü değildir; ayrı bir indirme isteği gerekir — yani **tek kaynak ki ek ağ maliyeti var**, ve yalnızca kullanıcı o eki indirmek istediğinde yapılır.

Ekler **ikili olabilir** (PDF, xlsx, png). Kural: içerik hiçbir zaman metne çevrilmez, `ArrayBuffer` olarak alınıp aynen yazılır; `TextEncoder`/`TextDecoder` yoluna sokulmaz — aksi hâlde bozuk dosya üretilir. Ad ve uzantı sunucudaki adından gelir, `sanitize`'dan geçer, tahmin edilmez.

**Doğrulanacak (adım 1):** ek indirme endpoint'i ve yanıt biçimi. Belirlenemezse ekler kapsamdan **çıkarılır** — artifact ve kod tek başına ürünü ayakta tutar; çalışmayan bir feature'ı yarım bırakmaktansa hiç söz vermemek iyidir.

### 3.4 Sağlayıcı adaptörü

Çekirdek sağlayıcıyı bilmez. Her sağlayıcı tek bir dosyada, tek bir sözleşmeyi uygular:

```js
Adapter = {
  id,                    // "claude" | "chatgpt" | "gemini" | "perplexity"
  matches,               // host eşleşmesi
  SEL,                   // bu sağlayıcının tüm DOM seçicileri (§12)
  capabilities,          // { versions, api, attachments, panel }
  conversationId(),      // location'dan; yoksa null → extension sessiz kalır
  fetchConversation(),   // API kademesi; desteklenmiyorsa null döner
  parse(raw),            // Item[] — çekirdek yalnızca Item bilir
  isStreaming(),         // DOM ya da yanıt üzerinden
  mountPoints(),         // belge butonunun nereye gireceği
  conversationTitle(),   // zip adı için; okunamazsa null (§8.2.1)
  fetchAttachment(item), // capabilities.attachments ise ArrayBuffer döner (§3.3.2)
  codeBlocks(),          // opsiyonel — common-dom.js varsayılanını geçersiz kılar (§3.4.1)
  LAST_VERIFIED,         // "YYYY-MM-DD" — CI tazelik kapısı (§19.3 kapı 13)
}
```

Sözleşme **tam** olmak zorunda: bir feature'ın (ek indirme, sohbet zip'i, tazelik kapısı) adaptörden bir şey istemesi ama sözleşmede karşılığının bulunmaması, o feature'ı adaptör yazarken keşfedilen bir sürprize çevirir. Yukarıdaki liste §2'deki her hedefi karşılar.

**Çekirdekte ne var:** öğe modeli, versiyon fold'u, zip, `sanitize`, adlandırma zinciri, indirme yolları, sürükle-bırak, klasöre kaydet, UI kabuğu (buton, menü, pill, toast), ayarlar, teşhis. Bunlar bir kez yazılır.

### 3.4.1 DOM tabanı zorunlu, API isteğe bağlı

Her adaptör **DOM kademesini uygulamak zorundadır**; API kademesi opsiyoneldir. Böylece bir sağlayıcının dahilî API'si bulunamasa, değişse veya direnç gösterse bile ürün o sağlayıcıda çalışmaya devam eder — sadece daha az yetenekle.

Bunu mümkün kılan gözlem: **DOM kod-bloğu çıkarımı neredeyse sağlayıcıdan bağımsız.** Dördü de kod bloğunu `pre > code` olarak, dili bir sınıf adıyla çizer. Ortak varsayılan, dili şu sırayla arar ve ilk bulduğunu kullanır: `data-language` / `data-lang` özniteliği → `language-*` sınıfı → `hljs` yanındaki dil sınıfı → `pre`'nin aynı özniteliklerinden biri. Hiçbiri yoksa dil bilinmiyor sayılır ve uzantı `.txt` olur — tahmin edilmez.

Gezici düğme `SEL.chatRoot` üzerinde tek bir `mouseover`/`focusin` delegasyonuyla çalışır; her blok için ayrı dinleyici bağlanmaz (uzun sohbette yüzlerce dinleyici demek olurdu). Çekirdek bunun **ortak varsayılan implementasyonunu** taşır; adaptör yalnızca farklıysa geçersiz kılar. Kod blokları — yani değerin büyük kısmı — dört sağlayıcıda tek kod yoluyla çalışır.

### 3.4.2 Yetenek matrisi

| | Claude | ChatGPT | Gemini | Perplexity |
|---|---|---|---|---|
| Kod blokları (DOM) | ✓ | ✓ | ✓ | ✓ |
| Panel/canvas belgesi | ✓ artifact | ✓ canvas | — | — |
| **Versiyon geçmişi** | ✓ op-log (§3) | ? canvas sürümleri | ✗ | ✗ |
| Ekler | ? | ? | ? | ? |
| API kademesi | ? | ? | ? | ? |

`?` = **adım 1'de sağlayıcı bazında keşfedilecek.** Bu spec hiçbir sağlayıcının dahilî API şemasını bildiğini iddia etmiyor; Claude için bile şema doğrulaması ilk iş (§4). Keşif çıktısı her adaptör için: konuşma kimliği nereden okunur, API var mı, yanıt şekli, akış tespiti, `SEL` seçicileri, ek endpoint'i.

**`capabilities` statik yazılır, çalışma anında yalnızca *daralabilir*.** Adaptör dosyasında keşif sonucuna göre sabit tanımlanır; oturum sırasında API 401 verirse `api` o sekme için kapanır ve UI hemen buna göre çizilir (versiyon menüsü kaybolur). Genişleme yönü yoktur — çalışma anında "acaba destekliyor mu" diye yoklama yapılmaz, çünkü yoklama hem gereksiz istek hem de bot koruması riskidir (§16).

Bir yetenek doğrulanamazsa o sağlayıcıda **kapatılır**, taklit edilmez: versiyon menüsü yoksa buton bölünmez (§8.1), ek desteği yoksa hiç söz edilmez. Kullanıcı her sağlayıcıda ne alacağını görür; eksik yetenek sessiz hata olarak görünmez.

### 3.4.3 Yalıtım

Bir adaptörün fırlattığı hata **yalnızca o sekmeyi** etkiler: adaptör kendini kapatır, teşhis kaydına yazar, diğer sağlayıcılar çalışmaya devam eder. Çekirdek bir adaptörün döndürdüğü `Item[]`'ı doğrular (zorunlu alanlar, tip); doğrulama başarısızsa o adaptör devre dışı kalır — bozuk adaptör bozuk dosyaya dönüşemez.

## 4. Veri kaynağı — üç kademe (Claude adaptörü)

Aşağıdaki kademe yapısı **genel kalıptır**; somut alanlar Claude adaptörüne aittir. Diğer adaptörler aynı üç kademeyi kendi kaynaklarıyla doldurur, Kademe 3 hepsinde zorunludur (§3.4.1).

| # | Kaynak | Ne verir | Ne zaman |
|---|---|---|---|
| 1 | **Structured `tool_use`** — konuşma JSON'unda `chat_messages[].content[]` içinde `name === "artifacts"` olan bloklar; `input` = `{command, id, type, title, language, content, old_str, new_str}` | Tam op-log, regex yok | Öncelikli |
| 2 | **Ham metin `<antArtifact>`** — mesaj metnindeki inline bloklar, regex ile | Tam op-log | Kademe 1 boş dönerse (eski konuşmalar / format değişimi) |
| 3 | **DOM** — panelin Code sekmesindeki `<code>` metni | Sadece görüntülenen versiyon | API 401 / şema tanınmazsa |

**Kademe 2 kendi içeriğine karşı savunmasız.** Bir artifact'ın gövdesi `</antArtifact>` metnini içerebilir — artifact yazmayı anlatan bir doküman, bu spec'in kendisi, ya da o etiketi örnek olarak gösteren bir HTML. Regex ilk kapanış etiketinde durur ve kullanıcıya **sessizce kesilmiş dosya** verir. Uzunluk makul göründüğü için fark edilmesi de zordur.

Kural: Kademe 2'de, çıkarılan gövde içinde başka bir açılış/kapanış işareti kalıntısı varsa versiyon `ok:false`, `reason:"tier2_ambiguous"` işaretlenir. Kademe 1 (yapısal JSON) bu soruna tanım gereği bağışık — sınırlar veriden değil şemadan gelir. Kademe sıralamasının ikinci gerekçesi budur.

Kademe 3'e düşüldüğünde menüde tek satır `v? (sayfadan okundu)` görünür ve sarı toast çıkar — kullanıcı versiyon geçmişinin neden yok olduğunu bilir.

**Kademe 3'ün asıl tehlikesi eksik değil, sanki tammış gibi görünen içeriktir.** Uzun kod görünümleri **sanallaştırılmış** olabilir: DOM'da yalnızca ekranda olan satırlar durur, `textContent` geri kalanını hiç görmez. Sonuç 400 satırlık bir dosyanın 60 satırı — ve dosya açıldığında makul görünür, çünkü baştan başlar ve sözdizimi bozulmaz. Sessiz kesilmenin en kötü biçimi.

Kural — okuma **tamlık kanıtı olmadan kabul edilmez**:
1. Blok/panel kaydırılabiliyorsa (`scrollHeight > clientHeight`) içerik şüphelidir
2. Kod satırlarını taşıyan düğüm sayısı, kaydırma yüksekliğinin ima ettiği satır sayısıyla karşılaştırılır; tutmuyorsa sanallaştırma var demektir
3. Sanallaştırma tespit edilirse: içerik **programatik olarak sonuna kadar kaydırılıp** parça parça toplanır (`scrollTop` adım adım, her adımda yeni satırlar biriktirilir), sonra kaydırma konumu **eski hâline döndürülür** (§12'deki sekme geri yükleme ilkesiyle aynı)
4. Toplama sonrası satır sayısı hâlâ tutmuyorsa öğe `⚠ eksik olabilir` işaretlenir ve dosya adına `-partial` eklenir — bozuk dosyayı sessizce vermeyiz

Bu, Kademe 1'i tercih etmenin **üçüncü** gerekçesi: API yanıtı sanallaştırma bilmez, tam metni verir.

### 4.1 Kademe 1 otomatik olarak "gerçek" değildir

Tasarımın tamamı Kademe 1'i referans alıyor: sanallaştırma bilmez, sınırları şemadan gelir, tam op-log'u verir. **Bunların hiçbiri doğrulanmadı.** İki somut şüphe var ve ikisi de adım 1'de ölçülmeli:

**Bayt sadakati.** Endpoint'in adında `rendering_mode` geçiyor — yani sunucu içeriği bir biçimde **işliyor** olabilir. Satır sonu normalizasyonu, kaçış çözümü, sondaki boşlukların kırpılması: hepsi mümkün ve hepsi sessiz. Ölçüm: bilinen bir artifact için Kademe 1 çıktısı ile sağlayıcının kendi "kopyala" düğmesinin verdiği metin **bayt bayt** karşılaştırılır. Fark varsa Kademe 1'in "ham" olduğu iddiası düşer ve `old_str` eşleşmelerinin neden tutmadığı da (§3) buradan açıklanabilir.

**Tamlık.** Konuşma endpoint'i tüm mesajları mı döndürüyor, yoksa bir **pencere** mi? Uzun sohbetlerde sunucu eski mesajları kırpıyorsa, aktif dal yürüyüşü eksik bir zincir üzerinde çalışır ve versiyon geçmişi **sessizce kısmi** olur — üstelik hiçbir hata vermeden, çünkü kalan zincir kendi içinde tutarlıdır. Ölçüm: 200+ mesajlık bir sohbette dönen mesaj sayısı ile arayüzde görünen sayı karşılaştırılır. Pencereleme varsa sayfalama uygulanır; uygulanamıyorsa en eski versiyonlar `⚠ erişilemedi` işaretlenir.

**Kademeler arası uyuşmazlık bir sinyaldir.** İki kaynak da eldeyken (panel açık ve API çalışıyor) karşılaştırma bedava: Kademe 1'in ürettiği güncel versiyon ile DOM'dan okunan metnin uzunlukları **belirgin biçimde** ayrışıyorsa (>%5), bir taraf yanlış demektir — sanallaştırma, pencereleme, yanlış artifact eşleşmesi ya da şema kayması. Kural: uyuşmazlıkta indirme **engellenmez** (hangisinin doğru olduğunu bilmiyoruz), ama sarı toast çıkar ve teşhis bloğuna yazılır. Bu, sahada şema kaymasını kullanıcı şikâyetinden **önce** yakalayan tek mekanizma — telemetrisiz bir kanarya.

**Doğrulanacak varsayım (implementation'ın ilk adımı):** Kademe 1 için `input` nesnesinin alan adları (`id` mi `identifier` mı, `content` mi `new_content` mi); Kademe 2 için `old_str`/`new_str`'ın attribute mı child element mi olduğu. Parser yazılmadan önce gerçek bir konuşma JSON'u dump edilip her iki şema da doğrulanacak; parser gördüğü varyantları tolere edecek şekilde yazılır.

**Endpoint'ler** (content script'ten same-origin `fetch`, cookie otomatik):
```
GET /api/organizations/{orgUuid}/chat_conversations/{convUuid}?tree=True&rendering_mode=messages
```

**Org UUID'sini "ilk org" diye almak hatalıdır.** Kullanıcı birden fazla organizasyona üye olabilir (kişisel hesap + Team/Enterprise workspace). Konuşma bunlardan **birine** aittir; yanlış org ile istek 404 döner ve extension sebepsiz yere DOM fallback'ine düşer — kullanıcı versiyon geçmişini kaybeder, nedenini asla öğrenemez. Bu, tek org'lu bir hesapta test edilirken **hiç görünmeyen** bir hata.

Çözüm sırası:
1. `document.cookie` içindeki `lastActiveOrg` (content script okuyabilir, `HttpOnly` değil)
2. Yoksa `GET /api/organizations` → dönen org'lar **sırayla** denenir, ilk `200` kazanır
3. Çözülen org, konuşma UUID'siyle birlikte cache'lenir; her tıklamada arama tekrarlanmaz

`convUuid` → `location.pathname`'den. Pathname bir konuşma UUID'si vermiyorsa (`/project/<id>` liste sayfası, `/new`, henüz kaydedilmemiş sohbet) extension **hiçbir şey yapmaz**: buton enjekte edilmez, badge yazılmaz, hata gösterilmez. Proje içi sohbetlerin gerçekten `/chat/<uuid>` yoluna mı düştüğü implementation'ın ilk adımında doğrulanır; düşüyorsa `/project/*` eşleşmesi manifest'ten çıkarılır (kullanılmayan host eşleşmesi, incelemede gereksiz yüzey demektir).

## 5. Mimari

```
ai-chat-downloader/
  manifest.json
  _locales/tr/messages.json
  _locales/en/messages.json
  src/
    adapters/
      claude.js     # op-log, org/tree çözümü, artifact paneli
      chatgpt.js    # canvas + kod blokları
      gemini.js     # DOM-only
      perplexity.js # DOM-only
      common-dom.js # sağlayıcıdan bağımsız pre>code çıkarımı (§3.4.1)
    parse.js        # saf, node-testable — fold, Item doğrulama
    zip.js          # saf, store-only ZIP yazıcı
    content.js      # adaptör seçimi + DOM gözlem + UI enjeksiyonu + orkestrasyon
    overlay.css     # buton, menü, pill, toast
    sw.js           # badge, sistem bildirimi, optional permission
    panel.html
    panel.js        # popup VE options aynı dosya
  icons/16.png 48.png 128.png
  selftest.js       # node selftest.js
  store/            # Web Store teslimatları (§15)
  test/fixtures/<sağlayıcı>/   # gerçek yanıtlardan temizlenmiş örnekler (§14)
  tools/pack.mjs tools/check-invariants.mjs   # (§19.3, §19.4)
  .github/workflows/ci.yml .github/ISSUE_TEMPLATE/bug.yml
  docs/BREAKAGE.md docs/LIMITATIONS.md docs/SMOKE.md
  docs/superpowers/specs/
```

**Build step yok, npm yok, bundler yok.** `parse.js` ve `zip.js` global tanımlar; content script'ler aynı isolated world'ü paylaştığı için `content.js` doğrudan çağırır. Her ikisi sonunda `if (typeof module !== "undefined") module.exports = {...}` shim'i taşır → `node selftest.js` aynı dosyayı yükler.

**manifest.json (özet)**
```jsonc
{
  "manifest_version": 3,
  "name": "__MSG_extName__", "default_locale": "en",
  "permissions": ["storage"],
  "optional_permissions": ["notifications"],
  "host_permissions": ["https://claude.ai/*", "https://chatgpt.com/*",
                        "https://gemini.google.com/*", "https://www.perplexity.ai/*"],
  "background": { "service_worker": "src/sw.js" },
  "content_scripts": [{
    "matches": ["https://claude.ai/chat/*", "https://claude.ai/project/*"],
    "js": ["src/parse.js", "src/zip.js", "src/adapters/common-dom.js",
           "src/adapters/claude.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }, {
    "matches": ["https://chatgpt.com/c/*"],
    "js": ["src/parse.js", "src/zip.js", "src/adapters/common-dom.js",
           "src/adapters/chatgpt.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }],   // gemini ve perplexity için aynı kalıpta iki blok daha
  "action": { "default_popup": "src/panel.html" },
  "options_ui": { "page": "src/panel.html", "open_in_tab": true },
  "commands": { "download-current": {
    "suggested_key": { "default": "Alt+Shift+D", "mac": "Alt+Shift+D" },
    "description": "__MSG_cmdDownload__" } }
}
```

**Her sağlayıcı kendi `content_scripts` bloğunu alır ve yalnızca kendi adaptörünü yükler.** Hepsini tek blokta yüklemek, §3.4.3'teki yalıtım iddiasını çürütürdü: `gemini.js`'teki bir sözdizimi hatası o dosyayı değil, **paketin tamamının o sekmedeki yüklemesini** düşürür ve Claude'da da extension ölür. Ayrı bloklar bunu imkânsız kılar; bedeli birkaç satır manifest tekrarı.

`downloads` izni **yok** — `Blob` + `<a download>` yeterli. `tabs` izni **yok** — `sw.js` mesajın geldiği `sender.tab.id`'yi kullanır.

**Kısayol neden `Alt+Shift+D`:** `Ctrl+Shift+D` Chrome'da "tüm sekmeleri yer imlerine ekle" komutuna ayrılmış. Extension'ın istediği kısayol tarayıcının kendi komutuyla çakışırsa Chrome onu **sessizce kaydetmez** — kullanıcı basar, hiçbir şey olmaz, sebebini de göremez. `Alt+Shift+D` boşta. Kullanıcı yine de `chrome://extensions/shortcuts` üzerinden istediğine çevirebilir.

**`default_locale` neden `en`:** bu alan, tarayıcı dili desteklenmediğinde kullanılacak **yedek** dili belirler ve Web Store listeleme dilinin temelini oluşturur. `tr` yapılırsa Japon veya Alman bir kullanıcı Türkçe arayüz görür. `en` yedek, `tr` Türkçe tarayıcılarda otomatik devreye girer — Türkçe deneyim aynen korunur.

## 6. Modül sözleşmeleri

### parse.js (saf) — çekirdek

**Sınır:** `parseOps` **çekirdeğin değil, adaptörün** işidir; sağlayıcının şemasını (tool_use alan adları, `antArtifact` biçimi) yalnızca adaptör bilir. Çekirdek `Op[]`'ı alır ve geri kalanını yapar. Aşağıdaki `parseOps` imzası bu yüzden **adaptörün uyması gereken çıktı sözleşmesidir**, çekirdekte bir implementasyon değil; `buildVersions`, `extFor`, `sanitize`, `fmtName` ise çekirdektedir ve dört sağlayıcıda ortaktır. Sağlayıcıya özel hiçbir alan adı `parse.js`'e sızmaz.

```js
parseOps(conversationJson) → Op[]   // ADAPTÖR uygular, çekirdek tüketir
// Op: { artifactId, title, type, language, command, content?, oldStr?, newStr?, msgIndex, createdAt }

buildVersions(ops, artifactId) → Version[]
// Version: { v:1..N, content, ok:boolean, reason?, bytes, createdAt }
// fold: create/rewrite → içeriği değiştirir; update → oldStr'yi newStr ile değiştirir
// oldStr bulunamazsa → ok:false, reason:"old_str_not_found", içerik önceki hâlde kalır

extFor(type, language) → ".tsx" | ".html" | ...
sanitize(title)        → dosya sistemi güvenli ad
fmtName(template, ctx) → "Sales-Dashboard-v3.tsx"
```

**`{date}` her zaman ISO `YYYY-MM-DD`, kullanıcının yerel saatiyle.** Yerelleştirilmiş biçim kullanılamaz: `en-US` `9/9/2026` üretir ve içindeki `/` dosya adında yol ayırıcıdır — `sanitize` onu `-`'ye çevirir, kullanıcı istediğinden farklı bir ad alır. ISO ayrıca dosya listesinde doğru sıralanır. Saat dilimi **yerel**, UTC değil: kullanıcı dosyayı kendi takvimindeki güne göre arar; gece yarısına yakın indirilen bir dosyanın "dün" görünmesi kafa karıştırır.

Bilinmeyen token (`{foo}`) olduğu gibi bırakılır — sessizce silmek, kullanıcının şablonunun çalıştığını sanmasına yol açar.

**Varsayılan şablon `{title}-v{version}` olmalı, `{title}` değil.** Bu extension'ın tipik kullanımı aynı artifact'ı Claude güncelledikçe **tekrar tekrar** indirmek. Versiyonsuz şablonla indirilenler klasöründe `Dashboard.tsx`, `Dashboard (1).tsx`, `Dashboard (2).tsx` birikir — hangisi hangi hâl, kimse bilmez. Chrome'un çakışma soneki tarih sırası bile vermez. Versiyon adın içindeyse dosyalar kendi kendini açıklar ve ikinci indirme aynı adı üretip zaten indirilmiş olanı işaret eder.

**Kademe 3'te (DOM) versiyon numarası yok.** `{version}` o durumda boş bırakılıp `-v` gibi bir kalıntı üretemez; yerine `{date}` konur, yani `{title}-v{version}` şablonu `Dashboard-2026-09-09.tsx` verir. Şablon kullanıcınınsa ve `{version}` içeriyorsa aynı ikame uygulanır.

Zip'in kendi adı **en son versiyonun** başlığından üretilir (başlık versiyonlar arasında değişmiş olabilir, §3).

**Uzantı tablosu.** Aşağıdaki MIME tablosu **Claude adaptörüne** aittir (`vnd.ant.*` yalnızca orada geçer). Kod blokları ve diğer sağlayıcılar için çekirdek, ortak bir **dil → uzantı** tablosu kullanır; adaptör yalnızca kendi özel tiplerini ekler.
```
text/html                       → .html
application/vnd.ant.react       → .tsx  (language "jsx" ise .jsx)
text/markdown                   → .md
image/svg+xml                   → .svg
application/vnd.ant.mermaid     → .mmd
application/vnd.ant.code        → language'a göre (~20 dil: py js ts go rs java rb php cs cpp c sh sql yaml json xml css scss kt swift)
bilinmeyen                      → .txt
```

**sanitize kuralları:** `<>:"/\|?*` ve kontrol karakterleri → `-`; ardışık `-` teke iner; baş/son `.` ve boşluk kırpılır; Windows rezerve adları (`CON PRN AUX NUL COM1-9 LPT1-9`) `_` önek alır; boş kalırsa `kind`'e göre `belge` / `kod` / `ek`.

**Kırpma kod noktasına göre yapılır, UTF-16 birimine göre değil.** `slice(0,120)` bir emoji'nin ortasından keserse geriye yarım surrogate çifti kalır — dosya adı geçersiz karaktere düşer, bazı sistemlerde yazma başarısız olur. `[...str]` ile kod noktalarına ayrılıp kırpılır. Ayrıca dosya sistemleri adı **bayt** olarak sınırlar (ext4/APFS: 255 bayt): Türkçe ve emoji karakterler 2-4 bayt tuttuğu için sınır hem 120 kod noktası hem 200 bayt olarak uygulanır, hangisi önce dolarsa.

### zip.js (saf)
Store-only (compression method 0) ZIP yazıcı: CRC32 tablosu + local file header + central directory + EOCD. Deflate **bilerek yok** — metin sıkıştırma kazancı burada önemsiz, `CompressionStream` async'i ve boyut muhasebesini işin içine sokmaya değmez.
```js
buildZip([{name, bytes}]) → Uint8Array
```

**Zip içi ad çakışması:** kullanıcının şablonunda `{version}` yoksa (varsayılan şablonda vardır ama kullanıcı silebilir) tüm versiyonlar aynı ada çıkar ve zip 3 özdeş adlı girdi taşır. Kural: **zip modunda `-v{n}` şablondan bağımsız olarak her zaman eklenir.** Zip'in kendi adı şablondan üretilir: `Sales-Dashboard-3-versiyon.zip`.

UTF-8 dosya adları için general purpose bit 11 (language encoding flag) set edilir; aksi halde Türkçe karakterli adlar bazı arşivleyicilerde bozulur.

**Tüm uzunluklar bayt cinsindendir, karakter değil.** ZIP başlıklarındaki `compressed size`, `uncompressed size` ve `file name length` alanları bayt sayar; CRC32 de bayt üzerinden hesaplanır. `str.length` kullanmak ASCII içerikte doğru sonuç verir, ilk Türkçe karakterde veya emoji'de **sessizce bozuk arşiv** üretir — dosya iner, açılmaz. Kural: içerik ve ad `TextEncoder` ile bir kez byte'a çevrilir, bütün alanlar o `Uint8Array`'in `byteLength`'inden okunur. `selftest.js` bunu Türkçe adlı ve emoji içerikli bir girdiyle sabitler.

Sınırlar: 65535 girdi veya 4 GB üzeri ZIP64 gerektirir; bu extension'ın kapsamında oluşamaz, yine de aşılırsa arşiv üretilmez ve hata toast'ı çıkar — bozuk zip verilmez.

## 7. Boru hattı

1. `MutationObserver` artifact panelini izler. SPA route değişiminde (`navigation` API, fallback `popstate` + pathname karşılaştırma) durum sıfırlanır.

   **Observer `document.body`'yi izleyemez.** Claude yanıt üretirken sayfa saniyede yüzlerce kez mutasyona uğrar — token token. `body` + `subtree:true` dinleyen bir callback, her akış boyunca CPU'yu yakar; kullanıcı bunu extension olarak değil "Claude yavaşladı, fanlar döndü" olarak yaşar ve sebebini bulamaz. Kural: iki kademeli izleme. (a) Panelin **kapsayıcısı** bulunana kadar `body` üzerinde `childList` (subtree yok, ucuz). (b) Kapsayıcı bulununca observer ona daraltılır ve `characterData` dinlenmez — sadece düğüm ekleme/çıkarma bizi ilgilendiriyor. Callback `requestAnimationFrame` ile debounce edilir ve tek bir "durumu yeniden değerlendir" fonksiyonuna iner. Panel kapanınca observer tekrar (a)'ya döner.

   Kabul ölçütü: uzun bir yanıt akarken extension'ın CPU payı ölçülebilir olmamalı. Bu, manuel doğrulama listesinde Performance profili ile kontrol edilir.
2. Panel görülünce split buton enjekte edilir (`data-adl` işaretiyle idempotent). Pill gösterilir, `sw.js`'e `artifact:present` mesajı gider.

   **Daha kötüsü: sağlayıcının uygulamasını çökertebiliriz.** React (Claude, ChatGPT, Perplexity) yönettiği kapsayıcının çocuklarını referansla kaldırır; Angular (Gemini) kendi view container'ını indeksle yönetir. Her iki durumda da o kapsayıcıya yabancı bir düğüm soktuğumuzda `NotFoundError: Failed to execute 'removeChild' on 'Node'` sınıfı bir hata fırlayabilir — ve bu bizim butonumuzu değil, **sağlayıcının sayfasını** düşürür. Kullanıcı için sonuç: "ChatGPT bozuldu", sebebi görünmez, suç extension'dayken sağlayıcıya yazılır. Dört sağlayıcı = bu riskin dört ayrı framework'te tekrarı.

   Bu, kabul edilebilir bir risk değil. **İlke: kullanıcının sohbet uygulamasını bozma ihtimali, bizim feature'ımızdan önce gelir.**

   Kural, sırayla:
   1. Buton, action bar'ın **son çocuğu** olarak eklenir — React'in kaldırma/sıralama işlemlerinin en az dokunduğu konum
   2. React'in hiçbir düğümü **kaldırılmaz, taşınmaz, sırası değiştirilmez**; yalnızca ekleme yapılır
   3. Adım 1'de bu **dört sağlayıcıda ayrı ayrı, kasten zorlanır**: buton enjekte edilir, sonra versiyon değiştirme, panel yeniden boyutlandırma, yeni mesaj gönderme, sekme değiştirme ile arka arkaya render tetiklenir ve konsol React hatası için izlenir
   4. Hata görülürse plan B: buton action bar'a **hiç** girmez; `document.body`'ye bağlı, `getBoundingClientRect` ile action bar'ın üstüne hizalanan bir katman olarak çizilir. React DOM'una sıfır müdahale. Bedeli: yeniden boyutlandırma/kaydırmada konum senkronu — görsel olarak biraz daha kırılgan, ama sayfayı asla düşürmez. Kod blokları için bu yol zaten varsayılan (§8.1.1)

   Menü, pill ve toast zaten shadow root içinde ve `body`'ye bağlı (§8.7); risk yalnızca butona ait.

   **Framework enjekte edilen düğümü siler.** Action bar yeniden render edildiğinde butonumuz DOM'dan uçar. Bu, SPA'lara enjeksiyon yapan extension'ların bir numaralı kırılma sebebi. Karşı önlem: observer yalnızca "panel açıldı" olayını değil, **butonun hâlâ bağlı olup olmadığını** da kontrol eder (`document.contains(btn)`), yoksa yeniden enjekte eder. Enjeksiyon fonksiyonu ucuz ve idempotent olacak şekilde yazılır; observer callback'i `requestAnimationFrame` ile debounce edilir ki render fırtınasında CPU yakmasın.
3. Buton tıklanınca `getConversation(convUuid)` — bellek içi cache; DOM mesaj sayısı değiştiğinde veya 60 sn geçince geçersiz. Her mutation'da fetch **yok**.

   **Mesaj sayısı akış sırasında değişmez.** Claude yazarken op'lar **aynı** mesajın içine eklenir; mesaj sayısı sabit kalır. Sadece sayıya bakan bir geçersizleştirme, akış ortasında alınmış bir yanıtı 60 saniye boyunca taze sayar ve kullanıcı Claude bitirdikten hemen sonra indirdiğinde **yarım artifact** alır — üstelik §3.2'deki "yazılıyor" uyarısı da o eski anlık görüntüye göre hesaplanır, yani uyarı bile çıkmaz. Kural: akış sürerken alınan yanıt **cache'lenmez**, yalnızca o anlık kullanım için tutulur; akışın bittiği tespit edildiğinde cache koşulsuz geçersizleşir.
4. `parseOps` → `buildVersions` → versiyon listesi.
5. **Açık artifact eşleştirme:** panel başlığı → aday artifact'lar. Aynı başlıktan birden fazla varsa, görünen kodun ilk 200 karakteriyle her adayın son versiyonu karşılaştırılıp en yüksek skorlu seçilir. Skorlar birbirine yakınsa menüde her ikisi de gösterilir — belirsizlik sessizce çözülmez.
6. **Görüntülenen versiyon:** panelin kendi versiyon göstergesinden okunur; okunamazsa son versiyon varsayılır.
7. Seçim → `Blob` + `<a download>` → başarı toast'ı.

### 7.1 Eşzamanlılık

Boru hattı async ve kullanıcı beklemek zorunda değil. Üç yarış durumu:

**Uçuştaki istek başka konuşmaya ait olabilir.** Kullanıcı ↓'ye basar, fetch sürerken başka bir sohbete geçer. Yanıt döndüğünde artık başka bir konuşmadayız — cevabı uygulamak **yanlış artifact'ı indirmek** demektir. Kural: her istek bir `requestId` + `convUuid` ile damgalanır; yanıt işlenmeden önce `location`'daki konuşma hâlâ aynı mı diye bakılır, değilse sessizce atılır. Rota değişiminde uçuştaki istekler `AbortController` ile iptal edilir.

**Çift tıklama = çift indirme.** Aynı artifact için uçuşta istek varken ikinci tık yeni fetch açmaz; buton `aria-busy` alır ve mevcut isteğe bağlanır.

**Otomatik indirme akış sırasında tetiklenir.** Claude artifact'ı yazarken her op yeni bir "versiyon" gibi görünür; `autoDownload` açıksa tek artifact için onlarca dosya iner. Kural: otomatik indirme **akış bitene kadar beklemek zorunda** (§3.2'deki yazılıyor tespiti), sonra bir kez tetiklenir. Aynı artifact + aynı versiyon için oturumda tekrar inmez.

### 7.2 Yaşam döngüsü

**Menü sahipsiz kalabilir.** React action bar'ı yeniden çizerse buton uçar ama açık menü havada kalır. Kural: yeniden enjeksiyondan önce menü kapatılır. Menü ayrıca şu durumlarda kapanır: dışarı tık, `Esc`, panel kapanması, rota değişimi, panelin kaydırılması.

**Extension güncellenince content script öksüz kalır.** Extension yeniden yüklendiğinde/güncellendiğinde sayfadaki eski content script yaşamaya devam eder ama `chrome.runtime.sendMessage` artık `Extension context invalidated` fırlatır — MV3'te en sık görülen konsol çöplüğü ve kırık buton sebebi. Kural: her `chrome.*` çağrısı sarmalanır; bu hata görülünce content script **kendini kapatır**: observer durur, enjekte edilen UI kaldırılır, bir daha denenmez. Kullanıcı sayfayı yenileyince temiz kurulum gelir.

## 8. UI kararları

### 8.1 İndirme kontrolü — split buton
`↓` yarısı varsayılan versiyonu **tek tıkla** indirir; `▾` yarısı versiyon menüsünü açar. Gerekçe: indirmelerin çoğu "şu an baktığım versiyon"; menü-önce tasarım her kullanıcıya, her seferinde, azınlığın vergisini ödetir.

**Tek versiyon varsa `▾` yarısı çizilmez** — tek satırlık menü gürültüdür. Kontrol ancak seçenek varsa var olur.

**`defaultVersion: "ask"` seçiliyken buton bölünmez.** "Sor" demek "varsayılan yok" demektir; `↓` yarısının indireceği bir şey kalmaz. O ayarda buton tek parçadır ve tıklama doğrudan menüyü açar. İki yarısı da aynı şeyi yapan bir split buton, kullanıcıya olmayan bir seçim sunar.

### 8.1.1 Kod bloğu kontrolü — tek gezici düğme, N enjeksiyon değil

Bir mesajda onlarca kod bloğu olabilir. Her birine ayrı buton enjekte etmek üç bedeli birden getirir: React/Angular reconciliation çökme riskinin **blok sayısı kadar katlanması** (§7 adım 2), akış sırasında sürekli yeniden enjeksiyon, ve arayüzün kontrol çöplüğüne dönmesi.

Kural: **tek** bir gezici indirme düğmesi. Kapsayıcıya olay delegasyonuyla bağlanır, farenin/odak noktasının üstünde bulunduğu kod bloğuna `getBoundingClientRect` ile hizalanır, shadow root içinde `body`'ye bağlı durur. Sağlayıcının DOM'una **hiç** düğüm eklenmez — kod blokları için React riski tamamen ortadan kalkar.

Klavye kullanıcıları için: kod bloğu odaklanabilir olduğunda düğme aynı şekilde hizalanır; ayrıca `Alt+Shift+D` odaktaki bloğu indirir.

**Dokunmatikte hover yoktur.** Tasarım olduğu gibi bırakılırsa dokunmatik ekranlı dizüstü ve tabletlerde kod bloğu indirme **hiç erişilemez** olur — fare yok, hover yok, düğme hiç belirmez. Kural: `(hover: none)` medya sorgusunda düğme davranışı değişir; her kod bloğunun köşesinde küçük, kalıcı bir `↓` durur (hover'a bağlı değil). Aynı kural kalem/dokunmatik karışık cihazlarda da geçerli — cihaz tipi tahmin edilmez, `hover` yeteneği sorulur.

Bu, hover ön-yüklemesini de etkiler: dokunmatikte ön-yükleme tetikleyicisi yoktur, o yüzden ilk dokunuşta kısa bir yükleniyor durumu görünür ve sürükle-bırak dokunmatikte kapalıdır (sürükleme zaten kaydırma jestiyle çakışır).

**Tarayıcı yakınlaştırması.** `getBoundingClientRect` ile hizalanan her katman (kod bloğu düğmesi, plan B'deki buton) yakınlaştırma değişiminde kayar. Yeniden hizalama tetikleyicileri: `resize`, `scroll`, `visualViewport.resize`, ve panelin `ResizeObserver`'ı. %200 yakınlaştırma manuel doğrulama listesinde.

### 8.2 Versiyon menüsü (popover)
```
VERSİYON SEÇ
v3   2 dk önce · 8.4 KB      görüntülenen
v2 ⚠ 14 dk önce · 8.1 KB     kısmi
v1   31 dk önce · 6.2 KB
─────────────────────────────
🗜 Tüm versiyonlar → .zip
```
Zip satırı ayarla kapatılabilir.

**Aynı içerikli ardışık versiyonlar işaretlenir.** Bir `update` hiçbir şeyi değiştirmemiş olabilir (aynı `new_str`, ya da sonuç aynı bayta çıkan bir düzenleme). Menüde iki satır aynı boyutu gösterir ve kullanıcı ikisini de indirip fark arar. Fold sırasında ardışık versiyonların baytları karşılaştırılır; aynıysa satır `değişiklik yok` etiketi alır. Satır **silinmez** — Claude o adımı attıysa kullanıcı bunu görmeyi hak eder; sadece boşuna indirme yapmaz.

**Numaralarımız panelin numarasıyla aynı olmak zorunda.** claude.ai artifact panelinde kendi versiyon göstergesi var ("Version 3"). Bizim fold'umuz op sayısına göre numara üretiyor ve bu **aynı sonucu vermeyebilir**: Claude başarısız bir op'u saymıyor olabilir, `create`'i 0'dan başlatıyor olabilir, ya da ardışık iki `update`'i tek versiyon gösteriyor olabilir. Kayma olursa menüden "v2" seçen kullanıcı, panelin v3 dediği şeyi indirir — ve bunu **asla fark etmez**, çünkü iki numara da makul görünür. Yanlış dosya vermenin en sinsi biçimi.

Kural: adım 1'de bizim numaralarımız panelin göstergesiyle karşılaştırılır. Birebir tutuyorsa `v1…vN` kullanılır. Tutmuyorsa **kendi numaramızı panelinkiymiş gibi sunmayız**: menü satırları `v` yerine sıra + zaman damgasıyla etiketlenir (`3. düzenleme · 14 dk önce`) ve görüntülenen olan `✓ görüntülenen` ile işaretlenir. Kullanıcı yanlış bir eşleşmeye ikna edilmez.

**Yetenek yoksa kontrol de yok.** Versiyon desteklemeyen bir sağlayıcıda (Gemini, Perplexity) buton hiç bölünmez; `▾` yarısı çizilmez, menü açılmaz. Boş bir menü veya tek satırlık liste, kullanıcıya olmayan bir yetenek vaat eder. Aynı kural ek desteği ve panel/canvas için de geçerli — kapalı yetenek görünmez, "bu sağlayıcıda desteklenmiyor" yazan gri bir kontrol de değil.

### 8.2.1 Sohbet seviyesi zip

Menüdeki `🗜 Tüm versiyonlar` **bir** artifact'ı kapsar. Sohbetin tamamı için ayrı bir giriş var: popup'ta `🗜 Sohbetteki 9 öğe → zip`.

İçerik: her öğenin **son** versiyonu, `kind` başına klasörde: `artifacts/`, `kod/`, `ekler/`. Klasörleme şart, çünkü kod bloğu adları (`kod-3.py`) ile artifact adları aynı düzlemde karışır ve arşivi açan kişi neyin ne olduğunu ayırt edemez. Tüm artifact'ların tüm versiyonları değil — 4 artifact × 5 versiyon = 20 dosyalık bir arşiv kimsenin istediği şey değil; versiyon geçmişi tek artifact düzeyinde anlamlı.

Zip adı sohbet başlığından üretilir: `<sohbet-başlığı>-indirilenler.zip`. Başlık okunamazsa `<sağlayıcı>-indirilenler-<tarih>.zip`.

`⚠ kısmi` veya `⚠ yazılıyor` işaretli artifact'lar arşive **girer** ama adlarında `-partial` taşır ve toast kaç tanesinin şüpheli olduğunu söyler. Sessizce dışarıda bırakmak, kullanıcının eksiği fark etmemesi demek olurdu.

### 8.3 Pulse pill — panelin sağ altı
`● 3 versiyon indirilebilir` — 2 nabız atar, 4 sn sonra kaybolur, tıklanınca menüyü açar. Yalnızca `notify === "inpage"` iken gösterilir. Konum gerekçesi: kodu kapatmıyor ve toast'larla aynı bölgeyi paylaşıyor — kullanıcı "bu extension buradan konuşur" diye tek yer öğreniyor.

Aynı artifact için oturum başına **bir kez** gösterilir; panel her açılıp kapandığında tekrar nabız atmaz.

**Tetikleyici panel açılışı değil, artifact'ın tamamlanmasıdır.** Claude yazmaya başladığı anda panel zaten açılıyor; o anda "indirebilirsin" demek yanlış — dosya henüz yarım (§3.2). Sinyal, akışın bittiği tespit edildiğinde çıkar. Aynı kural badge nabzı ve sistem bildirimi için de geçerli.

**Eski sohbet açmak sinyal üretmez.** Aksi hâlde arşivinden bir konuşmayı her açtığında, aylar önce üretilmiş bir artifact için "indirebilirsin" nabzı alırsın — bildirim değil, gürültü. Sinyal iki durumda çıkar: (a) artifact **bu sayfa oturumunda** tamamlandı, (b) kullanıcı paneli **kendi açtı** ve o artifact bu oturumda daha önce görülmedi. Sayfa yüklenirken zaten açık gelen panel hiçbir sinyal üretmez; buton yine de oradadır.

Ayrım şu ilkeye dayanıyor: davetsiz bildirim ancak **yeni bir şey olduysa** haklıdır. Kullanıcının kendi açtığı bir şeyi ona haber vermek bildirim değil, tekrar.

### 8.4 Toast
| tür | süre | örnek |
|---|---|---|
| başlatıldı (tarayıcı indirmesi) | 2.5 sn | `↓ Sales-Dashboard-v3.tsx indiriliyor` |
| tamamlandı (seçilen klasör) | 2.5 sn | `✓ Sales-Dashboard-v3.tsx · ~/Projects/artifacts` |
| zip | 2.5 sn | `↓ Sales-Dashboard-3-versiyon.zip · 3 dosya` |
| uyarı | 5 sn | `! Sayfadan okundu — versiyon geçmişi yok` |
| uyarı | 5 sn | `! v2 kısmi: old_str eşleşmedi` |
| hata | **elle kapatılana kadar** | `✕ İndirilemedi — öğe okunamadı` |

Hata sessizce kaybolmaz; kullanıcı dosyanın inmediğini fark etmek zorunda.

**Toast yalnızca bildiğimiz şeyi söyleyebilir.** `<a download>` ile başlatılan bir indirmenin sonucunu **öğrenemeyiz**: Chrome tamamlanma veya hata bildirmez (bunu bilmek `downloads` izni ister, onu bilerek almadık). Yani "indirildi" demek, doğrulamadığımız bir iddia. Disk doluysa veya politika engellerse kullanıcı yeşil onay görür ve dosya yoktur.

İki yol, iki farklı doğruluk:

| Yol | Bildiğimiz | Toast |
|---|---|---|
| `<a download>` (tarayıcı indirmeleri) | İndirmenin **başlatıldığı** | `↓ Sales-Dashboard-v3.tsx indiriliyor` |
| File System Access (seçilen klasör) | Yazmanın **tamamlandığı** (`write()` çözüldü) | `✓ Sales-Dashboard-v3.tsx · ~/Projects/artifacts` |

Klasör yolunda `write()` hata verirse gerçek hata toast'ı çıkar. Tarayıcı yolunda yapabileceğimiz en dürüst şey, tamamlandı demek yerine başlatıldı demektir.

**Toast'lar ayara tabi değildir.** Kullanıcının kendi başlattığı bir eylemin sonucudur — kesinti değil, geri bildirim. Ayarlanabilen tek şey *davetsiz* sinyaldir (§8.3 pill, §8.5 badge).

### 8.5 Logo
Artifact paneli silueti + içinden çıkan coral (#d97757) ok, ink (#262624) yuvarlak kare zemin. 16px'te siluet ayakta kalıyor ve "artifact → dosya" diyor.

**Elenen yön:** Claude'un yıldız/spark işaretini andıran logo — Chrome Web Store impersonation politikası ve marka ihlali riski. Coral rengi tonal akrabalık için yeterli; işaret taklidi gereksiz risk.

**Badge durumları**
| durum | badge |
|---|---|
| Desteklenmeyen sitede | ikon soluk, badge yok |
| sohbette belge yok | badge yok |
| belge var | belge **sayısı**, coral zemin + `setIcon` ile 3 nabız |
| indi | yeşil `✓`, 2 sn sonra eski hâl |
| hata | kırmızı `!`, kalır |

**Boş badge "indirilecek bir şey yok" demek değildir.** Badge yalnızca belgeleri sayar; 12 kod bloğu olan bir sohbette badge boştur ve bu doğrudur — kod blokları davetsiz sinyal üretmez, talep üzerine erişilir. Popup açıldığında ikisi de listelenir (§8.6), yani bilgi kaybolmaz, sadece rozete taşınmaz.

**Badge kod bloklarını saymaz.** Uzun bir sohbette 40+ kod bloğu olabilir; `40` yazan bir rozet bilgi değil gürültüdür ve "indirilecek bir şey var" sinyalini değersizleştirir. Badge yalnızca **belge sınıfı** öğeleri sayar: artifact/canvas. Kod blokları talep üzerine, gezici düğmeyle erişilir; sinyal üretmezler.

**Sayı nereden geliyor — ağdan değil, DOM'dan.** Burada bir çelişki riski var: §7 boru hattı konuşmayı **yalnızca butona basılınca** çekiyor. Badge'in sayıyı gösterebilmesi için sayfa açılır açılmaz fetch yapmak gerekirdi ve bu, hiç indirme yapmayacak kullanıcı için her sohbette birkaç MB'lık istek demektir — sessiz, gereksiz, pil yakan.

Çözüm: badge sayısı **sohbet akışındaki belge kartları sayılarak** elde edilir (`SEL.docCard`). Ağ isteği yok, maliyet sıfır. Ağ yalnızca kullanıcı indirmek istediğinde devreye girer.

Sonuç: badge "bu sohbette kaç artifact var" der, "kaç versiyonu var" demez — versiyon bilgisi ancak fetch sonrası bilinir ve zaten menüde görünür. Ucuz sinyalle pahalı bilgiyi karıştırmamak.

**Badge sekmeye özgüdür.** `chrome.action.setBadgeText({text, tabId})` — `tabId` verilmezse badge global olur ve aynı anda açık beş sohbet sekmesi birbirinin sayısını ezer.

**Nabız MV3 service worker'da ImageData ile yapılamaz** — SW'de `document` yok, `canvas` yok. Çözüm: `icons/pulse-1.png … pulse-3.png` önceden render edilir, `setIcon({path})` ile sırayla gösterilir. `OffscreenCanvas` yazmaya gerek yok.

**Service worker 30 sn boşta ölür.** Nabız zamanlayıcısı ortasında SW ölürse ikon ara karede takılı kalır. Karşı önlem: nabız **önce** son (sabit) durumu yazar, animasyon karelerini onun üstüne bindirir; SW ölse bile ikon doğru durumda kalır. SW her uyandığında aktif sekmelerin badge durumu `artifact:present` mesajlarından yeniden kurulur.

### 8.6 Ayar paneli (popup = options)
Üstte **eylem**, altta ayarlar. Her `cfg` anahtarının (§9) burada bir karşılığı vardır; şemada olup panelde olmayan ayar bırakılmaz.

1. **Sağlayıcı şeridi:** aktif sağlayıcı + o sağlayıcıda ne alınabileceği (`ChatGPT · canvas + kod · versiyon yok`). Kullanıcı eksik yeteneği bozukluk sanmasın diye.
2. **Öğe listesi**, `kind` başına gruplu: *Belgeler* (artifact/canvas), *Kod blokları · N*, *Ekler · N*. Her satır: ad, kısa meta (tip/satır/boyut), `↓`. Belge satırlarında ayrıca `▾` (versiyon) ve `🗜`. En altta `🗜 Tümü → zip`.
   Eski tek-kartlı "şu an" tasarımının yerini bu aldı: artık öğe tek değil ve panel açık olmak zorunda değil (§8.8).
3. **Neleri göster** (`kinds`): artifact/canvas · kod blokları · ekler — üç anahtar. Kod bloklarını kapatmak, uzun teknik sohbetlerde listeyi sadeleştirmenin tek yolu.
4. **Bildirim** (`badge`, `notify`): toolbar rozeti (aç/kapa) + "indirilebilir" duyurusu (kapalı / sayfa içi pill / sistem bildirimi) — **tek kontrol**, ayrı bir "pulse" anahtarı yok.
5. **İndirme** (`defaultVersion`, `zipAll`, `autoDownload`, `dragEnabled`): varsayılan versiyon (görüntülenen / son / sor) · menüde zip satırı (aç/kapa) · sürükle-bırak (aç/kapa — bazı kullanıcılar kazara sürüklemeyi sevmez) · otomatik indirme (aç/kapa, **varsayılan kapalı**).
6. **Kayıt yeri** (`saveTo`) — **sağlayıcı başına**: `Kayıt yeri · Claude: ~/Projects/artifacts` / `· ChatGPT: seçilmedi`. Handle origin'e bağlı olduğu için tek bir global seçim mümkün değil (§8.7.2); panel bunu gizlemek yerine adıyla gösterir.
7. **Dosya adı** (`nameTemplate`): şablon input + tıklanabilir token chip'leri + **canlı önizleme**.
8. **Siteler** (`sites`): dört sağlayıcı için aç/kapa. Kullanmadığın sağlayıcıda extension hiç çalışmasın diyebilmek, izin listesini daraltmasa da davranışı daraltır.
9. **Alt satır:** `🔒 Veri cihazdan çıkmıyor · dış istek yok` · `⏻ Bu sitede kapat` · `Teşhis bilgisini kopyala` · `Alt ⇧ D` (kısayol değiştirilmişse gerçek atanmış tuş `chrome.commands.getAll()` ile okunup gösterilir — yanlış tuş göstermek kullanıcıyı boşuna uğraştırır).

Gerekçeler: popup'ı açan çoğu insan ayar değil indirme için gelir → eylem üstte, ayarlar altta. Token'lı input'un klasik hatası kullanıcının çıktıyı tahmin edememesidir → canlı önizleme. Geri alınamayan davranış (otomatik indirme) varsayılan olmaz. Gizlilik cümlesi görünür, çünkü bu extension özel sohbetleri okuyor.

### 8.7 Stil izolasyonu, erişilebilirlik, dosya yazımı

**Shadow DOM.** Pill, toast ve versiyon menüsü bize ait tek bir `<div>`'e bağlı **shadow root** içinde çizilir. Sağlayıcının global CSS'i (Tailwind/Angular Material reset dahil) bizim kutularımızı yiyemez, bizim CSS'imiz de sayfayı kirletemez. İstisna: split buton, native görünmesi için sağlayıcının action bar'ının **içinde** durmak zorunda — shadow DOM'a alınamaz. Onun için `adl-` önekli sınıf adları ve gerekli her özelliğin açıkça yazılması (miras alınan değerlere güvenilmez).

**Erişilebilirlik.** Buton `role="button"` + `aria-label` (i18n) + `title`. Menü `role="menu"`, satırlar `role="menuitem"`; ok tuşlarıyla gezinilir, `Enter` seçer, `Esc` kapatır ve odağı butona geri verir. Odak halkası görünür bırakılır. Toast'lar `role="status"` (hata: `role="alert"`).

**Hareket.** `@media (prefers-reduced-motion: reduce)` altında nabız ve pill animasyonu iptal; pill yine görünür, sadece nabız atmaz. Badge nabzı da bu durumda tek karede sabitlenir.

**Yazım yönü.** Dört sağlayıcı da Arapça/İbranice arayüzde `dir="rtl"` çalışır; `right: 10px` ile sabitlenen pill ve menü yanlış tarafa düşer, hatta panel kenarından taşar. Konumlandırmada fiziksel değil **mantıksal** özellikler kullanılır (`inset-inline-end`, `padding-inline`, `margin-inline-start`). Maliyeti sıfır, sonradan düzeltmesi her kuralı tek tek gözden geçirmek demek.

**Dosya yazımı.** İçerik **birebir**, UTF-8, BOM yok, satır sonu dönüştürmesi yok, sona satır sonu eklenmez — kullanıcı modelin ürettiği baytı alır. `Blob` MIME'ı gerçek tipe göre verilir (`text/html`, `image/svg+xml`, kod için `text/plain;charset=utf-8`). Oluşturulan object URL indirme tetiklendikten sonra `URL.revokeObjectURL` ile serbest bırakılır.

**`tabs` izni neden yok.** Kısayol ve popup, hedef sekmeye `chrome.tabs.sendMessage(tabId, …)` ile ulaşır; `tabId`, popup için `chrome.tabs.query({active:true, currentWindow:true})`'den gelir. Bu çağrı `tabs` izni olmadan da sekme kimliğini döndürür — izin yalnızca `url`/`title` gibi alanları okumak için gerekir ve bize gerekmiyor. Content script yoksa `sendMessage` hata döner, sessizce yutulur ve kullanıcıya "bu sayfada indirilecek öğe yok" toast'ı gösterilir.

### 8.7.1 Sürükle-bırak

`↓` butonu `draggable`. Sürüklenince dosya doğrudan VS Code'a, Finder'a, Explorer'a bırakılabilir — indirilenler klasöründen geçmeden.

```js
e.dataTransfer.setData("DownloadURL", `${mime}:${filename}:${blobUrl}`)
```

**Tuzak: `dragstart` senkron.** Bu satırın çalıştığı anda içeriğin **hazır olması** gerekir; orada `await fetch(...)` yapılamaz. Sürükleme ancak versiyonlar zaten yüklenmişse mümkün.

Çözüm **hover ön-yükleme**: kullanıcı butonun üzerine geldiğinde (veya klavyeyle odaklandığında) fetch sessizce başlar. İnsan sürüklemeye başlamadan önce neredeyse her zaman fareyi butonun üstünde bir an tutar; o an bize yetiyor. Hazır değilse buton `draggable` olmaz — yarım dosya sürüklemektense sürüklenememek iyidir.

Sürüklenen versiyon: varsayılan versiyon (`defaultVersion` ayarı).

**`blobUrl` `dragend`'de serbest bırakılamaz.** `dragend` bizim tarafımızda, hedef uygulama blob'u **henüz okumamışken** tetiklenir; orada `revokeObjectURL` çağırmak dosyanın boş veya hiç oluşmamış hâlde düşmesine yol açar — üstelik hedefe göre değişir, yani "bende çalışıyor" diyen türden bir bug. Kural: URL `dragend`'de değil, **gecikmeli** (≥60 sn) veya sayfa/rota değişiminde serbest bırakılır. Tutulan blob birkaç yüz KB; sızıntı riski, bozuk bırakma riskinden küçük.

**Sürükleme tıklamayı yutmamalı.** `draggable` bir düğmede küçük fare kaymaları tıklamayı sürüklemeye çevirebilir ve indirme hiç tetiklenmez. Birincil eylem tıklamadır: sürükleme yalnızca eşiği aşan hareketle başlar, `dragstart` sağlayıcının kendi sürükleme işleyicilerine ulaşmasın diye `stopPropagation` yapar, ve manuel doğrulamada **tıklama ile sürükleme ayrı ayrı** denenir.

Hover ön-yükleme aynı zamanda tıklama gecikmesini de düşürür — feature'ın ikinci kazancı.

### 8.7.2 Klasöre kaydet (File System Access)

Ayarda `Kayıt yeri: Tarayıcı indirmeleri | Seçilen klasör`. İkincisi seçilince `showDirectoryPicker()` açılır, dönen `FileSystemDirectoryHandle` IndexedDB'de saklanır.

**Doğrulanacak (adım 1):** `showDirectoryPicker` content script'in isolated world'ünden çağrılabiliyor mu. Güvenli bağlam ve kullanıcı hareketi koşulları sağlanıyor, ama bu API'nin extension bağlamlarındaki davranışı sürüme göre değişebiliyor. Çağrılamıyorsa yedek yol: seçim, extension'ın kendi sayfasında (options) yapılır. Bu, feature'ın **tek gerçek varsayımı**; erken doğrulanmazsa geç ve pahalı çıkar.

**Handle nerede duruyor ve bunun bedeli.** `FileSystemHandle` `storage.sync`'e serialize edilemez ve `chrome.runtime` mesajlaşmasından geçmez; pratikte tek yer content script'in eriştiği IndexedDB, yani **o sağlayıcının origin'inin depolaması**. Üç sonucu var:

(a) **Klasör tercihi sağlayıcı başına ayrıdır.** Claude'da klasör seçmek ChatGPT'de geçerli olmaz — origin'ler ayrı, handle taşınamaz. Bu bir eksiklik değil, tarayıcı güvenlik modelinin sonucu; ama kullanıcı "bir kez seçtim, her yerde geçerli" bekler. Bu yüzden ayar satırı sağlayıcıyı adıyla söyler (`Kayıt yeri · ChatGPT: seçilmedi`) ve ilk indirmede o sitede seçim istenir. `docs/LIMITATIONS.md`'de de açıkça yazılır. Sessiz bir sürpriz bırakmıyoruz.

(b) Kullanıcı o sitenin verisini temizlerse klasör tercihi kaybolur — ayar `downloads`'a döner ve söylenir, sessizce indirilenlere kaymaz.

(c) Depolama sayfayla paylaşıldığı için oraya **yalnızca handle** konur, başka hiçbir kullanıcı verisi konmaz.

**Tuzak: izin oturumla birlikte solar.** Tarayıcı yeniden başlatıldığında handle duruyor ama yazma izni yok; `handle.requestPermission({mode:"readwrite"})` yeni bir **kullanıcı hareketi** ister. İndirme tıklaması bu hareketi sağlar, ama kullanıcı istemi reddedebilir veya kapatabilir.

Kural — üç kademeli davranış:
1. İzin zaten varsa → klasöre doğrudan yazılır, toast `✓ dosya · ~/Projects/artifacts`
2. İzin istenmeli ve verilirse → yazılır, aynı toast
3. İzin reddedilir/iptal edilirse → **normal tarayıcı indirmesine düşülür**, sarı toast: `Klasör izni yok, indirilenlere kaydedildi`

Hiçbir durumda "hiçbir şey olmadı" yok. Ayar kapatılmaz, kullanıcı bir sonraki indirmede yeniden izin verebilir.

Aynı adlı dosya varsa üzerine yazılmaz; `-2`, `-3` soneki eklenir. Tarayıcı indirmesinde bunu Chrome yapıyor; klasöre yazarken **biz** yapmak zorundayız, yoksa sessiz veri kaybı olur. Varlık kontrolü `getFileHandle(name)` ile yapılır — `NotFoundError` fırlatması adın **boş** olduğu anlamına gelir; `create:true` ile çağırmak dosyayı oluşturup kontrolü anlamsız kılar, o yüzden kontrol her zaman `create` olmadan yapılır.

### 8.8 İlk çalıştırma ve boş durumlar

Tasarımın buraya kadarki her ekranı **dolu durumu** gösteriyor. Gerçekte kullanıcının göreceği ilk şey boş durum.

**İlk kurulum.** `chrome.runtime.onInstalled` (`reason === "install"`) ayar sayfasını yeni sekmede açar: extension'ın ne yaptığı, butonun nerede belireceği (ekran görüntüsü), kısayol, gizlilik cümlesi. Tek seferlik. Güncellemede (`reason === "update"`) hiçbir şey açılmaz — kimse güncelleme başına sekme istemez.

Ayrıca **ilk kez indirilebilir bir öğe görüldüğünde** pill normalden farklı bir metinle çıkar: `● Buradan indirilir` ve 6 sn kalır. Tetikleyici panel değil öğedir — Gemini ve Perplexity'de panel hiç yoktur, panele bağlansaydı o sağlayıcılarda tanıtım hiç görünmezdi. Yalnızca bir kez; `storage` içinde `seenIntro` bayrağıyla.

**Popup'ın boş durumları.** §8.6'daki öğe listesi, öğe yokken şu hâlleri alır:

| Durum | Kart içeriği |
|---|---|
| Desteklenen bir sohbette değil | `Claude, ChatGPT, Gemini veya Perplexity'de bir sohbet aç` + dört bağlantı |
| Sohbette indirilecek öğe yok | `Bu sohbette indirilecek bir şey yok` + kısa açıklama |
| Öğe var, panel kapalı | `2 belge · 5 kod bloğu bulundu` + doğrudan `↓` (panel açmadan da indirilebilir; veri API'den ya da DOM'dan gelir) |
| Okuma başarısız | `Okunamadı` + `Tekrar dene` + `Neden?` (BREAKAGE.md'ye bakan kısa açıklama) |

Son satır bir tasarım kazancı: veri panelden değil API'den geldiği için **artifact indirmek için paneli açmak gerekmiyor.** Popup, kapalı paneldeki artifact'ları da listeleyebilir.

**Ama bu, açık artifact eşleştirmesini atlar.** §7 adım 5 hangi artifact'ın indirileceğini panelin başlığından çözüyor; panel kapalıyken böyle bir başlık yok. Popup akışı bu yüzden ayrı tanımlanır:

1. Popup açılır → content script'ten sohbetteki **öğe başlıkları** istenir (belge kartları + kod blokları + ekler; DOM, ağ yok)
2. Tek öğe varsa doğrudan seçilir; birden fazlaysa popup onları gruplu liste hâlinde gösterir (§8.6)
3. Kullanıcı birini seçince fetch + parse yapılır ve versiyonlar aynı popup içinde listelenir
4. İndirme content script'e devredilir (`<a download>` sayfa bağlamında çalışır, popup kapanınca iptal olmaz)

Yani panel açıkken kimlik **panelden**, kapalıyken **kullanıcının seçiminden** gelir. Belirsizlik hiçbir durumda tahminle kapatılmaz.

**Hiçbir boş durum sessiz olmaz.** Boş kart her zaman "neden boş" ve "ne yapmalı" söyler; kullanıcı extension'ın bozuk mu yoksa doğru mu çalıştığını ayırt edebilmeli.

**Acil durdurma.** Popup'ın altında `⏻ Bu sekmede devre dışı bırak` ve `⏻ Bu sitede devre dışı bırak` (sağlayıcı bazında kalıcı). Basıldığında content script tüm enjekte UI'ı kaldırır, observer'ı durdurur ve sayfa yenilenene kadar sessiz kalır. Ayrıca `storage`'da `disabled: true` ile kalıcı kapatma seçeneği.

Gerekçe: bir gün sağlayıcılardan birinde bir şey ters gidecek ve kullanıcı bunun bizden mi kaynaklandığını bilmeyecek. Extension'ı tamamen kaldırmadan iki saniyede kapatabilmek, hem kullanıcının hem bizim lehimize — çünkü "kapattım, düzeldi" bize teşhis verir, "kaldırdım" vermez.

### 8.9 Teşhis — telemetri olmadan hata raporu

Telemetri yok (§17), dolayısıyla bir şey bozulduğunda bunu **yalnızca kullanıcı anlatabilirse** öğreniriz. "Çalışmıyor" mesajı ise tamir için yetersizdir.

Popup'ın alt satırında **Teşhis bilgisini kopyala** bağlantısı: panoya, hassas veri içermeyen bir metin bloğu yazar.

```
AI Chat Downloader 1.0.0 · Chrome 141 · tr
Sağlayıcı: chatgpt · adaptör LAST_VERIFIED 2026-09-09
Kademe: 3 (DOM)            ← hangi kaynak kullanıldı
Org çözümü: cookie ✓        ← adaptöre özel satırlar; her adaptör kendi teşhis alanlarını ekler
Konuşma isteği: 404
SEL: panel ✓ · actionBar ✓ · codeBlock ✗ · versionIndicator ✗
Son hata: TypeError: ... (ilk satır)
```

**İçinde ne yok:** konuşma metni, öğe içeriği, öğe başlığı, konuşma/org UUID'si, kullanıcı adı, e-posta, URL. Yalnızca hangi kademenin çalıştığı, hangi selector'ın tuttuğu, hata tipi.

Bu blok bir GitHub issue'ya yapıştırılabilir ve `docs/BREAKAGE.md`'deki tanı tablosuyla doğrudan eşleşir. Sıfır telemetriyle, gerçek bir hata raporu.

## 9. Ayar şeması

`chrome.storage.sync`, tek anahtar `cfg`:
```js
{
  badge: true,               // toolbar rozeti + nabız
  notify: "inpage",          // "indirilebilir" duyurusu: "off" | "inpage" (pill) | "system"
  autoDownload: false,
  defaultVersion: "current", // "current" | "latest" | "ask"
  nameTemplate: "{title}-v{version}",  // {title} {version} {date} {ext}
  zipAll: true,              // menüde "tüm versiyonlar → zip" satırı
  saveTo: "downloads",       // "downloads" | "folder"  (§8.7.2)
  kinds: { artifact:true, code:true, attachment:true },  // hangi öğe türleri gösterilsin
  sites: { claude:true, chatgpt:true, gemini:true, perplexity:true },  // sağlayıcı bazında kapatma
  dragEnabled: true          // §8.7.1
}
```
Eksik alanlar okuma anında varsayılanla doldurulur (şema evrimi için migration gerekmez).

**`cfg` dışında kalan durum, ayrı ve bilinçli.** `seenIntro` (tanıtım pill'i gösterildi mi) ve sekme bazlı geçici kapatma **ayar değildir** — kullanıcı tercihi değil, uygulama durumudur; `cfg`'ye konursa ayar panelinde bir karşılığı olması gerekirdi (§8.6 kuralı) ve orada gösterilecek bir şey yok. Bunlar `storage.local` altında ayrı anahtarlarda tutulur. Site bazında kalıcı kapatma ise gerçek bir tercihtir ve `cfg.sites` içindedir — §8.8'deki "kalıcı kapatma" tam olarak o anahtarı yazar, ayrı bir `disabled` alanı **yoktur**.

`storage.sync` kurumsal politikayla kapatılmış veya kotası dolmuş olabilir; yazma hatasında sessizce `storage.local`'a düşülür. Ayar kaybetmek, senkronizasyon uğruna ödenecek bir bedel değil.

`notify: "system"` seçildiğinde `chrome.permissions.request(["notifications"])` **o an** çağrılır. Kullanıcı reddederse segment sessizce `"inpage"`e döner ve bir kez bilgi toast'ı gösterilir.

## 10. Mesajlaşma protokolü

content → sw:
```js
{ type: "items:present", docs, code, attachments }  // badge yalnızca docs sayar (§8.5)
{ type: "items:none" }                              // badge temizle
{ type: "notify", level, title, body }              // sistem bildirimi (izin varsa)
```
sw → content:
```js
{ type: "cmd:download" }                     // Alt+Shift+D — odaktaki öğe, yoksa açık belge
{ type: "cfg:changed", cfg }
```
panel → content (aktif sekme):
```js
{ type: "items:list" }                       // DOM'dan öğe başlıkları, ağ yok (§8.8)
{ type: "item:versions", key }               // fetch + parse, versiyonları döner
{ type: "item:download", key, version|"zip" } // key ZORUNLU — versiyon tek başına öğeyi belirlemez
{ type: "zip:conversation" }                 // sohbetteki tüm öğeler (§8.2.1)
{ type: "diag:get" }                         // teşhis bloğu (§8.9)
{ type: "site:disable", scope: "tab"|"site" } // acil durdurma (§8.8)
```

Kısayolun adı protokolde geçmez; `sw.js` `chrome.commands` olayını `cmd:download`'a çevirir. Kısayol değişirse protokol değişmez.

## 11. Hata matrisi

| Durum | Davranış |
|---|---|
| `/api/organizations` 401/403 | Kademe 3 (DOM) + sarı toast |
| Konuşma JSON şeması tanınmadı | Kademe 2 → boşsa Kademe 3 + sarı toast |
| Hiç öğe parse edilemedi | Kademe 3 |
| `old_str` eşleşmedi | Versiyon `⚠ kısmi`, indirilebilir, ad `-partial` |
| Açık artifact eşleşmesi belirsiz | Menüde adayların hepsi gösterilir |
| DOM da okunamadı | Kırmızı toast (kalıcı) + `console.error`, **indirme yok** |
| ZIP > 100 MB | Uyarı, yine de dener; 65535 girdi / 4 GB sınırında ise üretilmez (§6) |
| Bildirim izni reddedildi | `notify` → `"inpage"`, bilgi toast'ı |
| Klasör yazma izni reddedildi/iptal | Tarayıcı indirmesine düşülür + sarı toast (§8.7.2) |
| Seçilen klasör silinmiş/erişilemez | Handle atılır, ayar `downloads`'a döner, kullanıcıya söylenir |
| Klasörde aynı adlı dosya var | `-2`, `-3` soneki — üzerine **yazılmaz** |
| Sürükleme hazır değilken başlatıldı | Buton `draggable` olmaz; hover ön-yüklemesi bitince olur |
| Sohbet zip'inde şüpheli artifact var | Arşive girer, adı `-partial`, toast kaç tanesi olduğunu söyler |
| Sağlayıcının site verisi temizlendi | O sitedeki klasör handle'ı kayboldu; ayar `downloads`'a döner ve **kullanıcıya söylenir** |
| `showDirectoryPicker` content script'te yok | Seçim options sayfasına taşınır (adım 1'de doğrulanır) |
| Sürükleme tıklamayı yuttu | Eşik altı hareket tıklama sayılır; sürükleme eşiği aşınca başlar |
| Adaptör `Item[]` doğrulamasından geçemedi | O adaptör devre dışı, teşhise yazılır, diğerleri çalışır (§3.4.3) |
| Sağlayıcıda yetenek yok | Kontrol hiç çizilmez — gri/pasif kontrol de gösterilmez |
| Ek indirme endpoint'i bulunamadı | Ekler o sağlayıcıda kapsam dışı; UI'da hiç söz edilmez |
| Ek ikili dosya | `ArrayBuffer` olarak yazılır; metin dönüşümüne **sokulmaz** |
| Kademe 1 ile DOM %5'ten fazla ayrışıyor | İndirme engellenmez; sarı toast + teşhise yazılır (§4.1) |
| Konuşma endpoint'i pencereliyor | Sayfalama; mümkün değilse en eski versiyonlar `⚠ erişilemedi` |
| Enjeksiyon React'i çökertiyor | Plan B: buton `body`'ye bağlı hizalı katman olur (§7 adım 2) |
| Kademe 2 gövdesinde artifact işareti kalıntısı | Versiyon `ok:false`, `reason:"tier2_ambiguous"` |
| `old_str` satır sonu farkından tutmuyor | Mismatch raporlanır; içerik **normalize edilmez**, BREAKAGE.md ilk tanı maddesi |
| Boş gövdeli `create` | Geçerli; 0 baytlık dosya iner |
| Numaralarımız panelin göstergesiyle tutmuyor | `v` etiketi bırakılır, sıra + zaman damgası kullanılır (§8.2) |
| Ardışık iki versiyon birebir aynı | Menüde `değişiklik yok` etiketi; ikisi de indirilebilir kalır |
| `<a download>` sonrası dosya yazılmadı | Öğrenilemez; toast bu yüzden "indiriliyor" der, "indirildi" demez |
| `old_str` gövdede 2+ kez geçiyor | Versiyon `⚠ kısmi`, `reason:"old_str_ambiguous"` |
| Aktif dal çıkarılamadı (`parent_message_uuid` zinciri kopuk) | En yeni `created_at`'li yaprak seçilir + sarı toast |
| Kısayol basıldı, öğe yok | `! Bu sayfada indirilecek öğe yok` toast'ı |
| Content script yüklenmemiş sekmede kısayol | Sessiz no-op (hata yutulur) |

İlke: bozuk dosya vermektense hiç dosya vermemek.

## 12. DOM bağımlılık katmanı

Bir sağlayıcıya ait **tüm** selector'lar, o adaptörün dosyasındaki tek `SEL` objesinde. `content.js` hiçbir sağlayıcı seçicisi içermez — içerirse adaptör yalıtımı (§3.4.3) delinir ve bir sağlayıcının değişimi çekirdeği tamir etmeyi gerektirir:
```js
// Bu sağlayıcının arayüzü değişirse SADECE burası güncellenir.
const SEL = { chatRoot,                                  // olay delegasyonu + gezici düğme kapsayıcısı
              panel, panelTitle, actionBar, docCard,      // docCard → badge sayımı (§8.5)
              codeBlock, codeLang,                        // common-dom.js override noktası
              versionIndicator, codeTab, streamIndicator,  // akış tespiti (§3.2)
              attachmentChip };                           // capabilities.attachments ise
```
Bu bir anti-corruption layer. Üçüncü parti DOM'a bağımlı her extension eninde sonunda kırılır; soru kırılıp kırılmayacağı değil, tamirin 1 dosya mı 10 dosya mı olduğu.

Her selector için `null` toleransı: bulunamayan selector exception atmaz, kademe düşürür.

**Selector'lar metne bağlanamaz.** Dört sağlayıcının arayüzü de yerelleştirilmiştir; `[aria-label="Copy"]` veya "Preview" yazısını arayan bir selector, arayüzü Türkçe olan kullanıcıda **sessizce çalışmaz** — ve extension'ı yazan kişi kendi arayüzü İngilizceyse bunu asla göremez. Kural: yalnızca yapısal ve dilden bağımsız işaretler (DOM hiyerarşisi, `data-*`, `role`, ikon `svg` yapısı). Metin eşleştirme yasak. Doğrulama: her sağlayıcının arayüzü Türkçeye alınıp tüm akış tekrar denenir.

**Tema.** Dört sağlayıcının da açık teması var; koyu tema varsayan enjekte UI, açık temada okunmaz bir leke olur. Renkler sabit yazılmaz: sağlayıcının kendi hesaplanmış arka plan ve metin rengi okunup CSS değişkenlerine (`--adl-bg`, `--adl-fg`, `--adl-line`) yazılır. Böylece hangi sağlayıcı temayı hangi mekanizmayla değiştirirse değiştirsin (class, `data-*`, `prefers-color-scheme`) peşinden geliriz — ve dördü için ayrı renk tablosu tutmak gerekmez. Vurgu rengi (#d97757) her iki temada da kontrast sağladığı için sabit kalır.

### 12.1 DOM'dan metin okuma kuralları

Sanallaştırma (§4) tek tuzak değil. DOM bir **görüntüleme katmanı**; kodu okunur kılmak için yaptığı her şey, onu veri olarak okuyan için bir bozulma kaynağı. Dördü de gerçek ve dördü de sessiz:

**1. Kod düğümünün içinde UI parçaları olabilir.** Satır numarası sütunu, "Kopyala" düğmesi, dil etiketi — sağlayıcıya göre `pre`'nin **içine** konabilir. `pre.textContent` bunları da alır ve dosyanın başına `1 2 3 …` ya da ortasına `Kopyala` yazar. Kural: metin, `SEL.codeBlock`'un işaret ettiği **kod düğümünden** okunur ve o düğümün altındaki UI çocukları (`button`, `[role="button"]`, satır numarası gutter'ı, dil rozeti) okumadan önce **klonlanmış** bir kopyadan çıkarılır. Sayfanın kendi DOM'una dokunulmaz — klon üzerinde çalışılır.

**2. `innerText` değil, `textContent`.** `innerText` CSS'e tabidir: `text-transform: uppercase` uygulanmış bir tema kodu büyük harfe çevirir, gizli düğümleri atlar, boşlukları normalleştirir. `textContent` ham metni verir. Bu, tercih değil kuraldır.

**3. Sıfır genişlikli karakterler.** Bazı arayüzler satır kaydırma için `<wbr>` ya da U+200B ekler; `textContent` onları da taşır ve kod **görünmez biçimde** bozulur — derleyici hata verir, kullanıcı sebebini göremez. Kural: DOM kademesinde U+200B, U+200C, U+FEFF temizlenir. Kademe 1/2'de **temizlenmez** — orada içerik ham gelir ve o karakterler gerçekten kodun parçası olabilir. Temizlik, bozulmanın kaynağına özgüdür.

**4. Katlanmış / "daha fazla göster" bloklar.** İçerik CSS ile kırpılmışsa `textContent` tamdır, sorun yok; DOM'dan çıkarılmışsa bu §4'teki sanallaştırma kuralının aynısıdır ve aynı tamlık kanıtı aranır.

Bu dört kural `common-dom.js`'te tek bir `readCodeText(node)` fonksiyonunda toplanır — dört sağlayıcı ve hem kod blokları hem Kademe 3 aynı yolu kullanır. Ayrı ayrı yazılırsa biri eksik kalır.

**Preview modunda DOM okuma.** Kademe 3'e düşüldüğünde kod yalnızca Code sekmesinde bulunur. Sekmeyi programatik tıklamak kullanıcının görünümünü değiştirir — bu bizim değil onun tercihi. Kural: mevcut sekme kaydedilir, Code'a geçilir, metin okunur, **eski sekme geri yüklenir**. Kullanıcı ideal olarak kısa bir titreme dışında hiçbir şey görmez. Preview'da başlamışsa ve okuma başarısızsa yine de eski sekmeye dönülür (`try/finally`).

## 13. i18n

`_locales/en` (**default**, manifest'teki `default_locale` ile aynı olmak zorunda — §5) + `_locales/tr`. Tüm kullanıcıya görünen metin `chrome.i18n.getMessage()` üzerinden. Sabit metin yasak — sonradan i18n eklemek acılıdır, Web Store için de gerekli.

## 14. Test

`node selftest.js`, framework yok, assert tabanlı.

**Adaptör uyumluluk paketi.** Tek bir test paketi, her adaptörün `parse()` çıktısına karşı koşar: `Item` zorunlu alanları dolu mu, `kind` geçerli mi, `ext` nokta ile başlıyor mu, `versions` boş değil mi, `title` sanitize edilebiliyor mu. Yeni adaptör eklemek = fixture ekleyip aynı paketi koşturmak. Adaptörler farklı, sözleşme tek.

**Fixture'lar sözleşmeyi sabitler.** Testlerin tamamı elle yazılmış girdilerle çalışırsa, sağlayıcıların gerçek yanıt şeması değiştiğinde hepsi yeşil kalır ve extension sahada bozulur. Bu yüzden `test/fixtures/<sağlayıcı>/` altına **gerçek konuşmalardan alınmış, kişisel içeriği temizlenmiş** örnekler commit'lenir (API'si olanlarda JSON, DOM-only olanlarda HTML parçası): tek artifact, çok versiyonlu artifact, dallanmış konuşma, aynı başlıklı iki artifact, akış hâlinde yarım artifact — ve her sağlayıcı için: çok kod bloklu mesaj, dili belirtilmemiş blok, üç satırdan kısa blok, fence'te dosya adı taşıyan blok, ek kaydı. Adaptörlerin `parse()`'ı bunların hepsine karşı koşar.

Kazanç: bir sağlayıcı şemayı değiştirdiğinde yapılacak iş "yeni bir konuşmayı dump'la, fixture'ı değiştir, testin nerede kırıldığına bak" olur. Şema değişimi gizemden **kırmızı teste** iner. Fixture'lar temizlenmeden commit'lenmez — içlerinde konuşma metni, kullanıcı adı, org UUID'si kalmaz.

**parse.js**
- `parseOps`: structured `tool_use` formu; ham `<antArtifact>` formu; ikisinin karışımı; attribute sırası karışık; gövdede nested backtick ve `<` karakterleri
- `activeBranch`: düzenlenmiş mesaj yüzünden dallanmış ağaçta yalnızca aktif dalın op'ları toplanır; terk edilmiş daldaki `update` replay'e **karışmaz**; kopuk zincirde en yeni yaprağa düşüş; op sırası `created_at` geriye gitse bile dal konumunu takip eder
- `readCodeText`: gutter/kopyala düğmesi içeren blokta yalnızca kod döner; U+200B temizlenir; `text-transform` uygulanmış temada büyük/küçük harf korunur
- `sanitize` güvenlik kolu: `../../etc/passwd` ve `~/x` yol bileşenlerini kaybeder; `<img onerror=x>` başlığı dosya adında zararsız metne iner
- `buildVersions`: create→update→rewrite→update replay doğruluğu; `old_str` bulunamayınca `ok:false` ve içeriğin bozulmaması; `old_str` 2+ kez geçince `ok:false` + `old_str_ambiguous`; tek `create` → tek versiyon; versiyonlar arası başlık değişiminin dosya adına yansıması
- `extFor`: react+tsx → `.tsx`; react+jsx → `.jsx`; text/html → `.html`; mermaid → `.mmd`; svg → `.svg`; code+python → `.py`; bilinmeyen → `.txt`
- `sanitize`: `a/b:c*?"<>|` temizliği; `CON` → `_CON`; 200 karakterlik başlık → 120 cap; sadece `...` → `kind`'e göre yedek ad; **emoji'li başlık kırpılınca yarım surrogate kalmıyor**; çok baytlı başlıkta 200 baytlık sınır önce doluyor
- `fmtName`: her token, eksik token, bilinmeyen token literal kalır

**zip.js**
- `CRC32("hello") === 0x3610a686`
- local header imzası `0x04034b50`, EOCD imzası `0x06054b50`
- 2 girişli zip'te central directory offset'i local header'ların toplam boyutuna eşit
- **Türkçe adlı + emoji içerikli girdide tüm boyut alanları `byteLength`'e eşit, karakter sayısına değil** — bu test olmadan çok baytlı içerikte sessizce bozuk arşiv üretilir
- general purpose bit 11 (UTF-8 flag) set

Manuel doğrulama listesi — **dört sağlayıcıda ayrı ayrı koşulur**; sağlayıcıda o yetenek yoksa satır "uygulanamaz" olarak işaretlenir, atlanmaz. Ek olarak her sağlayıcıda: kod bloğu gezici düğmesinin doğru bloğa hizalanması, üç satırdan kısa blokların kontrol almaması, ad türetme zincirinin dört basamağının da denenmesi, ek indirmenin ikili dosyayı bozmaması, ve klasör tercihinin sağlayıcı başına ayrı sorulması. Claude'a özgü liste: gerçek 3 versiyonlu React artifact; tek versiyonlu markdown; SVG; mermaid; çok uzun (>500 satır) HTML; aynı başlıklı iki artifact; oturum kapalıyken fallback; **mesaj düzenlenip dallanmış konuşma**; iki claude.ai sekmesi açıkken badge'lerin karışmaması; React yeniden render'ından sonra butonun hâlâ orada olması; Preview modundayken fallback sonrası sekmenin geri gelmesi; `prefers-reduced-motion` açıkken animasyonsuz çalışma; klavyeyle menü gezinme; **uzun bir yanıt akarken Performance profili** (extension'ın CPU payı ölçülebilir olmamalı); `{date}` şablonunun `en-US` yerelinde de ISO üretmesi; teşhis bloğunun içinde konuşma verisi bulunmaması; **Claude yazarken indirip akış bitince tekrar indirmek** (ikinci dosya tam olmalı); panel kapalıyken popup'tan indirme; iki artifact'lı sohbette popup'ın seçim listesi; **butonu VS Code'a sürükleyip bırakmak** (hover etmeden ve hover ederek); klasör seçip tarayıcıyı kapatıp açtıktan sonraki ilk indirme (izin istemi + reddedince fallback); klasörde aynı adlı dosya varken indirme; 4 artifact'lı sohbetin zip'i; **sürüklenen dosyanın hedefte tam açılması** (blob erken serbest bırakılmamalı); aynı butonda tıklama ve sürüklemenin ayrı ayrı çalışması; `defaultVersion:"ask"` iken butonun tek parça olması; **eski bir sohbeti açmanın hiç sinyal üretmemesi**; **buton enjekte edilmişken art arda render tetikleyip React hatası aranması** (versiyon değiştir, paneli yeniden boyutlandır, yeni mesaj gönder, sekme değiştir); gövdesinde `</antArtifact>` geçen bir artifact'ın tam inmesi; popup'tan devre dışı bırakma; **dokunmatik ekranda kod bloğu indirme** (hover yokken düğme erişilebilir mi); %200 tarayıcı yakınlaştırmasında hizalanan katmanların kayması; **menüdeki numaraların panelin "Version N" göstergesiyle karşılaştırılması**; **Kademe 1 çıktısının sağlayıcının kopyala düğmesiyle bayt bayt karşılaştırılması**; 200+ mesajlık sohbette API'nin tüm mesajları döndürmesi; aynı artifact'ı iki kez indirip adların ayrışması; DOM fallback'inde `{version}` yerine tarih gelmesi; **↓'ye basıp yanıt gelmeden başka sohbete geçmek** (yanlış dosya inmemeli); hızlı çift tık (tek dosya inmeli); otomatik indirme açıkken Claude artifact yazarken (akış bitene kadar dosya inmemeli); menü açıkken panelin kapanması; **extension'ı yeniden yükleyip eski sekmeye dönmek** (konsol temiz kalmalı, UI kendini kaldırmalı); ilk kurulumda ayar sekmesinin açılması; claude.ai dışında popup'ın boş durumu.

## 15. Chrome Web Store teslimatları

`store/` klasöründe:
- **Gizlilik politikası** (TR+EN): hangi veriye erişiliyor (dört sağlayıcıdaki konuşma içeriği, yalnızca kullanıcının kendi oturumunda), nereye gidiyor (**hiçbir yere** — dış istek yok, telemetri yok, analytics yok), ne saklanıyor (sadece ayarlar, `storage.sync`)
  **Web Store bunu dosya olarak değil, herkese açık bir URL olarak ister.** Depodaki markdown yeterli değil; politika GitHub Pages (veya eşdeğeri) üzerinden yayımlanıp URL mağaza formuna girilir. Bu, yayın öncesi ayrı bir iş kalemidir ve unutulursa listeleme reddedilir
- **Listing metinleri** TR+EN: kısa açıklama (132 char), uzun açıklama, "single purpose" beyanı,
  Uzun açıklamanın **ilk paragrafı** Chrome'un kurulumda gösterdiği "bu sitelerdeki verilerinizi okuyabilir ve değiştirebilir" uyarısını karşılar: neden bu izne ihtiyaç olduğu (sohbeti okumadan indirilecek şey bulunamaz), verinin nereye gitmediği, ve tek amaç. Bu uyarı kaçınılmaz; açıklanmazsa kurulum oranını ve güveni o düşürür izin gerekçeleri (`storage` → ayarlar; dört host izni → sohbet içeriğini okuma, her biri ayrı gerekçelendirilir; `notifications` → opsiyonel, kullanıcı açarsa)
- **Ekran görüntüsü şablonları** (1280×800, 5 adet): split buton + versiyon menüsü (Claude), kod bloğu gezici düğmesi (ChatGPT), popup'ın öğe listesi, zip/klasör toast'ı, ayar paneli. En az iki farklı sağlayıcı görünmeli — listelemede "dört sağlayıcı" iddiası görselle desteklenmezse inceleme sorar
- 128px mağaza ikonu, 440×280 küçük promo

Web Store incelemesinin en sık takıldığı yer geniş host izni ve "neden bu veriye ihtiyacın var" sorusudur. Tek amaç beyanı ve dış istek olmaması bunu doğrudan karşılıyor.

**Ekran görüntülerinde gerçek sohbet kullanılmaz.** Beş görselin tamamı, bu iş için açılmış **demo bir konuşmadan** üretilir. Aksi hâlde kendi özel verini kalıcı olarak halka açık bir mağaza sayfasına koymuş olursun — geri alınmaz, indekslenir.

**İsim ve marka — artık dört marka.** İsim hiçbir sağlayıcının markasıyla başlamaz ve hiçbirinin resmî ürünü olduğunu ima etmez; `AI Chat Downloader` gibi tarafsız bir ad, açıklamada "Anthropic, OpenAI, Google ve Perplexity ile bağlantısı yoktur" satırıyla. Dört marka, dört kat ihlal yüzeyi. Sağlayıcı adları yalnızca **tanımlayıcı** konumda geçer ("Claude, ChatGPT, Gemini ve Perplexity destekler"). Logo hiçbir sağlayıcının işaretini andırmaz (§8.5). İkonda ve isimde marka taklidi, incelemede en hızlı ret sebeplerinden.

## 16. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| **Dört sağlayıcının bakımı** — her biri arayüzünü bağımsız değiştirir | Herhangi bir anda bir veya birkaç adaptör bozuk olabilir | Kabul edilmiş risk (§1). Sınırlayıcılar: adaptör yalıtımı (biri bozulunca diğerleri çalışır, §3.4.3) · sağlayıcıdan bağımsız DOM tabanı (değerin çoğu tek kod yolunda, §3.4.1) · adaptör başına uyumluluk testi · bozuk yeteneğin sessizce değil **açıkça** kapanması · sağlayıcı bazında `docs/BREAKAGE.md` girdisi |
| Bir sağlayıcının dahilî API'si bulunamaz/değişir | O sağlayıcıda versiyon/toplu erişim kaybolur | DOM kademesi zorunlu; ürün yetenek kaybederek ayakta kalır |
| Sağlayıcının bot/otomasyon koruması dahilî API çağrısını engeller | İstek 403 döner, kullanıcı oturumu etkilenebilir | **Kural: sayfanın kendisinin atmayacağı hiçbir istek atılmaz** — hız sınırı zorlanmaz, arka planda tarama yapılmaz, istek yalnızca kullanıcı eylemiyle ve kullanıcının zaten baktığı konuşma için atılır. Şüphe varsa o sağlayıcıda API kademesi hiç açılmaz, DOM tabanı kullanılır |
| Sağlayıcı DOM'u değişir | Buton enjekte edilemez | Adaptörün `SEL` katmanı, tek dosyada tamir |
| Konuşma API şeması değişir | Versiyon geçmişi kaybolur | Üç kademeli fallback, DOM her zaman çalışır |
| `tool_use` şeması varsayımı yanlış | Parser boş döner | Implementation'ın **ilk adımı** gerçek JSON dump'ı ile şema doğrulama |
| Web Store geniş host iznini sorgular | Yayın gecikir | Tek amaç beyanı + sıfır dış istek + gizlilik politikası hazır |
| Çok uzun konuşmada fetch yavaş | Buton geç yanıt verir | Cache + buton üzerinde yükleniyor durumu |
| Bir sağlayıcı dahilî API'sinin kullanımına itiraz eder | Yayın kaldırılabilir | Yalnızca kullanıcının kendi oturumu, kendi verisi, kendi tarayıcısı; hız sınırı zorlanmıyor, sunucu yok (üstteki bot-koruması satırıyla aynı kural). Yine de bir ürün riski — DOM tabanı extension'ı API olmadan da ayakta tutar |
| Kullanıcı birden fazla organizasyona üye | Yanlış org → 404 → sessiz fallback | `lastActiveOrg` + org'ları sırayla deneme (§4) |
| Sağlayıcı arayüzü Türkçe/başka dilde | Metne bağlı selector çalışmaz | Metin eşleştirme yasak (§12) |
| Kullanıcı açık temada | Enjekte UI okunmaz | Renkler panelden okunuyor (§12) |

---

## 17. Güvenlik

Bu extension iki tür **güvenilmez veri** işliyor: öğe başlıkları ve öğe içerikleri (artifact/canvas, kod bloğu, ek). Hepsi model çıktısı ya da yüklenmiş dosyadır; kullanıcı sohbete başkasının metnini yapıştırmışsa saldırgan etkisindedir.

| Kural | Neden |
|---|---|
| Öğe kaynaklı hiçbir string `innerHTML`/`insertAdjacentHTML` ile DOM'a yazılmaz — **yalnızca `textContent`** | Başlık `<img onerror>` taşıyabilir. Enjeksiyon sağlayıcının sayfasının DOM'una olur; oturum çerezlerinin yanına XSS koymuş oluruz. Menü satırları, toast'lar, pill, popup başlığı — hepsi `textContent` |
| Öğe içeriği **asla render/eval edilmez** | HTML belgesini önizlemek bizim işimiz değil; sadece bayt olarak diske yazılır |
| `window.addEventListener("message", …)` **yok** | Sayfa `postMessage` ile bizim ayrıcalıklı çağrılarımızı sürükleyebilirdi. İletişim yalnızca `chrome.runtime` / `chrome.tabs` üzerinden |
| `externally_connectable` **tanımlanmaz** | Varsayılan "hiç kimse". Başka sitelerin extension'a mesaj atması kapalı |
| Uzak kod **yok**: CDN yok, `eval` yok, `new Function` yok, uzaktan yüklenen script yok | Web Store uzak kodu doğrudan reddediyor. Tüm kod paket içinde |
| `panel.html` inline `<script>`/`onclick` içermez | MV3 varsayılan CSP inline script'i bloklar; sessiz bozulma olur |
| `sanitize` yol geçişini de keser: `/` `\` `..` ve baştaki `~` temizlenir | `<a download="../../x">` denemesi. Chrome zaten yol bileşenlerini yok sayar ama savunma bizde de olmalı |
| Ağa **hiç** çıkılmaz; `fetch` hedefleri yalnızca dört sağlayıcının kendi origin'i | Gizlilik politikasının doğrulanabilir olması için; CI'daki ağ taraması bunun teknik dayanağı (§19.3) |

### 17.1 Yayıncı hesabı — asıl tedarik zinciri

Bu projenin bağımlılığı yok (§5), yani klasik tedarik zinciri saldırı yüzeyi neredeyse sıfır. Ama **gerçek tedarik zinciri npm değil, Web Store yayıncı hesabıdır.** O hesabı ele geçiren kişi, kullanıcının özel sohbetlerini okuma iznine sahip bir extension'ı **mevcut tüm kurulumlara sessizce** gönderir; Chrome güncellemeyi otomatik uygular ve kullanıcı hiçbir şey görmez. Kodun temiz olması bunu engellemez.

Kural:
- Yayıncı hesabında **passkey veya donanım anahtarı** zorunlu; SMS 2FA kabul edilmez
- Hesap erişimi asgari kişide; ayrılan kişinin erişimi aynı gün kaldırılır
- CI'ya yayın yetkisi verilmez. Paketi CI üretir, **yükleme insan eliyle** yapılır — otomatik yayın, çalınan bir CI token'ını doğrudan kullanıcıya bağlar
- Yayınlanan her paketin SHA-256'sı `CHANGELOG.md`'de (§19.4); mağazadaki paketin depodaki commit'ten üretildiği üçüncü kişilerce doğrulanabilir
- Extension'ın kendi güncelleme kanalı yok; tek dağıtım yolu mağaza

### 17.2 Gizlilik taahhütleri — değişmez sayılanlar

Aşağıdakiler mağaza beyanının ve kullanıcı güveninin **taşıyıcı** unsurlarıdır. Bir feature bunlardan birini bozuyorsa, feature reddedilir ya da yeni ve açık bir onay akışıyla gelir; sessizce genişletilmez:

1. Dış origin'e hiçbir istek yok (§19.3 kapı 8 bunu korur)
2. Telemetri, analytics, hata raporlama servisi yok
3. Konuşma içeriği yalnızca bellekte; diske **yalnızca kullanıcının açıkça indirdiği dosya** yazılır
4. `storage`'da yalnızca ayarlar; IndexedDB'de yalnızca klasör handle'ı
5. Teşhis bloğu konuşma verisi taşımaz (§8.9)

Gelecekte "buluta yedekle", "sohbetlerini ara", "kullanım istatistiği" gibi istekler gelecek. Bu liste, o anda tartışmanın nereden başlayacağını bugünden sabitliyor — çünkü gizlilik taahhüdü bir kez sessizce bozulduğunda geri kazanılmıyor.

**Kötüye kullanım notu.** "Sohbetteki tüm öğeler → zip", kısa süreli fiziksel erişimi olan birinin oturumu açık bir tarayıcıdan hızlıca veri toplamasını kolaylaştırır. Bunu extension'a özgü bir açık saymıyoruz — aynı veriye tarayıcı zaten erişiyor ve kopyala-yapıştır ile de alınır — ama tehdit modelinde yazılı durması, ileride "otomatik tüm sohbetleri indir" gibi bir isteğe verilecek cevabı kolaylaştırır: o özellik toplu veri çıkarmayı **niteliksel olarak** kolaylaştırır ve §2'deki hedef-olmayanlar listesinde kalır.

## 18. Depo teslimatları

- `LICENSE` — MIT
- `README.md` — ne yapar, kurulum (unpacked + Store linki), ayarlar tablosu, `node selftest.js`
- `docs/BREAKAGE.md` — **kırılma runbook'u**, sağlayıcı başına bölüm: belirti → tanı → tamir. "Buton görünmüyor" → `SEL.actionBar` tut(a)mıyor, DevTools'ta yeni seçiciyi bul, `SEL`i güncelle, sürüm bump. "Versiyonlar tek satır" → API kademesi düştü, Network sekmesinde konuşma isteğinin durumuna bak (401 → oturum, 404 → org çözümü, 200 ama boş → şema değişti, `parseOps` testlerini gerçek JSON'la güncelle). Bu dosya olmadan extension'ı altı ay sonra ben de tamir edemem
- `CHANGELOG.md` — sürüm notları + her sürümün paket SHA-256'sı (§19.4)
- `docs/LIMITATIONS.md` — kullanıcıya açık bilinen sınırlar (§19.9)
- `docs/SMOKE.md` — aylık smoke test listesi, sonuçlar commit'lenir (§19.8)
- `tools/pack.mjs` — mağaza zip'i üretir, dev dosyalarını hariç tutar
- `tools/check-invariants.mjs` — §19.3'teki mekanik kapılar (8-13); npm bağımlılığı yok
- `tools/check-spec.mjs` — §19.3 kapı 14; spec'in kendi tutarlılığı
- `.github/workflows/ci.yml` — §19.3'ün yedi kapısı
- `.github/ISSUE_TEMPLATE/bug.yml` — teşhis bloğu zorunlu alan (§19.9)
- `.gitignore` — `.superpowers/`, `node_modules/`, `*.zip`

## 19. Production readiness

Buraya kadarki bölümler **ne inşa edileceğini** anlatıyor. Bu bölüm **yayınlanabilir sayılmak için** gerekenleri anlatıyor.

### 19.1 Tarayıcı desteği

`minimum_chrome_version` manifest'te açıkça belirtilir. Taban, kullanılan API'lerin en yüksek gereksinimi olarak adım 1'de hesaplanır; başlangıç varsayımı **116** (MV3 service worker davranışları, `showDirectoryPicker`, `structuredClone`, `Intl.RelativeTimeFormat` bu sürümde stabil). Gereğinden yüksek bir taban kullanıcı keser, düşük bir taban sessiz bozulma üretir — bu yüzden tahminle değil, kullanılan API listesiyle belirlenir.

Chromium tabanlı Edge/Brave/Opera çalışır ama **test edilmez ve iddia edilmez**. Firefox kapsam dışı (§16'daki bakım yükü zaten dört sağlayıcıyla dolu).

### 19.2 Performans bütçeleri

Ölçülebilir hedefler; aşılırsa yayın durur.

| Metrik | Bütçe | Nasıl ölçülür |
|---|---|---|
| Sayfa yüklendikten sonra ilk kontrolün görünmesi | < 300 ms (p95) | `performance.mark` + manuel profil |
| Tek observer callback | < 2 ms | Performance profili |
| Akış sırasında extension'ın CPU payı | Ölçülemez düzeyde (< %1) | Uzun yanıt sırasında profil (§7) |
| 200 mesajlık konuşmanın fetch + parse'ı | < 500 ms, parse payı < 150 ms | Fixture üzerinde `console.time` |
| Tepe bellek (adaptör + tüm versiyonlar) | < 50 MB | Heap snapshot |
| Paket boyutu (ikonlar dahil) | < 500 KB | CI kontrolü |

### 19.3 Kalite kapıları (CI)

**İlke: kural varsa kapısı olmalı.** Bu spec'te 19 "Kural" var; kapısı olmayan kural altı ay içinde sessizce bozulur, çünkü onu hatırlayan tek şey dokümanı okumuş olmaktır. Mekanik olarak denetlenebilen her kural bir kapıya bağlanır (`tools/check-invariants.mjs`); denetlenemeyenler yayın öncesi manuel kapıya (§19.5) düşer.

GitHub Actions, **npm bağımlılığı olmadan**, yalnızca Node yerleşikleriyle. Hepsi yeşil değilse paket üretilmez. Yeni bir kural eklendiğinde, mekanik olarak denetlenebiliyorsa buraya bir kapı eklemek **kuralın parçasıdır**, ayrı bir iş değil:

1. `node selftest.js` — saf fonksiyon testleri + adaptör uyumluluk paketi (§14)
2. `manifest.json` JSON doğrulaması + şema kontrolü (izinler beyaz listeye karşı: beklenmeyen izin eklenirse **kırmızı**)
3. **i18n bütünlüğü**: `_locales/tr` ve `_locales/en` anahtar kümeleri birebir aynı mı; kodda `getMessage` dışında kullanıcıya görünen sabit metin var mı (tarama)
4. `panel.html` inline script/handler içermiyor (MV3 CSP, §17)
5. Kaynakta yasak kalıp taraması: `innerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`, `window.addEventListener("message"` (§17). İhlal = kırmızı, istisna yok
6. Paket boyutu bütçesi
7. `manifest.version` ile `CHANGELOG.md`'nin en üst girdisi eşleşiyor mu
8. **Ağ hedefi taraması:** kaynaktaki tüm `http(s)://` literalleri dört sağlayıcı origin'inin dışına çıkmıyor. Mağazadaki "veri toplamıyor" beyanının (§19.6) teknik dayanağı bu kapıdır — beyan ile kod arasındaki tutarsızlık kaldırma sebebi
9. **Selector metin taraması:** `adapters/` içinde doğal dil string'i selector konumunda yok — `[aria-label="Copy"]`, `:has(:contains(…))`, `textContent === "Preview"` gibi kalıplar kırmızı (§12). Yazan kişinin arayüzü İngilizceyse asla göremeyeceği hatayı CI görür
10. **Katman ihlali:** `content.js` hiçbir sağlayıcı seçicisi içermiyor; `SEL` yalnızca `adapters/` altında (§3.4.3, §12). Adaptör yalıtımının tek koruyucusu bu kapı
11. **Ayar kapsaması:** `cfg` şemasındaki her anahtarın panelde bir kontrolü var, panelde şemada olmayan kontrol yok (§8.6). Ayar eklenip UI unutulması bu kapıyla imkânsız
12. **Mantıksal CSS:** `overlay.css` fiziksel yön özelliği içermiyor (`left:`, `right:`, `margin-left`, `padding-right`); yalnızca `inset-inline-*`, `margin-inline-*` (§8.7). RTL bozulmasını sonradan aramak yerine yazarken engeller
13. **Adaptör tazeliği:** her adaptörde `LAST_VERIFIED` var; 90 günden eski **uyarı**, 180 günden eski **kırmızı** (§19.8). Doğrulanmamış bir adaptörle yeni sürüm çıkmaz
14. **Spec tutarlılığı** (`tools/check-spec.mjs`): kırık `§` referansı yok (kod blokları **dahil** — bir kırık referans tam orada bulunmuştu) · bölüm numaraları artan · `cfg` şeması ile ayar paneli iki yönlü örtüşüyor · spec'te adı geçen her dosya mimari ağaçta veya teslimat listesinde var · `SEL.*` ve `cfg.*` referansları tanımlı · 2+ kez geçen sayısal eşikler raporlanır (tutarsızlık insan gözüyle bakılsın diye)

   Bu kapının gerekçesi doğrudan bu dokümanın geçmişi: kusurların büyük çoğunluğu **aynı değerin iki yerde yazılıp birinin güncellenmemesinden** çıktı. Dokümanda derleyici yok; onun yerini bu kapı alır. Spec de kod gibi bakım gerektirir, ve bakım gerektiren her şey bir kapı hak eder

### 19.4 Sürümleme ve paketleme

Semver. `node tools/pack.mjs` → `dist/ai-chat-downloader-<version>.zip`; `docs/`, `test/`, `tools/`, `.superpowers/`, `.github/` hariç. Üretilen zip'in SHA-256'sı `CHANGELOG.md`'ye yazılır — mağazadaki paketin depodaki commit'ten üretildiği doğrulanabilir olsun.

Her yayın bir git tag'i: `v1.0.0`.

### 19.5 Yayın öncesi kapı

Aşağıdakilerin **tamamı** işaretlenmeden gönderim yapılmaz:

- [ ] CI yeşil (§19.3'ün **tamamı** — sayı burada tekrarlanmaz, sayılar sürüklenir)
- [ ] Manuel doğrulama listesi (§14) dört sağlayıcıda ayrı ayrı koşuldu
- [ ] Performans bütçeleri (§19.2) ölçüldü ve aşılmadı
- [ ] Enjeksiyon çökme testi (§7 adım 2) dört sağlayıcıda temiz
- [ ] Erişilebilirlik: klavyeyle tam akış, ekran okuyucuyla toast/menü duyurusu, `prefers-reduced-motion`
- [ ] Açık + koyu tema, TR + EN arayüz, RTL kontrolü
- [ ] Dokunmatik cihazda kod bloğu indirme erişilebilir (§8.1.1) · %200 yakınlaştırmada hizalama
- [ ] Yayıncı hesabında donanım anahtarı/passkey aktif, CI'da yayın yetkisi yok (§17.1)
- [ ] Her adaptörün `LAST_VERIFIED`'ı güncel · paket SHA-256'sı CHANGELOG'a yazıldı (§19.4)
- [ ] Teşhis bloğu (§8.9) hiçbir konuşma verisi içermiyor — çıktı gözle denetlendi
- [ ] İzin listesi minimal: `storage` + 4 host + opsiyonel `notifications`. Fazlası yok
- [ ] Gizlilik politikası yayımlandı ve URL erişilebilir
- [ ] Ekran görüntüleri **demo** konuşmadan
- [ ] Marka feragatnamesi dört sağlayıcı için de açıklamada
- [ ] `docs/BREAKAGE.md` dört sağlayıcı bölümüyle dolu
- [ ] Önceki sürümün zip'i saklandı (§19.7)

### 19.6 Mağaza gönderimi

- **Tek amaç beyanı:** "AI sohbet asistanlarındaki kod, doküman ve dosyaları doğru dosya adı ve uzantısıyla indirmek."
- **İzin gerekçeleri**, izin başına tek cümle: `storage` → kullanıcı ayarları; host izinleri → sohbet içeriğini okumak (yalnızca kullanıcının kendi oturumu); `notifications` → opsiyonel, kullanıcı açarsa.
- **Veri kullanımı formu:** Chrome her kategori için soruyor. Cevap dört kategoride de **toplanmıyor**; "veri satılmaz/aktarılmaz" ve "kredi notu vb. için kullanılmaz" beyanları işaretlenir. Beyanla kod tutarsızsa kaldırma sebebidir — bu yüzden §19.3'teki ağ çağrısı taraması bu beyanın teknik dayanağıdır.
- Görseller (§15), gizlilik URL'si, TR + EN listeleme metinleri.
- Geliştirici hesabı + tek seferlik kayıt ücreti; ilk inceleme birkaç günü bulabilir, geniş host izni olan gönderimlerde daha uzun.

### 19.7 Kademeli yayın ve geri alma

Yayın **%10 → %50 → %100** kademeli yapılır, kademeler arasında en az 48 saat.

**Web Store'da geri alma yoktur.** Bozuk bir sürüm yayımlandıysa tek yol daha yüksek sürüm numarasıyla düzeltme yayımlamak. Bu yüzden: her yayından önce bir önceki paketin zip'i saklanır ve `git tag` ile eşlenir; acil durumda o ağaçtan `version` artırılıp yeniden paketlenir. Hazırlığı yayından **önce** yapılmış bir geri dönüş, panik anında yazılan koddan iyidir.

Kullanıcı tarafındaki acil çıkış yolu zaten var: site bazında devre dışı bırakma (§8.8).

### 19.8 Yayın sonrası izleme — telemetri olmadan

Telemetri yok (§17), dolayısıyla izleme **planlı ve manuel** olmak zorunda:

- Her adaptör dosyasının başında `LAST_VERIFIED = "2026-09-09"`. 90 günden eskiyse o sağlayıcı yeniden doğrulanır.
- **Aylık smoke test:** dört sağlayıcıda kısa kontrol listesi (buton görünüyor mu, indirme çalışıyor mu, konsol temiz mi). Depoda `docs/SMOKE.md` olarak; sonuç tarih + sağlayıcı ile commit'lenir.
- Mağaza yorumları ve GitHub issue'ları haftalık gözden geçirilir. Sağlayıcı arayüz değişimleri genelde önce burada görünür.
- Bir sağlayıcı bozulduğunda kullanıcıya görünen davranış: o sağlayıcıda yetenek kapanır ve teşhis bloğu sebebi taşır — sessiz hata yok.

### 19.9 Destek akışı

GitHub issue şablonu **teşhis bloğunu (§8.9) zorunlu alan** yapar. Blok olmadan açılan issue'ya ilk yanıt: "popup → Teşhis bilgisini kopyala". Böylece hata raporu ilk turda tanı tablosuna (§18 `BREAKAGE.md`) düşer.

Kullanıcıya açık **bilinen sınırlar** listesi (`docs/LIMITATIONS.md`), README'den bağlantılı: tarayıcı indirmelerinde tamamlanma doğrulanamaz (§8.4) · versiyon geçmişi Claude'da kesin, diğer sağlayıcılarda yetenek matrisine bağlı (§3.4.2) · DOM kademesinde yalnızca görüntülenen sürüm · ekler sağlayıcıya göre değişir · sağlayıcı arayüz değişiminde geçici bozulma olabilir. Sınırları önceden söylemek, sonradan şikâyet olarak öğrenmekten ucuz.

### 19.10 Bitti tanımı

Bir sağlayıcı **bitti** sayılır ancak: adaptör yetenek matrisindeki her satırı ya uygular ya açıkça kapatır · uyumluluk paketi geçer · fixture'ları commit'li · `SEL` tek objede ve metne bağlı değil · enjeksiyon çökme testi temiz · manuel liste o sağlayıcıda koşuldu · `BREAKAGE.md` bölümü yazıldı · `LAST_VERIFIED` güncel.

Ürün **yayına hazır** sayılır ancak §19.5'teki kapının tamamı işaretliyse.

## Uygulama sırası (özet)

1. **Sağlayıcı keşfi (dördü için ayrı ayrı):** konuşma kimliği nereden okunur, API var mı ve yanıt şekli nedir, akış nasıl tespit edilir, `SEL` seçicileri, ek endpoint'i, enjeksiyonun framework'ü çökertip çökertmediği (§7 adım 2). Claude için ayrıca `tool_use` şeması **ve** ağaç alanları (`parent_message_uuid`, `current_leaf_message_uuid`). Keşif çıktısı yetenek matrisini (§3.4.2) doldurur; doğrulanamayan yetenek o sağlayıcıda kapatılır
2. Çekirdek saf katman: `Item` modeli, `parse.js` (fold + `Item` doğrulama), adlandırma zinciri, `zip.js` — hepsi `selftest.js` ile TDD
3. `manifest.json` iskeleti (sağlayıcı başına ayrı `content_scripts` bloğu, §5) + i18n altyapısı
4. `content.js` çekirdeği: adaptör seçimi, observer, UI kabuğu (buton, menü, pill, toast). **Sağlayıcı seçicisi içermez** (§12)
5. `common-dom.js` — sağlayıcıdan bağımsız kod bloğu çıkarımı + gezici düğme (§8.1.1); dört sağlayıcıda da doğrulanır. Bu adım tek başına dört sağlayıcıda çalışan bir ürün verir
6. `claude.js`: aktif dal çıkarımı → op toplama → versiyonlar → versiyon menüsü + üç kademe
7. `chatgpt.js`, `gemini.js`, `perplexity.js` — yetenek matrisine göre; doğrulanamayan yetenek kapatılır
8. Ekler: endpoint keşfi, ikili yazım, yoksa kapsamdan çıkar (§3.3.2)
9. `sw.js`: badge, nabız, kısayol, sistem bildirimi
10. `panel.html/js`: öğe listesi, ayarlar, canlı önizleme, teşhis, acil durdurma
11. Sürükle-bırak + klasöre kaydet (§8.7.1, §8.7.2)
12. İkonlar (16/48/128 + nabız kareleri)
13. CI kapıları + `tools/check-invariants.mjs` + `tools/pack.mjs` (§19.3, §19.4)
14. Manuel doğrulama listesi — dört sağlayıcıda ayrı ayrı (§14)
15. Performans bütçelerinin ölçümü (§19.2)
16. `store/` teslimatları + gizlilik politikasının yayımlanması
17. Yayın öncesi kapı (§19.5) → kademeli yayın (§19.7)

### MVP kesme çizgisi

Kapsam bu dokümanın ömrü boyunca üç kat büyüdü (artifact → üç öğe türü → dört sağlayıcı). Tek kişilik bir projede bunun gerçek riski kod değil, **hiçbirinin bitmemesi**. Bu yüzden kesme çizgisi baştan yazılı:

**MVP = 1-5. adımlar.** Yani: çekirdek + `common-dom.js` + gezici düğme, dört sağlayıcıda kod bloğu indirme, doğru ad ve uzantı, tekil dosya indirmesi. Versiyon yok, zip yok, ek yok, klasör yok, sürükleme yok.

Bu neden yayınlanabilir bir üründür: kod blokları dört sağlayıcıda **tek kod yolundan** çıkar (§3.4.1), yani MVP'nin bakım yükü dört değil bir. Ve indirilen kodun çoğu zaten artifact değil (§2) — kullanıcının en sık ihtiyacı burada.

**Sonra sırayla:** 6-7 (artifact/canvas + versiyon, Claude'dan başlayarak) → 11 (sürükle-bırak, klasör) → 8 (ekler). Her biri bağımsız olarak yayınlanabilir ve her biri kendi başına bir sürüm notu eder.

**Kesme çizgisinin altında kalanlar ertelenmez, kapatılır:** MVP'de versiyon menüsü *gizlenmez*, hiç çizilmez (§3.4.2'deki "yetenek yoksa kontrol de yok" kuralı). Kullanıcı eksik bir şey görmez, olmayan bir şeyi de beklemez.

**Sıra gerekçesi:** 5. adım bilerek adaptörlerden önce — kod blokları dört sağlayıcıda tek kod yoluyla çalıştığı için, oraya kadar gelen bir yapı zaten yayınlanabilir bir üründür. Artifact/versiyon katmanı (6-7) onun üstüne eklenir, altına değil.

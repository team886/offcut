# Artifact Downloader — Tasarım Dokümanı

**Tarih:** 2026-09-09
**Durum:** Onaylandı, implementation plan bekliyor
**Hedef:** Chrome MV3 extension, Chrome Web Store'a yayınlanacak

---

## 1. Problem

claude.ai artifact paneli içeriği kopyalatır ama **dosya olarak indirtmez**. Kullanıcı bir React bileşenini, HTML sayfasını veya markdown dokümanını diske almak istediğinde: kopyala → editör aç → yeni dosya → yapıştır → uzantıyı doğru tahmin et → kaydet. Artifact'ın önceki bir versiyonuna dönmek istiyorsa hiç yolu yok — panel sadece güncel hâli gösterir.

Bu extension o boşluğu kapatır: **panelden tek tıkla, doğru uzantıyla, istenen versiyonda dosya.**

## 2. Hedefler / Hedef olmayanlar

**Hedefler**
- Açık artifact'ı tek tıkla doğru uzantıyla indir
- Artifact'ın **her versiyonunu** ayrı ayrı indirilebilir yap
- Tüm versiyonları tek `.zip` olarak ver
- Artifact açıldığında görünür ama rahatsız etmeyen bir sinyal ver
- Her davranış kapatılabilir olsun
- Kullanıcı verisi cihazdan çıkmasın

**Hedef değil**
- Toplu hesap yedeği (tüm sohbetleri gezmek)
- Artifact düzenleme / geri yükleme
- claude.ai dışı siteler
- Sunucu, hesap, senkronizasyon
- **Çalıştırılabilir paket üretmek.** React artifact'ı tek başına `.tsx` olarak iner; `package.json`, bundler yapılandırması veya HTML sarmalayıcı üretmeyiz. Kullanıcı dosyayı kendi projesine taşır. Bu bilinçli bir sınır: "çalışan proje" üretmek ayrı bir üründür ve her framework için ayrı bakım demektir

**Doğrulanacak ön koşul.** Adım 1'de, claude.ai'ın bazı artifact tipleri için **kendi indirme düğmesini** eklemiş olup olmadığı kontrol edilir. Eklemişse bu extension'ın değeri "indirme"den "**versiyon geçmişi + zip + toplu erişim**"e kayar; ürün yine geçerli ama mağaza metni ve README buna göre yazılır. Var olan bir düğmenin yanına ikinci düğme koymak, incelemede de kullanıcıda da zayıf durur.

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

**Başlık versiyona göre değişebilir.** Claude bir güncellemede artifact'ı yeniden adlandırabilir. Her `Version` kendi `title`'ını taşır; dosya adı **indirilen versiyonun** başlığından üretilir, artifact'ın güncel başlığından değil.

### 3.1 Konuşma ağacı — dallanma tuzağı

Konuşma düz bir liste değil, **ağaçtır**. Kullanıcı bir mesajı düzenlerse kardeş dal oluşur; terk edilmiş dal API yanıtında durmaya devam eder. Tüm mesajları düz okuyup op'ları sıraya dizmek, **terk edilmiş daldaki op'ları da replay'e karıştırır** — sonuç sessizce bozuk bir versiyon geçmişi.

Kural: `parent_message_uuid` zincirinden **yaprak → kök** yürünüp aktif dal çıkarılır, op'lar yalnızca o daldan toplanır. Aktif yaprak, `current_leaf_message_uuid` alanı varsa oradan; yoksa en yeni `created_at`'e sahip yapraktan alınır.

Bu, "hangi mesajları okuduğumuz" sorusunun tek doğru cevabı ve `selftest.js`'in dallanma testi bunu koruma altına alır.

**Sıralama zaman damgasıyla değil, dal konumuyla yapılır.** Bir mesajda birden fazla op olabilir ve hepsi aynı `created_at`'i taşır; ayrıca düzenlenen dallarda zaman damgaları geriye gidebilir. Op sırası = dal zincirindeki mesaj indeksi, sonra mesaj içindeki blok indeksi. `created_at` yalnızca **gösterim** içindir (menüdeki "14 dk önce"), sıralama için değil.

### 3.2 Yazılmakta olan artifact

Kullanıcı Claude hâlâ yazarken butona basabilir. O anda son op yarım gelmiş olabilir — `content` kesik, `old_str` henüz tamamlanmamış. Bunu indirmek yarım dosya demektir.

Kural: akış hâlâ sürüyorsa (panelde/kompozitörde durdurma göstergesi var ya da son mesaj `stop_reason` taşımıyor), son versiyon `⚠ yazılıyor` işaretlenir. Menü açılır, önceki **tamamlanmış** versiyonlar normal indirilir; yarım versiyonu seçmek için kullanıcının uyarıyı görüp yine de tıklaması gerekir. Varsayılan seçim yarım versiyona düşmez.

## 4. Veri kaynağı — üç kademe

| # | Kaynak | Ne verir | Ne zaman |
|---|---|---|---|
| 1 | **Structured `tool_use`** — konuşma JSON'unda `chat_messages[].content[]` içinde `name === "artifacts"` olan bloklar; `input` = `{command, id, type, title, language, content, old_str, new_str}` | Tam op-log, regex yok | Öncelikli |
| 2 | **Ham metin `<antArtifact>`** — mesaj metnindeki inline bloklar, regex ile | Tam op-log | Kademe 1 boş dönerse (eski konuşmalar / format değişimi) |
| 3 | **DOM** — panelin Code sekmesindeki `<code>` metni | Sadece görüntülenen versiyon | API 401 / şema tanınmazsa |

Kademe 3'e düşüldüğünde menüde tek satır `v? (sayfadan okundu)` görünür ve sarı toast çıkar — kullanıcı versiyon geçmişinin neden yok olduğunu bilir.

**Doğrulanacak varsayım (implementation'ın ilk adımı):** Kademe 1'in tam şeması — `old_str`/`new_str` attribute mı child element mi, `id` alanının adı. Parser yazılmadan önce gerçek bir konuşma JSON'u dump edilip şema doğrulanacak. Parser her iki formu da tolere edecek şekilde yazılır.

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
artifact-downloader/
  manifest.json
  _locales/tr/messages.json
  _locales/en/messages.json
  src/
    parse.js        # saf, node-testable
    zip.js          # saf, store-only ZIP yazıcı
    content.js      # DOM gözlem + UI enjeksiyonu + orkestrasyon
    overlay.css     # buton, menü, pill, toast
    sw.js           # badge, sistem bildirimi, optional permission
    panel.html
    panel.js        # popup VE options aynı dosya
  icons/16.png 48.png 128.png
  selftest.js       # node selftest.js
  store/            # Web Store teslimatları (§13)
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
  "host_permissions": ["https://claude.ai/*"],
  "background": { "service_worker": "src/sw.js" },
  "content_scripts": [{
    "matches": ["https://claude.ai/chat/*", "https://claude.ai/project/*"],
    "js": ["src/parse.js", "src/zip.js", "src/content.js"],
    "css": ["src/overlay.css"],
    "run_at": "document_idle"
  }],
  "action": { "default_popup": "src/panel.html" },
  "options_ui": { "page": "src/panel.html", "open_in_tab": true },
  "commands": { "download-current": {
    "suggested_key": { "default": "Alt+Shift+D", "mac": "Alt+Shift+D" },
    "description": "__MSG_cmdDownload__" } }
}
```

`downloads` izni **yok** — `Blob` + `<a download>` yeterli. `tabs` izni **yok** — `sw.js` mesajın geldiği `sender.tab.id`'yi kullanır.

**Kısayol neden `Alt+Shift+D`:** `Ctrl+Shift+D` Chrome'da "tüm sekmeleri yer imlerine ekle" komutuna ayrılmış. Extension'ın istediği kısayol tarayıcının kendi komutuyla çakışırsa Chrome onu **sessizce kaydetmez** — kullanıcı basar, hiçbir şey olmaz, sebebini de göremez. `Alt+Shift+D` boşta. Kullanıcı yine de `chrome://extensions/shortcuts` üzerinden istediğine çevirebilir.

**`default_locale` neden `en`:** bu alan, tarayıcı dili desteklenmediğinde kullanılacak **yedek** dili belirler ve Web Store listeleme dilinin temelini oluşturur. `tr` yapılırsa Japon veya Alman bir kullanıcı Türkçe arayüz görür. `en` yedek, `tr` Türkçe tarayıcılarda otomatik devreye girer — Türkçe deneyim aynen korunur.

## 6. Modül sözleşmeleri

### parse.js (saf)
```js
parseOps(conversationJson) → Op[]
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

Zip'in kendi adı **en son versiyonun** başlığından üretilir (başlık versiyonlar arasında değişmiş olabilir, §3).

**Uzantı tablosu**
```
text/html                       → .html
application/vnd.ant.react       → .tsx  (language "jsx" ise .jsx)
text/markdown                   → .md
image/svg+xml                   → .svg
application/vnd.ant.mermaid     → .mmd
application/vnd.ant.code        → language'a göre (~20 dil: py js ts go rs java rb php cs cpp c sh sql yaml json xml css scss kt swift)
bilinmeyen                      → .txt
```

**sanitize kuralları:** `<>:"/\|?*` ve kontrol karakterleri → `-`; ardışık `-` teke iner; baş/son `.` ve boşluk kırpılır; Windows rezerve adları (`CON PRN AUX NUL COM1-9 LPT1-9`) `_` önek alır; boş kalırsa `artifact`.

**Kırpma kod noktasına göre yapılır, UTF-16 birimine göre değil.** `slice(0,120)` bir emoji'nin ortasından keserse geriye yarım surrogate çifti kalır — dosya adı geçersiz karaktere düşer, bazı sistemlerde yazma başarısız olur. `[...str]` ile kod noktalarına ayrılıp kırpılır. Ayrıca dosya sistemleri adı **bayt** olarak sınırlar (ext4/APFS: 255 bayt): Türkçe ve emoji karakterler 2-4 bayt tuttuğu için sınır hem 120 kod noktası hem 200 bayt olarak uygulanır, hangisi önce dolarsa.

### zip.js (saf)
Store-only (compression method 0) ZIP yazıcı: CRC32 tablosu + local file header + central directory + EOCD. Deflate **bilerek yok** — metin sıkıştırma kazancı burada önemsiz, `CompressionStream` async'i ve boyut muhasebesini işin içine sokmaya değmez.
```js
buildZip([{name, bytes}]) → Uint8Array
```

**Zip içi ad çakışması:** kullanıcının şablonunda `{version}` yoksa (varsayılan `{title}`) tüm versiyonlar aynı ada çıkar ve zip 3 özdeş adlı girdi taşır. Kural: **zip modunda `-v{n}` şablondan bağımsız olarak her zaman eklenir.** Zip'in kendi adı şablondan üretilir: `Sales-Dashboard-3-versiyon.zip`.

UTF-8 dosya adları için general purpose bit 11 (language encoding flag) set edilir; aksi halde Türkçe karakterli adlar bazı arşivleyicilerde bozulur.

**Tüm uzunluklar bayt cinsindendir, karakter değil.** ZIP başlıklarındaki `compressed size`, `uncompressed size` ve `file name length` alanları bayt sayar; CRC32 de bayt üzerinden hesaplanır. `str.length` kullanmak ASCII içerikte doğru sonuç verir, ilk Türkçe karakterde veya emoji'de **sessizce bozuk arşiv** üretir — dosya iner, açılmaz. Kural: içerik ve ad `TextEncoder` ile bir kez byte'a çevrilir, bütün alanlar o `Uint8Array`'in `byteLength`'inden okunur. `selftest.js` bunu Türkçe adlı ve emoji içerikli bir girdiyle sabitler.

Sınırlar: 65535 girdi veya 4 GB üzeri ZIP64 gerektirir; bu extension'ın kapsamında oluşamaz, yine de aşılırsa arşiv üretilmez ve hata toast'ı çıkar — bozuk zip verilmez.

## 7. Boru hattı

1. `MutationObserver` artifact panelini izler. SPA route değişiminde (`navigation` API, fallback `popstate` + pathname karşılaştırma) durum sıfırlanır.

   **Observer `document.body`'yi izleyemez.** Claude yanıt üretirken sayfa saniyede yüzlerce kez mutasyona uğrar — token token. `body` + `subtree:true` dinleyen bir callback, her akış boyunca CPU'yu yakar; kullanıcı bunu extension olarak değil "Claude yavaşladı, fanlar döndü" olarak yaşar ve sebebini bulamaz. Kural: iki kademeli izleme. (a) Panelin **kapsayıcısı** bulunana kadar `body` üzerinde `childList` (subtree yok, ucuz). (b) Kapsayıcı bulununca observer ona daraltılır ve `characterData` dinlenmez — sadece düğüm ekleme/çıkarma bizi ilgilendiriyor. Callback `requestAnimationFrame` ile debounce edilir ve tek bir "durumu yeniden değerlendir" fonksiyonuna iner. Panel kapanınca observer tekrar (a)'ya döner.

   Kabul ölçütü: uzun bir yanıt akarken extension'ın CPU payı ölçülebilir olmamalı. Bu, manuel doğrulama listesinde Performance profili ile kontrol edilir.
2. Panel görülünce split buton enjekte edilir (`data-adl` işaretiyle idempotent). Pill gösterilir, `sw.js`'e `artifact:present` mesajı gider.

   **React enjekte edilen düğümü siler.** claude.ai React ile çizilir; action bar yeniden render edildiğinde bizim butonumuz DOM'dan uçar. Bu, React uygulamalarına enjeksiyon yapan extension'ların bir numaralı kırılma sebebi. Karşı önlem: observer yalnızca "panel açıldı" olayını değil, **butonun hâlâ bağlı olup olmadığını** da kontrol eder (`document.contains(btn)`), yoksa yeniden enjekte eder. Enjeksiyon fonksiyonu ucuz ve idempotent olacak şekilde yazılır; observer callback'i `requestAnimationFrame` ile debounce edilir ki render fırtınasında CPU yakmasın.
3. Buton tıklanınca `getConversation(convUuid)` — bellek içi cache; DOM mesaj sayısı değiştiğinde veya 60 sn geçince geçersiz. Her mutation'da fetch **yok**.
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

### 8.3 Pulse pill — panelin sağ altı
`● 3 versiyon indirilebilir` — 2 nabız atar, 4 sn sonra kaybolur, tıklanınca menüyü açar. Yalnızca `notify === "inpage"` iken gösterilir. Konum gerekçesi: kodu kapatmıyor ve toast'larla aynı bölgeyi paylaşıyor — kullanıcı "bu extension buradan konuşur" diye tek yer öğreniyor.

Aynı artifact için oturum başına **bir kez** gösterilir; panel her açılıp kapandığında tekrar nabız atmaz.

### 8.4 Toast
| tür | süre | örnek |
|---|---|---|
| başarı | 2.5 sn | `✓ Sales-Dashboard-v3.tsx indirildi` |
| başarı (zip) | 2.5 sn | `✓ Sales-Dashboard-3-versiyon.zip · 3 dosya` |
| uyarı | 5 sn | `! Sayfadan okundu — versiyon geçmişi yok` |
| uyarı | 5 sn | `! v2 kısmi: old_str eşleşmedi` |
| hata | **elle kapatılana kadar** | `✕ İndirilemedi — artifact okunamadı` |

Hata sessizce kaybolmaz; kullanıcı dosyanın inmediğini fark etmek zorunda.

**Toast'lar ayara tabi değildir.** Kullanıcının kendi başlattığı bir eylemin sonucudur — kesinti değil, geri bildirim. Ayarlanabilen tek şey *davetsiz* sinyaldir (§8.3 pill, §8.5 badge).

### 8.5 Logo
Artifact paneli silueti + içinden çıkan coral (#d97757) ok, ink (#262624) yuvarlak kare zemin. 16px'te siluet ayakta kalıyor ve "artifact → dosya" diyor.

**Elenen yön:** Claude'un yıldız/spark işaretini andıran logo — Chrome Web Store impersonation politikası ve marka ihlali riski. Coral rengi tonal akrabalık için yeterli; işaret taklidi gereksiz risk.

**Badge durumları**
| durum | badge |
|---|---|
| claude.ai dışı | ikon soluk, badge yok |
| sohbette artifact yok | badge yok |
| artifact açık | artifact **sayısı**, coral zemin + `setIcon` ile 3 nabız |
| indi | yeşil `✓`, 2 sn sonra eski hâl |
| hata | kırmızı `!`, kalır |

Sayı gösteriliyor çünkü "3 artifact var" bilgisi zaten elimizde — nokta göstermek onu çöpe atmak olurdu.

**Badge sekmeye özgüdür.** `chrome.action.setBadgeText({text, tabId})` — `tabId` verilmezse badge global olur ve açık beş claude.ai sekmesi birbirinin sayısını ezer.

**Nabız MV3 service worker'da ImageData ile yapılamaz** — SW'de `document` yok, `canvas` yok. Çözüm: `icons/pulse-1.png … pulse-3.png` önceden render edilir, `setIcon({path})` ile sırayla gösterilir. `OffscreenCanvas` yazmaya gerek yok.

**Service worker 30 sn boşta ölür.** Nabız zamanlayıcısı ortasında SW ölürse ikon ara karede takılı kalır. Karşı önlem: nabız **önce** son (sabit) durumu yazar, animasyon karelerini onun üstüne bindirir; SW ölse bile ikon doğru durumda kalır. SW her uyandığında aktif sekmelerin badge durumu `artifact:present` mesajlarından yeniden kurulur.

### 8.6 Ayar paneli (popup = options)
Üstte **eylem**, altta ayarlar:
1. *Şu an* kartı: artifact adı, tip, versiyon sayısı, boyut + `↓ v3 indir` / `▾` / `🗜`
2. Bildirim: toolbar rozeti (aç/kapa) + "indirilebilir" duyurusu (kapalı / sayfa içi pill / sistem bildirimi) — **tek kontrol**, ayrı bir "pulse" anahtarı yok
3. İndirme: varsayılan versiyon (görüntülenen / son / sor), zip satırı (aç/kapa), otomatik indirme (aç/kapa, **varsayılan kapalı**)
4. Dosya adı: şablon input + tıklanabilir token chip'leri + **canlı önizleme**
5. Alt satır: `🔒 Veri cihazdan çıkmıyor · dış istek yok` + `Alt ⇧ D` (kısayol kullanıcı tarafından değiştirilmişse gerçek atanmış tuş `chrome.commands.getAll()` ile okunup gösterilir — yanlış tuş göstermek kullanıcıyı boşuna uğraştırır)

Gerekçeler: popup'ı açan çoğu insan ayar değil indirme için gelir → eylem üstte. Token'lı input'un klasik hatası kullanıcının çıktıyı tahmin edememesidir → canlı önizleme. Geri alınamayan davranış (otomatik indirme) varsayılan olmaz. Gizlilik cümlesi görünür, çünkü bu extension özel sohbetleri okuyor.

### 8.7 Stil izolasyonu, erişilebilirlik, dosya yazımı

**Shadow DOM.** Pill, toast ve versiyon menüsü bize ait tek bir `<div>`'e bağlı **shadow root** içinde çizilir. claude.ai'ın global CSS'i (Tailwind reset dahil) bizim kutularımızı yiyemez, bizim CSS'imiz de sayfayı kirletemez. İstisna: split buton, native görünmesi için claude.ai'ın action bar'ının **içinde** durmak zorunda — shadow DOM'a alınamaz. Onun için `adl-` önekli sınıf adları ve gerekli her özelliğin açıkça yazılması (miras alınan değerlere güvenilmez).

**Erişilebilirlik.** Buton `role="button"` + `aria-label` (i18n) + `title`. Menü `role="menu"`, satırlar `role="menuitem"`; ok tuşlarıyla gezinilir, `Enter` seçer, `Esc` kapatır ve odağı butona geri verir. Odak halkası görünür bırakılır. Toast'lar `role="status"` (hata: `role="alert"`).

**Hareket.** `@media (prefers-reduced-motion: reduce)` altında nabız ve pill animasyonu iptal; pill yine görünür, sadece nabız atmaz. Badge nabzı da bu durumda tek karede sabitlenir.

**Dosya yazımı.** İçerik **birebir**, UTF-8, BOM yok, satır sonu dönüştürmesi yok, sona satır sonu eklenmez — kullanıcı Claude'un ürettiği baytı alır. `Blob` MIME'ı gerçek tipe göre verilir (`text/html`, `image/svg+xml`, kod için `text/plain;charset=utf-8`). Oluşturulan object URL indirme tetiklendikten sonra `URL.revokeObjectURL` ile serbest bırakılır.

**`tabs` izni neden yok.** Kısayol ve popup, hedef sekmeye `chrome.tabs.sendMessage(tabId, …)` ile ulaşır; `tabId`, popup için `chrome.tabs.query({active:true, currentWindow:true})`'den gelir. Bu çağrı `tabs` izni olmadan da sekme kimliğini döndürür — izin yalnızca `url`/`title` gibi alanları okumak için gerekir ve bize gerekmiyor. Content script yoksa `sendMessage` hata döner, sessizce yutulur ve kullanıcıya "bu sayfada artifact yok" toast'ı gösterilir.

### 8.8 İlk çalıştırma ve boş durumlar

Tasarımın buraya kadarki her ekranı **dolu durumu** gösteriyor. Gerçekte kullanıcının göreceği ilk şey boş durum.

**İlk kurulum.** `chrome.runtime.onInstalled` (`reason === "install"`) ayar sayfasını yeni sekmede açar: extension'ın ne yaptığı, butonun nerede belireceği (ekran görüntüsü), kısayol, gizlilik cümlesi. Tek seferlik. Güncellemede (`reason === "update"`) hiçbir şey açılmaz — kimse güncelleme başına sekme istemez.

Ayrıca ilk kez bir artifact paneli görüldüğünde pill normalden farklı bir metinle çıkar: `● Artifact'lar buradan indirilir` ve 6 sn kalır. Yalnızca bir kez; `storage` içinde `seenIntro` bayrağıyla.

**Popup'ın boş durumları.** "Şu an" kartı üç hâl daha taşır:

| Durum | Kart içeriği |
|---|---|
| claude.ai'da değil | `claude.ai'da bir sohbet aç` + Claude'a git bağlantısı |
| Sohbette artifact yok | `Bu sohbette artifact yok` + kısa açıklama |
| Artifact var, panel kapalı | `2 artifact bulundu` + `Paneli aç` yerine doğrudan `↓ İndir` (panel açmadan da indirilebilir, çünkü veri API'den gelir) |
| Okuma başarısız | `Artifact okunamadı` + `Tekrar dene` + `Neden?` (BREAKAGE.md'ye bakan kısa açıklama) |

Son satır bir tasarım kazancı: veri panelden değil API'den geldiği için **artifact indirmek için paneli açmak gerekmiyor.** Popup, kapalı paneldeki artifact'ları da listeleyebilir.

**Hiçbir boş durum sessiz olmaz.** Boş kart her zaman "neden boş" ve "ne yapmalı" söyler; kullanıcı extension'ın bozuk mu yoksa doğru mu çalıştığını ayırt edebilmeli.

### 8.9 Teşhis — telemetri olmadan hata raporu

Telemetri yok (§17), dolayısıyla bir şey bozulduğunda bunu **yalnızca kullanıcı anlatabilirse** öğreniriz. "Çalışmıyor" mesajı ise tamir için yetersizdir.

Popup'ın alt satırında **Teşhis bilgisini kopyala** bağlantısı: panoya, hassas veri içermeyen bir metin bloğu yazar.

```
Artifact Downloader 1.0.0 · Chrome 141 · tr
Kademe: 3 (DOM)            ← hangi kaynak kullanıldı
Org çözümü: cookie ✓
Konuşma isteği: 404
SEL: panel ✓ · actionBar ✓ · codeBlock ✗ · versionIndicator ✗
Son hata: TypeError: ... (ilk satır)
```

**İçinde ne yok:** konuşma metni, artifact içeriği, artifact başlığı, konuşma/org UUID'si, kullanıcı adı, e-posta, URL. Yalnızca hangi kademenin çalıştığı, hangi selector'ın tuttuğu, hata tipi.

Bu blok bir GitHub issue'ya yapıştırılabilir ve `docs/BREAKAGE.md`'deki tanı tablosuyla doğrudan eşleşir. Sıfır telemetriyle, gerçek bir hata raporu.

## 9. Ayar şeması

`chrome.storage.sync`, tek anahtar `cfg`:
```js
{
  badge: true,               // toolbar rozeti + nabız
  notify: "inpage",          // "indirilebilir" duyurusu: "off" | "inpage" (pill) | "system"
  autoDownload: false,
  defaultVersion: "current", // "current" | "latest" | "ask"
  nameTemplate: "{title}",   // {title} {version} {date} {ext}
  zipAll: true
}
```
Eksik alanlar okuma anında varsayılanla doldurulur (şema evrimi için migration gerekmez).

`storage.sync` kurumsal politikayla kapatılmış veya kotası dolmuş olabilir; yazma hatasında sessizce `storage.local`'a düşülür. Ayar kaybetmek, senkronizasyon uğruna ödenecek bir bedel değil.

`notify: "system"` seçildiğinde `chrome.permissions.request(["notifications"])` **o an** çağrılır. Kullanıcı reddederse segment sessizce `"inpage"`e döner ve bir kez bilgi toast'ı gösterilir.

## 10. Mesajlaşma protokolü

content → sw:
```js
{ type: "artifact:present", count, title }   // badge yaz + nabız
{ type: "artifact:none" }                    // badge temizle
{ type: "notify", level, title, body }       // sistem bildirimi (izin varsa)
{ type: "state:get" }                        // popup için mevcut durum
```
sw → content:
```js
{ type: "cmd:download" }                     // Ctrl+Shift+D
{ type: "cfg:changed", cfg }
```
panel → content (aktif sekme): `{ type: "popup:download", version | "zip" }`

## 11. Hata matrisi

| Durum | Davranış |
|---|---|
| `/api/organizations` 401/403 | Kademe 3 (DOM) + sarı toast |
| Konuşma JSON şeması tanınmadı | Kademe 2 → boşsa Kademe 3 + sarı toast |
| Hiç artifact parse edilemedi | Kademe 3 |
| `old_str` eşleşmedi | Versiyon `⚠ kısmi`, indirilebilir, ad `-partial` |
| Açık artifact eşleşmesi belirsiz | Menüde adayların hepsi gösterilir |
| DOM da okunamadı | Kırmızı toast (kalıcı) + `console.error`, **indirme yok** |
| ZIP > 100 MB | Uyarı, yine de dener |
| Bildirim izni reddedildi | `notify` → `"inpage"`, bilgi toast'ı |
| `old_str` gövdede 2+ kez geçiyor | Versiyon `⚠ kısmi`, `reason:"old_str_ambiguous"` |
| Aktif dal çıkarılamadı (`parent_message_uuid` zinciri kopuk) | En yeni `created_at`'li yaprak seçilir + sarı toast |
| Kısayol basıldı, artifact yok | `! Bu sayfada indirilecek artifact yok` toast'ı |
| Content script yüklenmemiş sekmede kısayol | Sessiz no-op (hata yutulur) |

İlke: bozuk dosya vermektense hiç dosya vermemek.

## 12. DOM bağımlılık katmanı

claude.ai'a ait **tüm** selector'lar `content.js` başındaki tek `SEL` objesinde:
```js
// Anthropic UI değişirse SADECE burası güncellenir.
const SEL = { panel: "...", panelTitle: "...", actionBar: "...", codeBlock: "...",
              versionIndicator: "...", codeTab: "..." };
```
Bu bir anti-corruption layer. Üçüncü parti DOM'a bağımlı her extension eninde sonunda kırılır; soru kırılıp kırılmayacağı değil, tamirin 1 dosya mı 10 dosya mı olduğu.

Her selector için `null` toleransı: bulunamayan selector exception atmaz, kademe düşürür.

**Selector'lar metne bağlanamaz.** claude.ai arayüzü yerelleştirilmiştir; `[aria-label="Copy"]` veya "Preview" yazısını arayan bir selector, arayüzü Türkçe olan kullanıcıda **sessizce çalışmaz** — ve extension'ı yazan kişi kendi arayüzü İngilizceyse bunu asla göremez. Kural: yalnızca yapısal ve dilden bağımsız işaretler (DOM hiyerarşisi, `data-*`, `role`, ikon `svg` yapısı). Metin eşleştirme yasak. Doğrulama: claude.ai arayüzü Türkçeye alınıp tüm akış tekrar denenir.

**Tema.** claude.ai'ın açık teması da var; koyu tema varsayan enjekte UI, açık temada okunmaz bir leke olur. Bizim renklerimiz sabit yazılmaz: panelin kendi hesaplanmış arka plan ve metin rengi okunup CSS değişkenlerine (`--adl-bg`, `--adl-fg`, `--adl-line`) yazılır. Böylece Anthropic temayı hangi mekanizmayla değiştirirse değiştirsin (class, `data-*`, `prefers-color-scheme`) biz peşinden geliriz. Vurgu rengi (#d97757) her iki temada da kontrast sağladığı için sabit kalır.

**Preview modunda DOM okuma.** Kademe 3'e düşüldüğünde kod yalnızca Code sekmesinde bulunur. Sekmeyi programatik tıklamak kullanıcının görünümünü değiştirir — bu bizim değil onun tercihi. Kural: mevcut sekme kaydedilir, Code'a geçilir, metin okunur, **eski sekme geri yüklenir**. Kullanıcı ideal olarak kısa bir titreme dışında hiçbir şey görmez. Preview'da başlamışsa ve okuma başarısızsa yine de eski sekmeye dönülür (`try/finally`).

## 13. i18n

`_locales/tr` (default) + `_locales/en`. Tüm kullanıcıya görünen metin `chrome.i18n.getMessage()` üzerinden. Sabit metin yasak — sonradan i18n eklemek acılıdır, Web Store için de gerekli.

## 14. Test

`node selftest.js`, framework yok, assert tabanlı.

**Fixture'lar sözleşmeyi sabitler.** Testlerin tamamı elle yazılmış girdilerle çalışırsa, claude.ai'ın gerçek yanıt şeması değiştiğinde hepsi yeşil kalır ve extension sahada bozulur. Bu yüzden `test/fixtures/` altına **gerçek konuşmalardan alınmış, kişisel içeriği temizlenmiş** JSON örnekleri commit'lenir: tek artifact, çok versiyonlu artifact, dallanmış konuşma, aynı başlıklı iki artifact, akış hâlinde yarım artifact. `parseOps` bunların hepsine karşı koşar.

Kazanç: Anthropic şemayı değiştirdiğinde yapılacak iş "yeni bir konuşmayı dump'la, fixture'ı değiştir, testin nerede kırıldığına bak" olur. Şema değişimi gizemden **kırmızı teste** iner. Fixture'lar temizlenmeden commit'lenmez — içlerinde konuşma metni, kullanıcı adı, org UUID'si kalmaz.

**parse.js**
- `parseOps`: structured `tool_use` formu; ham `<antArtifact>` formu; ikisinin karışımı; attribute sırası karışık; gövdede nested backtick ve `<` karakterleri
- `activeBranch`: düzenlenmiş mesaj yüzünden dallanmış ağaçta yalnızca aktif dalın op'ları toplanır; terk edilmiş daldaki `update` replay'e **karışmaz**; kopuk zincirde en yeni yaprağa düşüş; op sırası `created_at` geriye gitse bile dal konumunu takip eder
- `sanitize` güvenlik kolu: `../../etc/passwd` ve `~/x` yol bileşenlerini kaybeder; `<img onerror=x>` başlığı dosya adında zararsız metne iner
- `buildVersions`: create→update→rewrite→update replay doğruluğu; `old_str` bulunamayınca `ok:false` ve içeriğin bozulmaması; `old_str` 2+ kez geçince `ok:false` + `old_str_ambiguous`; tek `create` → tek versiyon; versiyonlar arası başlık değişiminin dosya adına yansıması
- `extFor`: react+tsx → `.tsx`; react+jsx → `.jsx`; text/html → `.html`; mermaid → `.mmd`; svg → `.svg`; code+python → `.py`; bilinmeyen → `.txt`
- `sanitize`: `a/b:c*?"<>|` temizliği; `CON` → `_CON`; 200 karakterlik başlık → 120 cap; sadece `...` → `artifact`; **emoji'li başlık kırpılınca yarım surrogate kalmıyor**; çok baytlı başlıkta 200 baytlık sınır önce doluyor
- `fmtName`: her token, eksik token, bilinmeyen token literal kalır

**zip.js**
- `CRC32("hello") === 0x3610a686`
- local header imzası `0x04034b50`, EOCD imzası `0x06054b50`
- 2 girişli zip'te central directory offset'i local header'ların toplam boyutuna eşit
- **Türkçe adlı + emoji içerikli girdide tüm boyut alanları `byteLength`'e eşit, karakter sayısına değil** — bu test olmadan çok baytlı içerikte sessizce bozuk arşiv üretilir
- general purpose bit 11 (UTF-8 flag) set

Manuel doğrulama listesi (implementation sonunda): gerçek 3 versiyonlu React artifact; tek versiyonlu markdown; SVG; mermaid; çok uzun (>500 satır) HTML; aynı başlıklı iki artifact; oturum kapalıyken fallback; **mesaj düzenlenip dallanmış konuşma**; iki claude.ai sekmesi açıkken badge'lerin karışmaması; React yeniden render'ından sonra butonun hâlâ orada olması; Preview modundayken fallback sonrası sekmenin geri gelmesi; `prefers-reduced-motion` açıkken animasyonsuz çalışma; klavyeyle menü gezinme; **uzun bir yanıt akarken Performance profili** (extension'ın CPU payı ölçülebilir olmamalı); `{date}` şablonunun `en-US` yerelinde de ISO üretmesi; teşhis bloğunun içinde konuşma verisi bulunmaması; **↓'ye basıp yanıt gelmeden başka sohbete geçmek** (yanlış dosya inmemeli); hızlı çift tık (tek dosya inmeli); otomatik indirme açıkken Claude artifact yazarken (akış bitene kadar dosya inmemeli); menü açıkken panelin kapanması; **extension'ı yeniden yükleyip eski sekmeye dönmek** (konsol temiz kalmalı, UI kendini kaldırmalı); ilk kurulumda ayar sekmesinin açılması; claude.ai dışında popup'ın boş durumu.

## 15. Chrome Web Store teslimatları

`store/` klasöründe:
- **Gizlilik politikası** (TR+EN): hangi veriye erişiliyor (claude.ai konuşma içeriği, yalnızca kullanıcının kendi oturumunda), nereye gidiyor (**hiçbir yere** — dış istek yok, telemetri yok, analytics yok), ne saklanıyor (sadece ayarlar, `storage.sync`)
- **Listing metinleri** TR+EN: kısa açıklama (132 char), uzun açıklama, "single purpose" beyanı, izin gerekçeleri (`storage` → ayarlar; `host_permissions claude.ai` → artifact okuma; `notifications` → opsiyonel, kullanıcı açarsa)
- **Ekran görüntüsü şablonları** (1280×800, 5 adet): split buton, versiyon menüsü, zip toast'ı, ayar paneli, badge durumları
- 128px mağaza ikonu, 440×280 küçük promo

Web Store incelemesinin en sık takıldığı yer geniş host izni ve "neden bu veriye ihtiyacın var" sorusudur. Tek amaç beyanı ve dış istek olmaması bunu doğrudan karşılıyor.

**Ekran görüntülerinde gerçek sohbet kullanılmaz.** Beş görselin tamamı, bu iş için açılmış **demo bir konuşmadan** üretilir. Aksi hâlde kendi özel verini kalıcı olarak halka açık bir mağaza sayfasına koymuş olursun — geri alınmaz, indekslenir.

**İsim ve marka.** İsim Anthropic markasıyla başlamaz ve resmîlik ima etmez. "Claude" kelimesi ancak tanımlayıcı bir konumda ve resmî olmadığı açıkken kullanılabilir (ör. `Artifact Downloader for Claude`, açıklamada "Anthropic ile bağlantısı yoktur" satırıyla). Logo Anthropic işaretini andırmaz (§8.5). İkonda ve isimde marka taklidi, incelemede en hızlı ret sebeplerinden.

## 16. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Anthropic DOM'u değişir | Buton enjekte edilemez | `SEL` katmanı, tek dosyada tamir |
| Konuşma API şeması değişir | Versiyon geçmişi kaybolur | Üç kademeli fallback, DOM her zaman çalışır |
| `tool_use` şeması varsayımı yanlış | Parser boş döner | Implementation'ın **ilk adımı** gerçek JSON dump'ı ile şema doğrulama |
| Web Store geniş host iznini sorgular | Yayın gecikir | Tek amaç beyanı + sıfır dış istek + gizlilik politikası hazır |
| Çok uzun konuşmada fetch yavaş | Buton geç yanıt verir | Cache + buton üzerinde yükleniyor durumu |
| Anthropic dahilî API'nin kullanımına itiraz eder | Yayın kaldırılabilir | Yalnızca kullanıcının kendi oturumu, kendi verisi, kendi tarayıcısı; hız sınırı zorlanmıyor, sunucu yok. Yine de bir ürün riski — DOM fallback'i extension'ı API olmadan da ayakta tutar |
| Kullanıcı birden fazla organizasyona üye | Yanlış org → 404 → sessiz fallback | `lastActiveOrg` + org'ları sırayla deneme (§4) |
| claude.ai arayüzü Türkçe/başka dilde | Metne bağlı selector çalışmaz | Metin eşleştirme yasak (§12) |
| Kullanıcı açık temada | Enjekte UI okunmaz | Renkler panelden okunuyor (§12) |

---

## 17. Güvenlik

Bu extension iki tür **güvenilmez veri** işliyor: artifact başlıkları ve artifact içerikleri. İkisi de model çıktısıdır; kullanıcı Claude'a başkasının metnini yapıştırmışsa saldırgan etkisindedir.

| Kural | Neden |
|---|---|
| Artifact kaynaklı hiçbir string `innerHTML`/`insertAdjacentHTML` ile DOM'a yazılmaz — **yalnızca `textContent`** | Başlık `<img onerror>` taşıyabilir. Enjeksiyon claude.ai sayfasının DOM'una olur; oturum çerezlerinin yanına XSS koymuş oluruz. Menü satırları, toast'lar, pill, popup başlığı — hepsi `textContent` |
| Artifact içeriği **asla render/eval edilmez** | HTML artifact'ı önizlemek bizim işimiz değil; sadece bayt olarak diske yazılır |
| `window.addEventListener("message", …)` **yok** | Sayfa `postMessage` ile bizim ayrıcalıklı çağrılarımızı sürükleyebilirdi. İletişim yalnızca `chrome.runtime` / `chrome.tabs` üzerinden |
| `externally_connectable` **tanımlanmaz** | Varsayılan "hiç kimse". Başka sitelerin extension'a mesaj atması kapalı |
| Uzak kod **yok**: CDN yok, `eval` yok, `new Function` yok, uzaktan yüklenen script yok | Web Store uzak kodu doğrudan reddediyor. Tüm kod paket içinde |
| `panel.html` inline `<script>`/`onclick` içermez | MV3 varsayılan CSP inline script'i bloklar; sessiz bozulma olur |
| `sanitize` yol geçişini de keser: `/` `\` `..` ve baştaki `~` temizlenir | `<a download="../../x">` denemesi. Chrome zaten yol bileşenlerini yok sayar ama savunma bizde de olmalı |
| Ağa **hiç** çıkılmaz; tek `fetch` hedefi `https://claude.ai` | Gizlilik politikasının doğrulanabilir olması için |

## 18. Depo teslimatları

- `LICENSE` — MIT
- `README.md` — ne yapar, kurulum (unpacked + Store linki), ayarlar tablosu, `node selftest.js`
- `docs/BREAKAGE.md` — **kırılma runbook'u**: belirti → tanı → tamir. "Buton görünmüyor" → `SEL.actionBar` tut(a)mıyor, DevTools'ta yeni seçiciyi bul, `SEL`i güncelle, sürüm bump. "Versiyonlar tek satır" → API kademesi düştü, Network sekmesinde konuşma isteğinin durumuna bak (401 → oturum, 404 → org çözümü, 200 ama boş → şema değişti, `parseOps` testlerini gerçek JSON'la güncelle). Bu dosya olmadan extension'ı altı ay sonra ben de tamir edemem
- `CHANGELOG.md` — sürüm notları (Web Store güncellemeleri için)
- `.gitignore` — `.superpowers/`, `node_modules/`, `*.zip`

## Uygulama sırası (özet)

1. Gerçek konuşma JSON'u dump'la, `tool_use` şemasını **ve** ağaç alanlarını (`parent_message_uuid`, `current_leaf_message_uuid`) doğrula
2. `parse.js` (aktif dal çıkarımı → op toplama → fold) + `selftest.js` (TDD)
3. `zip.js` + testleri
4. `manifest.json` + iskelet + i18n
5. `content.js`: `SEL`, observer, split buton, menü
6. Boru hattı: fetch → parse → versiyonlar → indirme
7. Pill, toast, fallback kademeleri
8. `sw.js`: badge, nabız, kısayol, sistem bildirimi
9. `panel.html/js`: ayarlar + canlı önizleme + hızlı indirme
10. İkonlar (16/48/128)
11. Manuel doğrulama listesi
12. `store/` teslimatları

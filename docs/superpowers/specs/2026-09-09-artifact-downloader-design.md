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
GET /api/organizations                                        → [0].uuid
GET /api/organizations/{orgUuid}/chat_conversations/{convUuid}?tree=True&rendering_mode=messages
```
`convUuid` → `location.pathname`'den.

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
  "name": "__MSG_extName__", "default_locale": "tr",
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
    "suggested_key": { "default": "Ctrl+Shift+D" },
    "description": "__MSG_cmdDownload__" } }
}
```

`downloads` izni **yok** — `Blob` + `<a download>` yeterli. `tabs` izni **yok** — `sw.js` mesajın geldiği `sender.tab.id`'yi kullanır.

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

**sanitize kuralları:** `<>:"/\|?*` ve kontrol karakterleri → `-`; ardışık `-` teke iner; baş/son `.` ve boşluk kırpılır; Windows rezerve adları (`CON PRN AUX NUL COM1-9 LPT1-9`) `_` önek alır; 120 karakter cap; boş kalırsa `artifact`.

### zip.js (saf)
Store-only (compression method 0) ZIP yazıcı: CRC32 tablosu + local file header + central directory + EOCD. Deflate **bilerek yok** — metin sıkıştırma kazancı burada önemsiz, `CompressionStream` async'i ve boyut muhasebesini işin içine sokmaya değmez.
```js
buildZip([{name, bytes}]) → Uint8Array
```

## 7. Boru hattı

1. `MutationObserver` artifact panelini izler. SPA route değişiminde (`navigation` API, fallback `popstate` + pathname karşılaştırma) durum sıfırlanır.
2. Panel görülünce split buton enjekte edilir (`data-adl` işaretiyle idempotent). Pill gösterilir, `sw.js`'e `artifact:present` mesajı gider.
3. Buton tıklanınca `getConversation(convUuid)` — bellek içi cache; DOM mesaj sayısı değiştiğinde veya 60 sn geçince geçersiz. Her mutation'da fetch **yok**.
4. `parseOps` → `buildVersions` → versiyon listesi.
5. **Açık artifact eşleştirme:** panel başlığı → aday artifact'lar. Aynı başlıktan birden fazla varsa, görünen kodun ilk 200 karakteriyle her adayın son versiyonu karşılaştırılıp en yüksek skorlu seçilir. Skorlar birbirine yakınsa menüde her ikisi de gösterilir — belirsizlik sessizce çözülmez.
6. **Görüntülenen versiyon:** panelin kendi versiyon göstergesinden okunur; okunamazsa son versiyon varsayılır.
7. Seçim → `Blob` + `<a download>` → başarı toast'ı.

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

### 8.6 Ayar paneli (popup = options)
Üstte **eylem**, altta ayarlar:
1. *Şu an* kartı: artifact adı, tip, versiyon sayısı, boyut + `↓ v3 indir` / `▾` / `🗜`
2. Bildirim: toolbar rozeti (aç/kapa) + "indirilebilir" duyurusu (kapalı / sayfa içi pill / sistem bildirimi) — **tek kontrol**, ayrı bir "pulse" anahtarı yok
3. İndirme: varsayılan versiyon (görüntülenen / son / sor), zip satırı (aç/kapa), otomatik indirme (aç/kapa, **varsayılan kapalı**)
4. Dosya adı: şablon input + tıklanabilir token chip'leri + **canlı önizleme**
5. Alt satır: `🔒 Veri cihazdan çıkmıyor · dış istek yok` + `Ctrl ⇧ D`

Gerekçeler: popup'ı açan çoğu insan ayar değil indirme için gelir → eylem üstte. Token'lı input'un klasik hatası kullanıcının çıktıyı tahmin edememesidir → canlı önizleme. Geri alınamayan davranış (otomatik indirme) varsayılan olmaz. Gizlilik cümlesi görünür, çünkü bu extension özel sohbetleri okuyor.

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

## 13. i18n

`_locales/tr` (default) + `_locales/en`. Tüm kullanıcıya görünen metin `chrome.i18n.getMessage()` üzerinden. Sabit metin yasak — sonradan i18n eklemek acılıdır, Web Store için de gerekli.

## 14. Test

`node selftest.js`, framework yok, assert tabanlı.

**parse.js**
- `parseOps`: structured `tool_use` formu; ham `<antArtifact>` formu; ikisinin karışımı; attribute sırası karışık; gövdede nested backtick ve `<` karakterleri
- `buildVersions`: create→update→rewrite→update replay doğruluğu; `old_str` bulunamayınca `ok:false` ve içeriğin bozulmaması; tek `create` → tek versiyon
- `extFor`: react+tsx → `.tsx`; react+jsx → `.jsx`; text/html → `.html`; mermaid → `.mmd`; svg → `.svg`; code+python → `.py`; bilinmeyen → `.txt`
- `sanitize`: `a/b:c*?"<>|` temizliği; `CON` → `_CON`; 200 karakterlik başlık → 120 cap; sadece `...` → `artifact`
- `fmtName`: her token, eksik token, bilinmeyen token literal kalır

**zip.js**
- `CRC32("hello") === 0x3610a686`
- local header imzası `0x04034b50`, EOCD imzası `0x06054b50`
- 2 girişli zip'te central directory offset'i local header'ların toplam boyutuna eşit
- UTF-8 dosya adı (Türkçe karakter) doğru uzunlukta yazılıyor

Manuel doğrulama listesi (implementation sonunda): gerçek 3 versiyonlu React artifact, tek versiyonlu markdown, SVG, mermaid, çok uzun (>500 satır) HTML, aynı başlıklı iki artifact, oturum kapalıyken fallback.

## 15. Chrome Web Store teslimatları

`store/` klasöründe:
- **Gizlilik politikası** (TR+EN): hangi veriye erişiliyor (claude.ai konuşma içeriği, yalnızca kullanıcının kendi oturumunda), nereye gidiyor (**hiçbir yere** — dış istek yok, telemetri yok, analytics yok), ne saklanıyor (sadece ayarlar, `storage.sync`)
- **Listing metinleri** TR+EN: kısa açıklama (132 char), uzun açıklama, "single purpose" beyanı, izin gerekçeleri (`storage` → ayarlar; `host_permissions claude.ai` → artifact okuma; `notifications` → opsiyonel, kullanıcı açarsa)
- **Ekran görüntüsü şablonları** (1280×800, 5 adet): split buton, versiyon menüsü, zip toast'ı, ayar paneli, badge durumları
- 128px mağaza ikonu, 440×280 küçük promo

Web Store incelemesinin en sık takıldığı yer geniş host izni ve "neden bu veriye ihtiyacın var" sorusudur. Tek amaç beyanı ve dış istek olmaması bunu doğrudan karşılıyor.

## 16. Riskler

| Risk | Etki | Azaltma |
|---|---|---|
| Anthropic DOM'u değişir | Buton enjekte edilemez | `SEL` katmanı, tek dosyada tamir |
| Konuşma API şeması değişir | Versiyon geçmişi kaybolur | Üç kademeli fallback, DOM her zaman çalışır |
| `tool_use` şeması varsayımı yanlış | Parser boş döner | Implementation'ın **ilk adımı** gerçek JSON dump'ı ile şema doğrulama |
| Web Store geniş host iznini sorgular | Yayın gecikir | Tek amaç beyanı + sıfır dış istek + gizlilik politikası hazır |
| Çok uzun konuşmada fetch yavaş | Buton geç yanıt verir | Cache + buton üzerinde yükleniyor durumu |

---

## Uygulama sırası (özet)

1. Gerçek konuşma JSON'u dump'la, `tool_use` şemasını doğrula
2. `parse.js` + `selftest.js` (TDD)
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

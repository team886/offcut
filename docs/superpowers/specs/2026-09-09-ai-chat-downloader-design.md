# AI Chat Downloader — Tasarım Dokümanı

**Tarih:** 2026-09-09
**Durum:** Tasarım onaylandı ve 23 turluk denetimden geçti; implementation plan bekliyor. **Yetenek matrisindeki `?` alanları hâlâ açık** (§3.4.6) — adım 1 tamamlanmadan hiçbir adaptör yazılmaz
**Hedef:** Chrome MV3 extension, Chrome Web Store'a yayınlanacak
**Kapsam:** **Claude, ChatGPT, Gemini, Perplexity** sohbetlerindeki artifact/canvas'lar, mesaj içi kod blokları ve yüklenen ekler

---

## İçindekiler

- [1. Problem](#1-problem)
- [2. Hedefler / Hedef olmayanlar](#2-hedefler-hedef-olmayanlar)
- [2.1 Ne tür bir ürün — "indirici" dar bir tarif](#21-ne-tur-bir-urun-indirici-dar-bir-tarif)
  - [2.1.1 Omurgaya düşen, henüz yazılmamış üç şey](#211-omurgaya-dusen-henuz-yazilmamis-uc-sey)
  - [2.1.2 İsim — "downloader" kalıyor, sebebi konumlandırma değil keşfedilebilirlik](#212-isim-downloader-kaliyor-sebebi-konumlandirma-degil-kesfedilebilirlik)
- [2.2 FindAgent entegrasyonu — önce ne olduğunu bilmem gerek](#22-findagent-entegrasyonu-once-ne-oldugunu-bilmem-gerek)
  - [2.2.1 Gözlem: FindAgent bir ajan platformu, sohbet arayüzü değil](#221-gozlem-findagent-bir-ajan-platformu-sohbet-arayuzu-degil)
- [3. Kritik iç görü — artifact bir op-log'dur](#3-kritik-ic-goru-artifact-bir-op-logdur)
  - [3.1 Konuşma ağacı — dallanma tuzağı](#31-konusma-agaci-dallanma-tuzagi)
  - [3.2 Yazılmakta olan artifact](#32-yazilmakta-olan-artifact)
  - [3.3 İndirilebilir öğe modeli](#33-indirilebilir-oge-modeli)
  - [3.3.1 Kod blokları](#331-kod-bloklari)
  - [3.3.2 Ekler](#332-ekler)
  - [3.3.3 Konuşmayı taşıma — Markdown ve "başka sağlayıcıda devam et"](#333-konusmayi-tasima-markdown-ve-baska-saglayicida-devam-et)
  - [3.4 Sağlayıcı kaydı ve adaptörler](#34-saglayici-kaydi-ve-adaptorler)
  - [3.4.1 Kendi kendini onaran `chatRoot`](#341-kendi-kendini-onaran-chatroot)
  - [3.4.2 Listede olmayan siteler — kullanıcı izniyle](#342-listede-olmayan-siteler-kullanici-izniyle)
  - [3.4.3 Adaptör sözleşmesi](#343-adaptor-sozlesmesi)
  - [3.4.4 DOM tabanı zorunlu, API isteğe bağlı](#344-dom-tabani-zorunlu-api-istege-bagli)
  - [3.4.4.1 DOM tabanı da garanti değil — erişilebilirlik ön koşulu](#3441-dom-tabani-da-garanti-degil-erisilebilirlik-on-kosulu)
  - [3.4.5 Yetenek matrisi](#345-yetenek-matrisi)
  - [3.4.6 Yalıtım](#346-yalitim)
- [4. Veri kaynağı — üç kademe (Claude adaptörü)](#4-veri-kaynagi-uc-kademe-claude-adaptoru)
  - [4.1 Kademe 1 otomatik olarak "gerçek" değildir](#41-kademe-1-otomatik-olarak-gercek-degildir)
- [4.2 Yüzeyler — extension tek tüketici, çekirdek taşınabilir](#42-yuzeyler-extension-tek-tuketici-cekirdek-tasinabilir)
- [4.3 Oturumlar arası hafıza — indirme kütüphanesi](#43-oturumlar-arasi-hafiza-indirme-kutuphanesi)
- [4.4 Çoklu-model sidebar — neden bu ürün değil](#44-coklu-model-sidebar-neden-bu-urun-degil)
- [5. Mimari](#5-mimari)
- [6. Modül sözleşmeleri](#6-modul-sozlesmeleri)
  - [parse.js (saf) — çekirdek](#parsejs-saf-cekirdek)
  - [zip.js (saf)](#zipjs-saf)
- [7. Boru hattı](#7-boru-hatti)
  - [7.1 Eşzamanlılık](#71-eszamanlilik)
  - [7.2 Yaşam döngüsü](#72-yasam-dongusu)
- [8. UI kararları](#8-ui-kararlari)
  - [8.1 İndirme kontrolü — split buton](#81-indirme-kontrolu-split-buton)
  - [8.1.1 Kod bloğu kontrolü — tek gezici düğme, N enjeksiyon değil](#811-kod-blogu-kontrolu-tek-gezici-dugme-n-enjeksiyon-degil)
  - [8.2 Versiyon menüsü (popover)](#82-versiyon-menusu-popover)
  - [8.2.1 Sohbet seviyesi zip](#821-sohbet-seviyesi-zip)
  - [8.3 Pulse pill — panelin sağ altı](#83-pulse-pill-panelin-sag-alti)
  - [8.4 Toast](#84-toast)
  - [8.5 Logo](#85-logo)
  - [8.6 Ayar paneli (popup = options)](#86-ayar-paneli-popup-options)
  - [8.6.1 Popup etkileşim modeli](#861-popup-etkilesim-modeli)
  - [8.7 Stil izolasyonu, erişilebilirlik, dosya yazımı](#87-stil-izolasyonu-erisilebilirlik-dosya-yazimi)
  - [8.7.1 Sürükle-bırak](#871-surukle-birak)
  - [8.7.2 Klasöre kaydet (File System Access)](#872-klasore-kaydet-file-system-access)
  - [8.8 İlk çalıştırma ve boş durumlar](#88-ilk-calistirma-ve-bos-durumlar)
  - [8.8.1 Kendi bozulduğunu fark etmek](#881-kendi-bozuldugunu-fark-etmek)
  - [8.9 Teşhis — telemetri olmadan hata raporu](#89-teshis-telemetri-olmadan-hata-raporu)
- [9. Ayar şeması](#9-ayar-semasi)
- [10. Mesajlaşma protokolü](#10-mesajlasma-protokolu)
- [11. Hata matrisi](#11-hata-matrisi)
  - [11.1 Hangi sayılar ayarlanabilir, hangileri değil](#111-hangi-sayilar-ayarlanabilir-hangileri-degil)
  - [11.2 Etkileşim semantiği — ayarların kesiştiği yerler](#112-etkilesim-semantigi-ayarlarin-kesistigi-yerler)
- [12. DOM bağımlılık katmanı](#12-dom-bagimlilik-katmani)
  - [12.1 DOM'dan metin okuma kuralları](#121-domdan-metin-okuma-kurallari)
- [13. i18n](#13-i18n)
- [14. Test](#14-test)
- [15. Chrome Web Store teslimatları](#15-chrome-web-store-teslimatlari)
- [16. Riskler](#16-riskler)
- [17. Güvenlik](#17-guvenlik)
  - [17.1 Yayıncı hesabı — asıl tedarik zinciri](#171-yayinci-hesabi-asil-tedarik-zinciri)
  - [17.2 Gizlilik taahhütleri — değişmez sayılanlar](#172-gizlilik-taahhutleri-degismez-sayilanlar)
- [18. Depo teslimatları](#18-depo-teslimatlari)
- [19. Production readiness](#19-production-readiness)
  - [19.1 Tarayıcı desteği](#191-tarayici-destegi)
  - [19.2 Performans bütçeleri](#192-performans-butceleri)
  - [19.3 Kalite kapıları (CI)](#193-kalite-kapilari-ci)
  - [19.4 Sürümleme ve paketleme](#194-surumleme-ve-paketleme)
  - [19.5 Yayın öncesi kapı](#195-yayin-oncesi-kapi)
  - [19.6 Mağaza gönderimi](#196-magaza-gonderimi)
  - [19.7 Kademeli yayın ve geri alma](#197-kademeli-yayin-ve-geri-alma)
  - [19.8 Yayın sonrası izleme — telemetri olmadan](#198-yayin-sonrasi-izleme-telemetri-olmadan)
  - [19.9 Destek akışı](#199-destek-akisi)
  - [19.10 Bitti tanımı](#1910-bitti-tanimi)
- [Uygulama sırası (özet)](#uygulama-sirasi-ozet)
  - [MVP kesme çizgisi](#mvp-kesme-cizgisi)

---

## Nereden başlamalı

Bu doküman 30+ turluk denetimden geçti ve uzun. Okuma sırası okuyucuya göre değişir:

| Kimsen | Oku |
|---|---|
| **Uygulayacaksan** | §2.1 (ürün ne) → §3.3 (öğe modeli) → §3.4 (kayıt + adaptör) → §6 (modül sözleşmeleri) → **Uygulama sırası** (sonda) → §14 (test). MVP çizgisi orada; çizginin altındakileri şimdi okuma |
| **Tasarımı denetliyorsan** | §3 (op-log), §4.1 (kademelerin ne kaybettiği), §7.1-7.2 (yarış/yaşam döngüsü), §11 (hata matrisi), §17 (güvenlik) |
| **Sağlayıcı ekleyeceksen** | §3.4.1 (kendi kendini onaran kök), §3.4.2 (listede olmayan siteler), §12 (DOM katmanı), `docs/ADDING-A-PROVIDER.md` |
| **Ürün kararı arıyorsan** | §2.1 (omurga ve kapsam ölçütü), §2.1.2 (isim), §4.2 (yüzeyler), §4.4 ve §2.2 (reddedilenler ve neden) |
| **Yayına hazırlıyorsan** | §15 (mağaza), §17.1-17.2 (yayıncı hesabı, gizlilik değişmezleri), §19 (tamamı) |

**Tek cümlelik özet:** AI sohbetlerinde üretilen kodu, belgeleri ve dosyaları çıkaran, sürümleyen, taşıyan ve yeniden kullanılabilir kılan bir tarayıcı extension'ı; kayıt tabanlı çok-sağlayıcı desteği, sıfır dış istek, sıfır telemetri.

**Değişmez ölçüt:** kullanıcının kendi oturumunda **zaten var olan** veriyle yapılabiliyorsa kapsam içi; model çağrısı, anahtar veya sunucu gerekiyorsa kapsam dışı (§2.1).

---

## 1. Problem

AI sohbet arayüzleri içeriği kopyalatır ama **dosya olarak indirtmez**. Bir React bileşenini, bir HTML sayfasını, mesajın ortasındaki bir Python fonksiyonunu ya da üç hafta önce yüklediğin CSV'yi diske almak istediğinde yol hep aynı: kopyala → editör aç → yeni dosya → yapıştır → uzantıyı doğru tahmin et → kaydet. Claude'da artifact'ın önceki bir versiyonuna dönmek istiyorsan hiç yolu yok — panel sadece güncel hâli gösterir.

Bu extension o boşluğu kapatır: **sohbetteki her indirilebilir şeye tek tıkla, doğru uzantıyla, mümkünse istenen versiyonda erişim.**

**Neden sabit bir liste, `<all_urls>` değil.** Genel web indiricisi yönü bilinçle reddedildi: `<all_urls>` host izni Web Store incelemesinin en sık ret sebebi ve kullanıcı güveninin en hızlı kaybı; "tek amaç" beyanı (mağaza formunda zorunlu) çöker. Sabit ve gerekçelendirilebilir bir liste — `claude.ai`, `chatgpt.com`, `gemini.google.com`, `perplexity.ai` — tek amacı korur: *AI sohbet asistanlarından kod ve doküman indirmek*. Dış istek yine yok; her sağlayıcıya yalnızca kullanıcının kendi oturumunda, kendi verisi için gidilir.

**Kabul edilen risk.** Her sağlayıcı arayüzünü bağımsız değiştirir; N sağlayıcı = N bağımsız kırılma takvimi. Baskın maliyet kod değil bakımdır. Bu bilinçli bir karardır (bkz. §16 Riskler); tasarım bunu üç şeyle sınırlar: adaptör yalıtımı, sağlayıcıdan bağımsız DOM tabanı, ve bir adaptör bozulduğunda diğerlerinin etkilenmemesi.

## 2. Hedefler / Hedef olmayanlar

**Hedefler**
- Açık artifact/canvas'ı tek tıkla doğru uzantıyla indir
- Artifact'ın **her versiyonunu** ayrı ayrı indirilebilir yap
- **Mesaj içindeki kod bloklarını** dosya olarak indir (çoğu kod artifact olmuyor)
- **Kullanıcının sohbete yüklediği ekleri** geri indir
- **MCP/araç çağrısı çıktılarını** tam hâliyle indir (§2.1.3) — arayüzün kırptığı hâlini değil
- **Sohbetin tamamını Markdown olarak** indir; istenirse başka bir sağlayıcıda devam ettir (§3.3.3)
- Sohbet uzadığında **bağlam devri** öner (§2.1.1)
- Sohbette **hiç alınmamış** öğeleri göster (§2.1.1)
- Geçmişteki bir öğeyi yeni sohbete **bağlam olarak** kopyala (§2.1.1)
- Bir artifact'ın tüm versiyonlarını tek `.zip` olarak ver
- **Sohbetteki tüm öğeleri** (belge + kod + ek) tek `.zip` olarak ver
- Dosyayı **sürükleyip** editöre/masaüstüne bırakabil
- İstenirse sabit bir **klasöre** kaydet, her seferinde sormadan
- Bir belge **tamamlandığında** görünür ama rahatsız etmeyen bir sinyal ver
- Her davranış kapatılabilir olsun
- Kullanıcı verisi cihazdan çıkmasın

**Hedef değil**
- Toplu hesap yedeği (tüm sohbetleri gezmek)
- Çoklu-model sidebar / çok modelli istemci (§4.4)
- Prompt kütüphanesi, ajan çalıştırma, model kıyaslama — gerekçeleri §2.1'deki tabloda
- Artifact düzenleme / geri yükleme
- Kayıtta olmayan ve kullanıcının izin vermediği siteler (§3.4.2)
- Kurumsal politika ile önceden yapılandırma (`storage.managed`) — talep gelirse eklenir, varsayım olarak inşa edilmez
- Sunucu, hesap, senkronizasyon
- **Çalıştırılabilir paket üretmek.** React artifact'ı tek başına `.tsx` olarak iner; `package.json`, bundler yapılandırması veya HTML sarmalayıcı üretmeyiz. Kullanıcı dosyayı kendi projesine taşır. Bu bilinçli bir sınır: "çalışan proje" üretmek ayrı bir üründür ve her framework için ayrı bakım demektir

**Doğrulanacak ön koşul — adaptörlü her sağlayıcı için.** Adım 1'de her sağlayıcının kendi indirme/dışa aktarma düğmesini eklemiş olup olmadığı kontrol edilir (Claude'da artifact indirme, ChatGPT'de canvas dışa aktarma, Gemini'de Docs'a aktar, Perplexity'de dışa aktar). Eklemişse bu extension'ın değeri "indirme"den "**versiyon geçmişi + zip + toplu erişim**"e kayar; ürün yine geçerli ama mağaza metni ve README buna göre yazılır. Var olan bir düğmenin yanına ikinci düğme koymak, incelemede de kullanıcıda da zayıf durur.

## 2.1 Ne tür bir ürün — "indirici" dar bir tarif

"İndirici" bu ürünün ne yaptığını değil, **ilk özelliğini** anlatıyor. Otuz turdur eklenenlere bakınca omurga netleşti: sürüm geçmişi, sohbet taşıma, indirme geçmişi, sohbetler arası tanıma, Markdown dışa aktarma. Bunların hiçbiri "dosya indirme" değil.

**Omurga:** *AI sohbetlerinden çıkan işi sahiplenmek ve yeniden kullanmak.* Model üretir, sen sahiplenirsin — çıkarmak, sürümlemek, taşımak, hatırlamak, tekrar kullanmak. "LLM'leri iyi kullanmak"ın bu ürüne düşen kısmı budur.

**Bu tarifin dışında bıraktıkları ve nedenleri:**

| Talep | Neden bu ürün değil |
|---|---|
| Prompt kütüphanesi / yönetici | Ayrı bir ürün kategorisi; sohbetten çıkan işle ilgisi yok, tek amaç beyanını böler |
| Çoklu-model istemci | §4.4 — kimlik bilgisi, composer otomasyonu, framing engeli |
| Ajan çalıştırma / otomasyon | Kimlik bilgisi ve sunucu gerektirir; §17.2'yi kökten bozar |
| Model kalitesi kıyaslama, prompt puanlama | Model çağırmak demek — bu ürün hiçbir modele istek atmaz |

Ortak ölçüt açık: **kullanıcının kendi oturumunda zaten var olan veriyle** yapılabiliyorsa kapsam içi; bir model çağrısı, bir anahtar ya da bir sunucu gerekiyorsa kapsam dışı. Bu ölçüt otuz turdur tutarlı kaldı ve tek amaç beyanını (§19.6) da o koruyor.

### 2.1.1 Omurgaya düşen, henüz yazılmamış üç şey

Kimlik bilgisi gerektirmeyen, elimizdeki veriyle çalışan:

**Bağlam devri.** Uzun sohbette model erken kısımları unutmaya başlar; kullanıcı bunu genelde geç fark eder. Eşik ölçüsü kademeye göre değişir ve **mesaj sayısı her zaman elde değildir**: API kademesinde mesaj sayısı doğrudan gelir, DOM kademesinde ise sayfadaki mesaj düğümleri sayılamayabilir (sanallaştırma, §4). Kural: mesaj sayısı güvenilir değilse **karakter toplamı** kullanılır (kod blokları + görünür metin); ikisi de yoksa öneri hiç çıkmaz — yanlış eşikle davetsiz öneri, önerinin kendisinden kötüdür. Sohbet belirgin biçimde uzadığında popup'ta sessiz bir öneri: `Bu sohbet uzadı — bağlamı yeni bir sohbete taşı`. Taşıma zaten var (§3.3.3); eklenen tek şey **hazır bir devir promptu**: Markdown'ın başına *"Aşağıda önceki konuşmam var. Özetini çıkar ve kaldığımız yerden devam et."* Model çağrısı yok, sadece kullanıcının yapıştıracağı metnin doğru biçimlenmesi.

**Kaybolmuş işi bulmak.** Bu yalnızca **geçmiş açıkken** mümkün (§4.3) — kapalıyken "hiç almadın" bilgisi yok ve gösterge hiç çizilmez (§3.4.5 kuralı). Uzun bir sohbette üretilmiş ama hiç indirilmemiş öğeler, geçmiş açıkken bilinebiliyor. Popup: `Bu sohbette 6 öğe var, 2'sini hiç almadın`. En sık kayıp, farkında olunmayan kayıp.

**Geçmişten bağlam olarak yeniden kullanma.** Geçmişteki bir öğeyi (§4.3) yeni bir sohbete **bağlam olarak** panoya koymak: `⧉ Bağlam olarak kopyala` → ad + dil + içerik, fenced. "Geçen ay yazdığım şu bileşeni referans vererek devam et" akışı, indirip açıp kopyalamadan. Geçmiş zaten hash ve yol tutuyor; eksik olan tek şey bu düğme.

Üçü de aynı sınırın içinde: **var olan veriden**, model çağrısı olmadan, kullanıcının eylemiyle.

### 2.1.2 İsim — "downloader" kalıyor, sebebi konumlandırma değil keşfedilebilirlik

Omurga "indirici"den geniş (§2.1), yani isim ürünü eksik anlatıyor. Yeniden adlandırma cazip; **yapmıyoruz.**

Gerekçe: mağaza aramasında insanlar niyetlerini yazıyor — *"download chatgpt code"*, *"save claude artifact"*. Bu terimler ürünün **ilk işi** ve kullanıcının kafasındaki kelime. Soyut bir ad (`Chat Keeper`, `Artifact Vault`) konumlandırmayı kazanır, keşfedilebilirliği kaybeder — ve keşfedilmeyen bir ürünün konumlandırması kimseye ulaşmaz.

Doğru ayrım: **isim işi söyler, açıklama omurgayı söyler.**
- İsim: `AI Chat Downloader` — arama terimi burada
- Kısa açıklama (132 karakter): omurga cümlesi — *"Sohbetlerinden çıkan kodu ve belgeleri çıkar, sürümle, taşı ve yeniden kullan."*
- Uzun açıklamanın ilk paragrafı: izin uyarısını karşılar (§15), ikincisi omurgayı açar

Bu, ürünün kendini iki farklı yerde iki farklı şekilde tanıtması değil — **aynı ürünün girişi ve tarifi.** Tek amaç beyanı (§19.6) omurga cümlesiyle birebir aynı kalır; ad bir arama anahtarı, beyan değildir.

Yeniden değerlendirme koşulu: kullanıcıların çoğunluğu ürünü indirme dışındaki bir özellik için kuruyorsa (mağaza yorumları ve issue'lardan görülür), ad o zaman tartışılır. Şimdi tartışmak, elde veri yokken kimlik değiştirmek olurdu.

## 2.1.3 MCP araç çıktıları — beşinci öğe türü

FindAgent örneğinden çıkan gözlem (§2.2.2) aslında **FindAgent'a özgü değil**: bir MCP sunucusunun ürettiği her şey, o sohbetin içine düşüyor. Bugün bir sohbette Linear, Sentry, Notion, GA4, Postman, Slack, kendi yazdığın bir sunucu — onlarca araç çağrılıyor ve hepsinin çıktısı konuşmanın parçası oluyor.

Bu, "AI sohbetlerinde üretilen işin" **en hızlı büyüyen kısmı** ve şu an bu ürünün göremediği tek kısım.

**`kind: "tool_output"` ekleniyor.** Araç çağrısı sonucu birinci sınıf bir öğe olur:

| Alan | Kaynak |
|---|---|
| Ad | Araç adı + çağrı sırası: `search_events-2`, `list_agent_runs-1`. Sıra numarası **her zaman** eklenir — aynı araç bir kez çağrılmış olsa bile; sonradan ikinci çağrı geldiğinde adların yeniden numaralanması, geçmişteki (§4.3) kaydı geçersiz kılardı |
| Uzantı | İçerik şekline göre: nesne/dizi → `.json`; düz satır+sütun → `.csv`; metin → `.md`; ikili → sunucunun verdiği tip |
| İçerik | `tool_result` bloğunun **tamamı** — arayüzün gösterdiği kısaltılmış hâli değil |
| Sürüm | Yok; her çağrı ayrı bir öğedir (aynı araç 5 kez çağrıldıysa 5 öğe) |

### 2.1.3.0 Çağrı, sonucun yarısıdır

Bir araç sonucunu saklamanın sebebi genelde sonucun kendisi değil, **onu üretebilmek**: hangi araç, hangi parametrelerle, ne zaman. Altı ay sonra elinde 214 satırlık bir JSON varsa ve hangi tarih aralığıyla çekildiğini bilmiyorsan, o dosya veri değil gürültüdür.

`tool_use` bloğu zaten aynı yanıtın içinde ve **parametreleri taşıyor**. Kural: her `tool_output` öğesi çağrısını da taşır.

- `.json` çıktılarda: sarmalayıcı bir nesne — `{ "_call": { "tool", "params", "at" }, "result": … }`. JSON'un içine yorum konamaz, sarmalamak tek temiz yol; `result` anahtarı sabit olduğu için otomasyonla ayrıştırmak da kolay kalır
- `.csv` çıktılarda: dosyanın başında `#` ile başlayan iki yorum satırı — çoğu araç bunları atlar, atlamayanlar için ayarda kapatılabilir
- `.md` çıktılarda: üstte küçük bir front-matter bloğu

Kullanıcı bunu kapatabilir (`includeCall`), ama **varsayılan açık**: bağlamsız bir sonuç dosyası, altı ay sonra silinen dosyadır.

### 2.1.3.1 Burası DOM'un en çok yalan söylediği yer

Araç çıktıları arayüzlerde **varsayılan olarak katlanmış** ve çoğu zaman kırpılmış gösteriliyor — "500 satır sonuç" yazıp ilk 10 satırı açan bir kutu. §12.1'deki bütün DOM tuzakları burada aynı anda geçerli: katlanmış içerik, sanallaştırma, UI parçaları (genişlet düğmesi, satır sayacı) kod düğümünün içinde.

Sonuç iki yönlü:
- **API kademesi burada zorunlu gibi.** `content[]` içindeki `tool_use`/`tool_result` blokları yapısal gelir; sınırlar veriden değil şemadan (§4). Araç çıktısı desteği, bir sağlayıcıda API kademesi varsa **tam**, yoksa **en iyi ihtimalle kısmi** olur ve öğe `⚠ kırpılmış olabilir` işaretlenir
- Yetenek matrisine (§3.4.5) yeni satır: **araç çıktısı** — `api` yeteneğine bağlı

### 2.1.3.2 Neden bu, sıradan bir "bir tür daha" değil

Bir kod bloğunu kaybedersen modelden yeniden isteyebilirsin. Bir **araç çıktısını** kaybedersen — 40 ilanın skoru, bir haftalık GA4 anomali listesi, 200 satırlık bir sorgu sonucu — onu geri getirmek aracı **yeniden çalıştırmak** demek: zaman, kota, bazen para, ve veri o arada değişmişse **aynı sonuç bir daha gelmez.**

Yani araç çıktısı, bu ürünün taşıdığı öğeler arasında **en pahalı yeniden üretilebilen** olanı. Sahiplenmenin değeri en yüksek olduğu yer burası.

**Gizlilik notu:** araç çıktıları genelde düz metinden **daha hassas** (analitik, müşteri listesi, hata kayıtları). Yeni bir kural gerekmiyor — §17'deki her şey aynen geçerli — ama teşhis bloğunun (§8.9) araç adlarını bile taşımaması gerektiği burada özellikle geçerli: araç adı tek başına iş bilgisi sızdırabilir.

## 2.2 FindAgent entegrasyonu — önce ne olduğunu bilmem gerek

FindAgent'ın bu üründe nasıl yer alacağı, **onun hangi yüzeye sahip olduğuna** bağlı ve bunu bilmiyorum. Uydurmak yerine üç olası şekli ve maliyetlerini yazıyorum; hangisi doğruysa spec o dala göre yazılır.

| FindAgent'ın yüzeyi | Entegrasyon | Maliyet |
|---|---|---|
| **Web sohbet arayüzü var** | Kayıt satırı (§3.4). `host` + `name` + `newChatUrl`; `chatRoot` sezgiselden gelir. Kod blokları, indirme, sürükleme, geçmiş, taşıma — hepsi **anında** çalışır | Bir satır. Kayıt modelinin tam olarak var olma sebebi |
| **API/endpoint var** | Taşıma hedefi olarak: `→ FindAgent'a gönder`. Ama bu, veriyi bizim gönderdiğimiz ilk yol olur — kimlik bilgisi, §17.2'nin gözden geçirilmesi, mağaza veri beyanının değişmesi | Yüksek. Ayrı bir güven tasarımı gerekir |
| **MCP sunucusu var** | §4.2'deki MCP yüzeyiyle aynı yön: yerel indirme kütüphanesini FindAgent ajanlarına açmak. Extension'ı değiştirmez, kütüphaneyi tüketir | Orta; ama klasöre kaydetme + geçmiş yaygınlaşmadan anlamsız |

### 2.2.1 Gözlem: FindAgent bir ajan platformu, sohbet arayüzü değil

2026-09-09'da bu oturumda **gözlemlenenler** (varsayım değil; platformun kendi araçları sorgulanarak):

- FindAgent bir **ajan pazaryeri ve yayınlama platformu**: gezinme/satın alma (`browse_agents`, `buy_agent`, `list_categories`), fiyat ve kazanç (`edit_price`, `earnings`), istek panosu (`list_requests`, `vote_request`)
- **Yayınlama hattı**: taslak → `preflight` → `submit_for_review` → `bump_version` / `rollback_version`; ajan kaynağı ya kod (`create_code_draft`, `import_repo`, `connect_github`) ya da uzak MCP (`create_remote_mcp`)
- **Hesap tabanlı**; MCP connector'ı belirli bir hesap adına çalışıyor (`whoami`)
- Satın alınan ajanlar **ajan başına MCP sunucusu** olarak tüketiliyor (`mcp.findagent.cloud`), platform botu `bot.findagent.cloud`; ajanlar ortak bir araç kalıbı paylaşıyor: `list_capabilities` → `plan_inputs` → salt-okunur `fetch_*` → deterministik `score_*`/`detect_*` → LLM anlatılı `run_full`

**Sonuç: birinci dal (kayıt satırı) elenir.** Scrape edilecek bir sohbet arayüzü yok — FindAgent'ta kullanıcı "sohbet etmiyor", ajan kuruyor/satın alıyor. Doğru dal MCP, ama artık **iki ayrı yönü** var ve ikisi farklı şeyler:

**Ama yön kritik ve gizlilik çerçevesini belirliyor:**

| Yön | Değerlendirme |
|---|---|
| **Bizim yerel MCP sunucumuz, FindAgent ajanlarının tükettiği** | Uyumlu. §4.2'deki v3 yüzeyi **stdio/yerel** çalıştığı sürece veri cihazdan çıkmaz ve §17.2 korunur. Kütüphane yerelde durur, ajan yerelde okur |
| **Bizim verimizi FindAgent bulutuna göndermek** | **Uyumsuz.** `findagent.cloud` ve `fly.dev` uzak host'lar; oraya konuşma içeriği ya da indirme kütüphanesi göndermek "dış istek yok" taahhüdünü (§17.2) ve mağaza veri beyanını (§19.6) doğrudan bozar. Yapılacaksa ayrı bir onay akışı, ayrı bir gizlilik politikası ve muhtemelen ayrı bir ürün gerekir |

### 2.2.2 Somut olarak nasıl kullanılır — dörtten biri bugün çalışıyor

FindAgent bir **bağımlılık değil**; bu ürün onsuz eksiksiz. Soru "kullanmalı mıyız" değil, "kullanırsak nerede işe yarar". Dört yol, gerçeklik sırasına göre:

**1. Zaten çalışıyor — sıfır kod.** FindAgent ajanları MCP üzerinden Claude/ChatGPT gibi bir istemcide tüketiliyor; ajanın çıktısı (rapor, tablo, kod, `run_full`'un ürettiği anlatı) **o sohbetin içine** düşüyor. O sohbet bizim desteklediğimiz bir arayüzse, çıktı bizim için sıradan bir öğedir: kod bloğu olarak inebilir, belge ise sürümlenebilir, sohbetin tamamı Markdown'a çevrilebilir. **Bugün, hiçbir entegrasyon olmadan** FindAgent ajanlarının çıktısı bu extension'la sahiplenilebiliyor. İki ürünün gerçek kesişimi burada başlıyor ve maliyeti sıfır.

Tek yapılacak: mağaza metninde ve `README`'de bu kullanım örneği olarak geçmeli — kullanıcı bunu kendiliğinden düşünmez.

**2. Talep ölçümü — bugün, yine kod yazmadan.** FindAgent'ın istek panosu (`list_requests`, `vote_request`) bir talep sinyali. §4.2'deki MCP yüzeyini yazmadan önce oraya bakmak, "kimse benim kod kütüphanemi okuyan bir ajan istiyor mu" sorusunu **varsayım yerine veriyle** cevaplar. Entegrasyon değil, ürün araştırması — ama platformun sunduğu en ucuz şey bu.

**3. Dağıtım — MCP sunucusu yazıldıktan sonra.** FindAgent kod/repo tabanlı ajanları kabul ediyor (`import_repo`, `create_code_draft`). §4.2'deki **yerel MCP sunucumuz** tam olarak bu biçimde bir şey: küçük, bağımlılıksız, kullanıcının makinesinde çalışan bir repo. FindAgent'ta yayınlanması, veri paylaşımı **değil dağıtım** olur — kod kullanıcıya gider, veri hiçbir yere. Gizlilik çerçevesine dokunmaz.

Bu, bu ürünün FindAgent'la en doğal kesişimi: extension veriyi üretir, yerel MCP sunucusu onu ajanlara açar, FindAgent o sunucunun **bulunmasını** sağlar.

**4. Tüketim — koşullu** (aşağıdaki 1. soruya bağlı).

**Karar:** entegrasyon **yerel MCP** yönünde tasarlanır. Bizim tarafımızdaki iş, §4.2'deki MCP yüzeyini FindAgent'ın araç kalıbıyla **uyumlu** yazmaktır — `list_capabilities` ile ne sunduğumuzu bildiren, `plan_inputs` ile girdi şemasını veren, salt-okunur `fetch_*` ile kütüphaneyi açan bir sunucu. Aynı kalıbı izlemek, FindAgent ajanlarının bizi ekstra uyarlama olmadan tüketebilmesi demek.

**Önkoşul sırası değişmiyor:** klasöre kaydetme (v1) → indirme geçmişi (§4.3) → yerel MCP sunucusu (§4.2 v3) → FindAgent uyumu. Kütüphane birikmeden ajana açılacak bir şey yok.

**Cevaplanmamış iki soru:**
1. FindAgent ajanları yalnızca bulutta mı çalışıyor, yoksa kullanıcının makinesindeki bir MCP sunucusunu da tüketebiliyor mu? "Yalnızca bulut" ise **tüketim** yönü yapılmaz — tek yolu veriyi dışarı göndermek olurdu.
2. Pazaryeri, kullanıcının kendi makinesinde çalışan (self-hosted) bir ajanı listelemeye izin veriyor mu? Veriyorsa **dağıtım** yönü, birinci sorunun cevabından bağımsız olarak geçerlidir.

İkisi de platformun kuralına bağlı, bizim tasarımımıza değil — o yüzden burada karar değil, **koşul** olarak duruyorlar.

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

**Replay doğrulaması:** `update` uygularken `old_str` gövdede bulunamazsa o versiyonun rekonstrüksiyonu güvenilmez. O versiyon `ok:false` işaretlenir, UI'da `⚠ kısmi` görünür, dosya adına `-partial` eklenir — **uzantıdan önce, şablon uygulandıktan sonra**: `Sales-Dashboard-v2-partial.tsx`. Şablonun içine gömülmez, çünkü kullanıcının şablonunda `{version}` olmayabilir ve uyarının kaybolmaması gerekir. Sessizce yanlış içerik verilmez.

**`old_str` tekil olmalı.** Gövdede birden fazla kez geçiyorsa hangisinin değiştirileceği belirsizdir — ilkini değiştirip devam etmek sessizce yanlış dosya üretir. Kural: **0 eşleşme → `ok:false`; 2+ eşleşme → `ok:false`, `reason:"old_str_ambiguous"`; tam 1 eşleşme → uygula.** JS `String.replace` ilk eşleşmeyi değiştirir; bu davranışa güvenilmez, eşleşme sayısı açıkça sayılır.

**`old_str` eşleşmemesinin en olası sebebi satır sonudur.** Gövde `\r\n` taşıyıp `old_str` `\n` kullanıyorsa (veya tersi) eşleşme tutmaz. Bunu sessizce normalize edip uygulamak **içeriği değiştirmek** olur — yapmıyoruz. Bunun yerine mismatch raporlanır ve `docs/BREAKAGE.md` bu ihtimali ilk tanı maddesi olarak listeler. Aynı şekilde boş gövdeli bir `create` geçerli sayılır (0 baytlık dosya iner), çökme sebebi değildir.

**Başlık versiyona göre değişebilir.** Claude bir güncellemede artifact'ı yeniden adlandırabilir. Her `Version` kendi `title`'ını taşır; dosya adı **indirilen versiyonun** başlığından üretilir, artifact'ın güncel başlığından değil.

### 3.0.1 Fold'un kenar durumları

Fold basit görünüyor ama op akışı her zaman düzgün gelmiyor. Dördü de gerçek ve hiçbiri istisna atmamalı:

| Durum | Davranış | Neden |
|---|---|---|
| Aynı `artifactId` için **ikinci bir `create`** | Yeni bir versiyon zinciri **başlatılmaz**; `rewrite` gibi ele alınır ve versiyon sayacı devam eder | Kullanıcı için o hâlâ "aynı artifact'ın yeni hâli". Sayacı sıfırlamak menüde iki kez `v1` gösterirdi |
| Hiç `create` görmeden gelen `update` | O artifact `ok:false`, `reason:"no_base"`; menüde `⚠ temel bulunamadı`, indirilebilir sürüm yok | Dal budandığında ya da API pencerelediğinde (§4.1) olur. Boş bir gövdeye `update` uygulayıp "dosya" demek, uydurulmuş içerik demektir |
| Ops arasında **`type`/`language` değişmiş** (html → react) | Uzantı **versiyon başına** hesaplanır; `v2.html` ve `v3.tsx` yan yana durabilir | Tip artifact'ın değil, o sürümün özelliği. Hepsine son tipi vermek eski sürümü yanlış uzantıyla indirmek olurdu |
| DOM'da hiç görünmeyen `artifactId` | Öğe listede kalır, `⚠ panelde yok` etiketiyle | Silinmiş ya da eski bir daldan gelmiş olabilir; kullanıcının erişimini kesmek yerine durumu söylemek |

Ortak ilke, dokümanın geri kalanıyla aynı: **belirsiz girdi sessiz çıktıya dönüşmez.** Fold hiçbir durumda tahmin etmez; ya sağlam bir sürüm üretir ya da neden üretemediğini söyler.

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
  kind: "artifact" | "code" | "attachment" | "conversation" | "tool_output",
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
Bu tablo **çekirdeğe** aittir ve tüm sağlayıcılarda ortaktır; §6'daki MIME tablosu yalnızca Claude adaptörünündür.

Uzantı fence dilinden gelir; dil yoksa ve içerik ayırt edilemiyorsa `.txt`. Versiyon kavramı yok (`versions` tek elemanlı).

**Türetilen adlar çakışabilir.** Aynı sohbette iki blok da `class OrderService` içerebilir; ikisi de `order-service.py` olur. Tek dosya indirmede Chrome `(1)` ekler, ama **zip içinde iki özdeş ad bozuk arşiv demektir**. Kural: zip'e eklenirken `kod/` altında ad çakışması sayılır ve ikinciden itibaren `-2`, `-3` eklenir. Aynı kural klasöre kaydetmede de geçerli (§8.7.2).

**Üç satırdan kısa bloklar atlanır.** Ölçü **boş olmayan satır** sayısıdır (`trim()` sonrası boş olanlar sayılmaz), böylece iki satırlık kod + üç boş satır kontrol almaz. Tek satırlık `npm install x` veya bir değişken adı dosya değildir; her birine kontrol koymak arayüzü çöplüğe çevirir. Eşik `MIN_CODE_LINES = 3` olarak tek yerde tanımlıdır.

### 3.3.2 Ekler

Kaynak: konuşma yanıtındaki dosya/ek kayıtları. İçerik mesajda gömülü değildir; ayrı bir indirme isteği gerekir — yani **tek kaynak ki ek ağ maliyeti var**, ve yalnızca kullanıcı o eki indirmek istediğinde yapılır.

Ekler **ikili olabilir** (PDF, xlsx, png). Kural: içerik hiçbir zaman metne çevrilmez, `ArrayBuffer` olarak alınıp aynen yazılır; `TextEncoder`/`TextDecoder` yoluna sokulmaz — aksi hâlde bozuk dosya üretilir. Ad ve uzantı sunucudaki adından gelir, `sanitize`'dan geçer, tahmin edilmez.

**Toplu indirme bizi tarayıcıya çevirebilir.** 20 ekli bir sohbetin zip'i, arka arkaya 20 istek demektir — sayfanın hiçbir koşulda yapmayacağı bir şey ve §16'daki kendi kuralımızın ("sayfanın atmayacağı istek atılmaz") doğrudan ihlali. Bot koruması bunu tam olarak böyle görür ve sonucu kullanıcının **oturumunu** etkileyebilir; bizim özelliğimiz için kullanıcıya bedel ödetmek kabul edilemez.

Kural: ek indirmeleri **sıralı** (eşzamanlılık 1), aralarında küçük bir gecikmeyle (~150 ms) yapılır ve toplu işlemde ilerleme çubuğu zaten görünür (§8.6) — yani yavaşlık gizlenmiyor, gösteriliyor. Herhangi bir istek 429/403 dönerse toplu işlem **durur**, o ana kadar toplananlar zip'lenmez, kullanıcıya `Sağlayıcı isteği sınırladı — daha az öğe seçip tekrar deneyin` denir. Yarım arşiv üretmiyoruz (§11) ve sınırı zorlamıyoruz.

Aynı disiplin belge/kod için gerekmiyor: onlar zaten çekilmiş konuşma yanıtının içinden geliyor, ek istek yok.

**Doğrulanacak (adım 1):** ek indirme endpoint'i ve yanıt biçimi. Belirlenemezse ekler kapsamdan **çıkarılır** — artifact ve kod tek başına ürünü ayakta tutar; çalışmayan bir feature'ı yarım bırakmaktansa hiç söz vermemek iyidir.

### 3.3.3 Konuşmayı taşıma — Markdown ve "başka sağlayıcıda devam et"

Konuşmanın tamamı zaten elimizde (§4). Onu **Markdown'a** çevirmek yeni veri gerektirmiyor, yalnızca biçimlendirme: mesaj rolleri başlık, kod blokları fenced (dili korunarak), belgeler `## <başlık>` + fenced gövde, ekler ad listesi olarak.

**Araç çıktıları Markdown'a gömülmez.** 500 satırlık bir JSON'u konuşma metnine koymak, dosyayı okunamaz ve taşınamaz yapar — üstelik taşımanın amacı bağlam aktarmak, veri dökmek değil. Kural: araç çağrısı **özetlenir** (`> 🔧 search_events → 214 sonuç · ayrı dosyada`), tam içerik ayrı bir `tool_output` öğesi olarak kalır. Sohbet zip'inde ikisi birlikte gider: `sohbet.md` özeti taşır, `arac-ciktilari/` tamını. Kullanıcı bağlamı yapıştırırken 500 satır yapıştırmaz. Bu, ürünün zaten sahip olduğu veriden çıkan **üçüncü öğe türü**: `kind: "conversation"`.

İki eylem:

Panoya yazma `navigator.clipboard.writeText` ile ve **kullanıcı hareketiyle** yapılır; popup'ta tık zaten hareket sayılır, ayrı bir izin gerekmez. Adım 1'de doğrulanır — gerekirse `clipboardWrite` izni eklenir, ama gereksizse eklenmez (izin yüzeyi).

**`↓ Sohbeti .md indir`** — dosya olarak iner. Diğer her şeyle aynı boru hattı; ayrı bir mekanizma yok.

**`→ Başka sağlayıcıda devam et`** — hedef seçilir, konuşma Markdown'ı **panoya** yazılır ve hedefin yeni sohbet sayfası yeni sekmede açılır. Kullanıcı yapıştırır.

**Neden yazma kutusuna otomatik enjekte etmiyoruz** — üç sebep, üçü de kalıcı:
1. Sağlayıcı başına yeni bir seçici yüzeyi (composer) demek; kırılma yüzeyimizi bir kat daha artırır ve kayıt modelinin (§3.4) ucuzluğunu bozar
2. Veriyi başka bir şirkete gönderen eylem **kullanıcının kendi eylemi** olmalı. Pano + yapıştır bunu sağlıyor; otomatik doldurma, gizlilik taahhüdümüzün (§17.2) kenarına yaslanıyor
3. Uzun konuşma hedefin bağlam sınırını sessizce aşar; yapıştırmayı kullanıcı yaptığında ne kadarının gittiğini görür

**Boyut uyarısı.** Markdown 100 KB'ı aşıyorsa panoya yazmadan önce uyarı çıkar: `Sohbet ~N bin kelime — hedef sağlayıcı tamamını kabul etmeyebilir` + `Yalnızca son 20 mesaj` seçeneği. Sessizce kırpmıyoruz, seçeneği kullanıcıya veriyoruz.

**Ne kaybolur, açıkça yazılır.** Hedefte artifact'lar artifact olmaz, kod blokları kod bloğu kalır ama sürüm geçmişi yoktur, ekler taşınmaz (dosyaların kendisi gitmez, adları listelenir). Bu `docs/LIMITATIONS.md`'de ve taşıma ekranında yazılıdır — "devam ettirme" tam bir kopya değil, **bağlam aktarımı**.

Kayıt satırına tek alan ekler: `newChatUrl`. Adaptör gerektirmez; taban seviyedeki her sağlayıcı hem kaynak hem hedef olabilir.

### 3.4 Sağlayıcı kaydı ve adaptörler

**Neden dört değil.** Önceki sürüm sağlayıcı başına bir adaptör varsayıyordu ve dört sağlayıcıyı "kabul edilmiş bakım riski" olarak yazıyordu. Bu yanlış muhasebeydi: kod bloğu çıkarımı **zaten sağlayıcıdan bağımsız** (§3.4.4), yani bir sağlayıcıyı taban seviyede desteklemenin maliyeti bir adaptör değil, **bir kayıt satırı**. Pahalı olan belge/versiyon/ek katmanı — ve o katman AI sohbet arayüzlerinin çoğunda **hiç yok**.

Doğru model iki katmanlı:

**1. Kayıt (registry) — taban destek.** Paket içinde gömülü bir tablo (uzak kod yok, §17):
```js
{ id: "deepseek", host: "chat.deepseek.com", chatRoot: "…",
  name: "DeepSeek", newChatUrl: "https://chat.deepseek.com/" }
```
Bir satır = kod bloğu indirme, doğru ad ve uzantı, sürükle-bırak, klasöre kaydet, zip, filtre, seçim. Yeni sağlayıcı eklemek bir PR'da bir satır ve bir fixture; adaptör yazılmaz.

**2. Adaptör — gelişmiş destek.** Yalnızca belge/canvas, versiyon geçmişi, ek veya API kademesi sunan sağlayıcılar için. Sözleşme aşağıdaki gibidir ve kayıt satırının üstüne biner. Claude (artifact + op-log) ve ChatGPT (canvas) buraya girer; Gemini Canvas ve benzerleri adım 1'de ölçülür.

**Bakım muhasebesi düzeliyor:** taban sağlayıcı kırıldığında tamir tek bir `chatRoot` seçicisidir ve `LAST_VERIFIED` mekanizması (§19.8) zaten sağlayıcı başına çalışıyor. Yirmi taban sağlayıcı, dört adaptörden **daha ucuz**dur.

### 3.4.1 Kendi kendini onaran `chatRoot`

Kayıt satırının tek kırılgan alanı `chatRoot`. Sağlayıcı düzenini değiştirdiğinde seçici tutmaz ve kullanıcı, tek satırlık bir düzeltme için **mağaza inceleme süresini** beklemek zorunda kalır (günler). Kayıt modelinin ucuzluğu burada bedele dönüşür.

Çözüm, seçiciyi zorunlu olmaktan çıkarmak: **`chatRoot` bir ipucudur, dayanak değil.**

1. `SEL.chatRoot` varsa ve tutuyorsa kullanılır (hızlı yol)
2. Tutmuyorsa sezgisel: sayfadaki tüm `pre > code` düğümlerinin **en yakın ortak atası** hesaplanır. Kod bloklarını içeren kapsayıcı, tanım gereği aradığımız köktür
3. Sayfada hiç `pre > code` yoksa zaten yapacak iş yok — sessiz kalınır (§3.4.2'daki aynı koşul)

Sezgisel yol, seçicili yoldan yalnızca birkaç DOM sorgusu pahalı ve **her sağlayıcıda çalışır** — çünkü hiçbir sağlayıcıya özgü bilgi kullanmıyor.

Sonuçları büyük:
- Bir sağlayıcı düzenini değiştirdiğinde kod bloğu indirme **çalışmaya devam eder**; acil sürüm gerekmez
- Kayıtta olmayan bir site için `chatRoot` yazmak **zorunlu değil** — kullanıcının izin verdiği host (§3.4.2) hiçbir kayıt satırı olmadan çalışır
- Yeni sağlayıcı eklemek çoğu zaman yalnızca `host` + `name` + `newChatUrl` demek

Teşhis bloğu hangi yolun kullanıldığını yazar (`chatRoot: seçici` / `chatRoot: sezgisel`). Sezgisele düşen bir sağlayıcı, kayıt satırının güncellenmesi gerektiğinin sinyalidir — ama **acil** değil, planlı.

### 3.4.2 Listede olmayan siteler — kullanıcı izniyle

Kendi barındırdığı arayüzler (Open WebUI, LibreChat, kurum içi kurulumlar) sabit bir hosta sahip değil; kuyruğu kayıtla kapatmak imkânsız. Çözüm **`optional_host_permissions`**: popup'ta `Bu sitede de çalıştır` düğmesi, `chrome.permissions.request({origins:[…]})` çağırır ve izin verilirse `chrome.scripting.registerContentScripts` ile taban script o hosta kaydedilir.

Neden doğru çözüm bu: kurulumda istenen izin listesi **büyümüyor**, karar kullanıcıya ait ve o an veriliyor, `<all_urls>` yok. Kullanıcı istediği zaman geri alabiliyor. Verilen hostlar `storage`'da tutulur ve popup'ta listelenip tek tek kaldırılabilir.

Bu düğme yalnızca sayfada `pre > code` bulunan yerlerde etkinleşir — rastgele bir sitede izin istemek anlamsız ve incelemede kötü görünür.

### 3.4.3 Adaptör sözleşmesi

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
  codeBlocks(),          // opsiyonel — common-dom.js varsayılanını geçersiz kılar (§3.4.4)
  LAST_VERIFIED,         // "YYYY-MM-DD" — CI tazelik kapısı (§19.3 kapı 13)
}
```

Sözleşme **tam** olmak zorunda: bir feature'ın (ek indirme, sohbet zip'i, tazelik kapısı) adaptörden bir şey istemesi ama sözleşmede karşılığının bulunmaması, o feature'ı adaptör yazarken keşfedilen bir sürprize çevirir. Yukarıdaki liste §2'deki her hedefi karşılar.

**Çekirdekte ne var:** öğe modeli, versiyon fold'u, zip, `sanitize`, adlandırma zinciri, indirme yolları, sürükle-bırak, klasöre kaydet, UI kabuğu (buton, menü, pill, toast), ayarlar, teşhis. Bunlar bir kez yazılır.

### 3.4.4 DOM tabanı zorunlu, API isteğe bağlı

Her adaptör **DOM kademesini uygulamak zorundadır**; API kademesi opsiyoneldir. Böylece bir sağlayıcının dahilî API'si bulunamasa, değişse veya direnç gösterse bile ürün o sağlayıcıda çalışmaya devam eder — sadece daha az yetenekle.

Bunu mümkün kılan gözlem: **DOM kod-bloğu çıkarımı neredeyse sağlayıcıdan bağımsız.** Dördü de kod bloğunu `pre > code` olarak, dili bir sınıf adıyla çizer. Ortak varsayılan, dili şu sırayla arar ve ilk bulduğunu kullanır: `data-language` / `data-lang` özniteliği → `language-*` sınıfı → `hljs` yanındaki dil sınıfı → `pre`'nin aynı özniteliklerinden biri. Hiçbiri yoksa dil bilinmiyor sayılır ve uzantı `.txt` olur — tahmin edilmez.

Gezici düğme `SEL.chatRoot` üzerinde tek bir `mouseover`/`focusin` delegasyonuyla çalışır; her blok için ayrı dinleyici bağlanmaz (uzun sohbette yüzlerce dinleyici demek olurdu). Çekirdek bunun **ortak varsayılan implementasyonunu** taşır; adaptör yalnızca farklıysa geçersiz kılar. Kod blokları — yani değerin büyük kısmı — dört sağlayıcıda tek kod yoluyla çalışır.

### 3.4.4.1 DOM tabanı da garanti değil — erişilebilirlik ön koşulu

"DOM kademesi her zaman çalışır" (§3.4.4) bir varsayım, kanıt değil. İki durumda **hiç** çalışmaz ve ikisi de adım 1'de ölçülmeli:

**Kapalı shadow root.** Sağlayıcı sohbet arayüzünü `attachShadow({mode:"closed"})` ile çizdiyse, content script o ağacı **hiçbir biçimde** okuyamaz — `querySelector` girmez, `shadowRoot` `null` döner. Açık shadow root sorun değil (`element.shadowRoot` üzerinden inilir, `SEL` yolları shadow sınırlarını geçecek şekilde yazılır); kapalı olan kesin engeldir. Web bileşeni kullanan modern arayüzlerde gerçek bir ihtimal.

**iframe.** Konuşma ayrı bir `iframe` içinde çiziliyorsa content script ana çerçevede kalır ve içeriği göremez. Çözüm `all_frames: true` + çerçeve kaynağının host iznine eklenmesi — ama bu izin yüzeyini genişletir ve inceleme sorusu üretir, o yüzden gerçekten gerekliyse yapılır, ihtimale karşı değil.

**Bir sağlayıcı erişilemezse ne olur.** Kapalı shadow root varsa ve API kademesi de yoksa o sağlayıcı için yapılabilecek bir şey yoktur. Karar: o sağlayıcı **kapsamdan çıkarılır** — manifest'ten host izni ve `content_scripts` bloğu silinir, mağaza listelemesinde adı geçmez, `sites` ayarında görünmez. Yarım çalışan bir sağlayıcı hem kullanıcı için hem inceleme için hem bakım için üçlü zarardır.

Bu, kayda giren her sağlayıcının **ön koşuludur**: eklenmeden önce sırayla `chatRoot` bulunabiliyor mu, kod bloğu metni okunabiliyor mu, ana çerçevede mi. Üçü de olumluysa sağlayıcı listede kalır. Mağaza metni ancak bu ölçümden sonra yazılır — desteklenmeyen bir sağlayıcıyı listelemek, incelemede yanlış beyandır.

### 3.4.5 Yetenek matrisi

| | Claude | ChatGPT | Gemini | Perplexity |
|---|---|---|---|---|
| **DOM erişilebilir** (kapalı shadow root / iframe yok) | ? | ? | ? | ? |
| Kod blokları (DOM) | ✓* | ✓* | ✓* | ✓* |
| **Araç çıktısı** (`tool_output`) | api'ye bağlı | api'ye bağlı | api'ye bağlı | api'ye bağlı |
| Panel/canvas belgesi | ✓ artifact | ✓ canvas | — | — |
| **Versiyon geçmişi** | ✓ op-log (§3) | ? canvas sürümleri | ✗ | ✗ |
| Ekler | ? | ? | ? | ? |
| API kademesi | ? | ? | ? | ? |

`✓*` = ilk satır olumluysa geçerli. `?` = **adım 1'de sağlayıcı bazında keşfedilecek.** Bu spec hiçbir sağlayıcının dahilî API şemasını bildiğini iddia etmiyor; Claude için bile şema doğrulaması ilk iş (§4). Keşif çıktısı her adaptör için: konuşma kimliği nereden okunur, API var mı, yanıt şekli, akış tespiti, `SEL` seçicileri, ek endpoint'i.

**`capabilities` statik yazılır, çalışma anında yalnızca *daralabilir*.** Adaptör dosyasında keşif sonucuna göre sabit tanımlanır; oturum sırasında API 401 verirse `api` o sekme için kapanır ve UI hemen buna göre çizilir (versiyon menüsü kaybolur). Genişleme yönü yoktur — çalışma anında "acaba destekliyor mu" diye yoklama yapılmaz, çünkü yoklama hem gereksiz istek hem de bot koruması riskidir (§16).

Bir yetenek doğrulanamazsa o sağlayıcıda **kapatılır**, taklit edilmez: versiyon menüsü yoksa buton bölünmez (§8.1), ek desteği yoksa hiç söz edilmez. Kullanıcı her sağlayıcıda ne alacağını görür; eksik yetenek sessiz hata olarak görünmez.

### 3.4.6 Yalıtım

Bir adaptörün fırlattığı hata **yalnızca o sekmeyi** etkiler: adaptör kendini kapatır, teşhis kaydına yazar, diğer sağlayıcılar çalışmaya devam eder. Çekirdek bir adaptörün döndürdüğü `Item[]`'ı doğrular (zorunlu alanlar, tip); doğrulama başarısızsa o adaptör devre dışı kalır — bozuk adaptör bozuk dosyaya dönüşemez.

## 4. Veri kaynağı — üç kademe (Claude adaptörü)

Aşağıdaki kademe yapısı **genel kalıptır**; somut alanlar Claude adaptörüne aittir. Diğer adaptörler aynı üç kademeyi kendi kaynaklarıyla doldurur, Kademe 3 hepsinde zorunludur (§3.4.4).

| # | Kaynak | Ne verir | Ne zaman |
|---|---|---|---|
| 1 | **Structured `tool_use`** — konuşma JSON'unda `chat_messages[].content[]` içinde `name === "artifacts"` olan bloklar; `input` = `{command, id, type, title, language, content, old_str, new_str}` | Tam op-log, regex yok | Öncelikli |
| 2 | **Ham metin `<antArtifact>`** — mesaj metnindeki inline bloklar, regex ile | Tam op-log | Kademe 1 boş dönerse (eski konuşmalar / format değişimi) |
| 3 | **DOM** — panelin Code sekmesindeki `<code>` metni | Sadece görüntülenen versiyon | API 401 / şema tanınmazsa |

**Kademe 2 kendi içeriğine karşı savunmasız.** Bir artifact'ın gövdesi `</antArtifact>` metnini içerebilir — artifact yazmayı anlatan bir doküman, bu spec'in kendisi, ya da o etiketi örnek olarak gösteren bir HTML. Regex ilk kapanış etiketinde durur ve kullanıcıya **sessizce kesilmiş dosya** verir. Uzunluk makul göründüğü için fark edilmesi de zordur.

Kural: Kademe 2'de, çıkarılan gövde içinde başka bir açılış/kapanış işareti kalıntısı varsa versiyon `ok:false`, `reason:"tier2_ambiguous"` işaretlenir. Kademe 1 (yapısal JSON) bu soruna tanım gereği bağışık — sınırlar veriden değil şemadan gelir. Kademe sıralamasının ikinci gerekçesi budur.

Kademe 3'e düşüldüğünde menüde tek satır `v? (sayfadan okundu)` görünür ve sarı toast çıkar — kullanıcı versiyon geçmişinin neden yok olduğunu bilir.

**Kademe 3'ün asıl tehlikesi eksik değil, sanki tammış gibi görünen içeriktir.** Uzun kod görünümleri **sanallaştırılmış** olabilir: DOM'da yalnızca ekranda olan satırlar durur, `textContent` geri kalanını hiç görmez. Sonuç 400 satırlık bir dosyanın 60 satırı — ve dosya açıldığında makul görünür, çünkü baştan başlar ve sözdizimi bozulmaz. Sessiz kesilmenin en kötü biçimi.

Kural — okuma **tamlık kanıtı olmadan kabul edilmez**. Sanallaştırmayı *tespit etmeye* çalışmıyoruz: satır yüksekliğinden satır sayısı tahmin etmek kırılgan bir heuristik ve yanlış tarafa düştüğünde sessizce kesik dosya üretir. Bunun yerine **koşulsuz toplama**:

1. Kod düğümü kaydırılabilir değilse (`scrollHeight <= clientHeight`) içerik zaten tamdır, tek okuma yeter
2. Kaydırılabiliyorsa içerik **her zaman** kaydırılarak toplanır: `scrollTop` bir ekran yüksekliği eksi bir satır kadar adımlanır, her adımda görünen satırlar konumlarıyla (`offsetTop` veya satır düğümünün kimliği) biriktirilir, örtüşen satırlar tekrar eklenmez. Sanallaştırma yoksa sonuç tek okumayla aynıdır — yani yanlış tarafa düşme riski yok, yalnızca birkaç milisaniye fazla
3. Toplama sonunda kaydırma konumu **eski hâline döndürülür** (§12'deki sekme geri yükleme ilkesiyle aynı)
4. Toplanan satır sayısı iki ardışık geçişte artmayı sürdürüyorsa (sonsuz kaydırma / tembel yükleme) 3 sn'lik bir sınırda durulur ve öğe `⚠ eksik olabilir` işaretlenip dosya adına `-partial` eklenir

Heuristiği kaldırmanın bedeli birkaç milisaniye; kazancı, tespit yanlış çalıştığında ortaya çıkan **sessiz kesik dosya** sınıfının tamamen yok olması.

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
1. `document.cookie` içindeki `lastActiveOrg` — **`HttpOnly` olmadığı varsayımı adım 1'de doğrulanır.** `HttpOnly` ise content script onu asla göremez ve bu basamak sessizce hiçbir şey döndürür; kod bunu "cookie yok" ile aynı şekilde ele alır ve 2. basamağa düşer, yani yanlış varsayım işlevi bozmaz — sadece her oturumda gereksiz bir org taraması yapılır. Teşhis bloğundaki `Org çözümü:` satırı hangi basamağın kazandığını söyler
2. Yoksa `GET /api/organizations` → dönen org'lar **sırayla** denenir, ilk `200` kazanır
3. Çözülen org, konuşma UUID'siyle birlikte cache'lenir; her tıklamada arama tekrarlanmaz

`convUuid` → `location.pathname`'den. Pathname bir konuşma UUID'si vermiyorsa (`/project/<id>` liste sayfası, `/new`, henüz kaydedilmemiş sohbet) extension **hiçbir şey yapmaz**: buton enjekte edilmez, badge yazılmaz, hata gösterilmez. Proje içi sohbetlerin gerçekten `/chat/<uuid>` yoluna mı düştüğü implementation'ın ilk adımında doğrulanır; düşüyorsa `/project/*` eşleşmesi manifest'ten çıkarılır (kullanılmayan host eşleşmesi, incelemede gereksiz yüzey demektir).

## 4.2 Yüzeyler — extension tek tüketici, çekirdek taşınabilir

Bu ürünün asıl varlığı extension değil: op-log fold'u, adlandırma zinciri, uzantı eşlemesi, `sanitize`, zip yazıcısı ve `Item` modeli. Bunların hiçbiri DOM'a ya da Chrome API'sine bağlı değil — zaten `node selftest.js` ile çalışıyorlar (§14). Extension, bu çekirdeğin **bir** tüketicisi.

**Karar: çekirdek bugün taşınabilir tutulur, başka yüzey bugün yazılmaz.** Maliyeti sıfıra yakın (zaten öyle), kazancı gelecekteki her yüzeyin yeniden yazım değil, yeni bir tüketici olması. Bunu niyet olarak bırakmıyoruz — CI kapısına bağlıyoruz (§19.3 kapı 15): `parse.js`, `zip.js`, `registry.js` içinde `chrome.`, `document.`, `window.` geçemez.

Değerlendirilen yüzeyler ve gerekçeleri:

| Yüzey | Durum | Neden |
|---|---|---|
| **Tarayıcı extension'ı** | v1 | Kullanıcının **oturumuna** bedelsiz erişebilen tek yüzey. Diğer hiçbiri giriş yapılmış bir sohbeti kimlik bilgisi istemeden okuyamaz — bu, seçim değil fiziksel kısıt |
| **Klasöre kaydetme** (§8.7.2) | v1 | *Zaten* editör entegrasyonudur. Klasör projenin klasörüyse dosya doğrudan çalışma alanına iner. En ucuz entegrasyon, ekstra yüzey gerektirmiyor |
| **VS Code köprüsü** | v2 adayı | En değerli ikinci yüzey: `↓` → dosya açık çalışma alanına, doğru klasöre. İndirilenler klasörü turunu tamamen kaldırır. **Bedeli gerçek**: makinede bir loopback dinleyici; eşleştirme token'ı, yalnızca `127.0.0.1`, origin kontrolü ve kullanıcının açıkça başlatması şart. Güvenlik tasarımı yapılmadan yazılmaz |
| **MCP sunucusu** | v3 adayı | Anlamlı tek biçimi: extension'ın kaydettiği **yerel kütüphaneyi** indeksleyip ajana açmak ("geçen ay şu dashboard'u yazmıştım, getir"). Sohbeti kendi okumaya kalkarsa aynı kimlik problemine düşer. Klasöre kaydetme yaygınlaşmadan anlamsız |
| **CLI** | Hayır | Oturum erişimi yok; çerez dışa aktarımı istemek hem kırılgan hem kullanıcıdan istenmemesi gereken bir şey |
| **Web uygulaması** | Hayır | Aynı sebep, daha kötüsü: veriyi bir sunucuya taşımayı gerektirir ve §17.2'yi kökten bozar |

**Sıralamanın mantığı:** her yüzey bir öncekinin ürettiği şeyin üstüne biniyor. Extension dosyayı üretir → klasör onu projeye koyar → köprü doğru yere koyar → MCP birikeni aranabilir yapar. Tersten başlamak (önce MCP) elde hiç veri yokken bir arama arayüzü yazmak olurdu.

## 4.3 Oturumlar arası hafıza — indirme kütüphanesi

Bugün "bu oturumda indirildi" işareti (§8.6) oturum bitince kayboluyor. Oysa asıl soru ertesi gün soruluyor: *bunu zaten almış mıydım, ve aldığımdan beri değişti mi?*

**Tasarım: yerel bir indirme dizini (index), içerik değil.** Her indirmede bir satır — sağlayıcı, sohbet başlığı, öğe adı, `kind`, sürüm etiketi, tarih, içeriğin **SHA-256**'sı ve (klasöre kaydedildiyse) yol. İçerik saklanmaz; hash aynı şeyi çok daha ucuza yapar.

Kazandırdıkları:
- **`✓ indirildi` kalıcı olur** ve sürüm farkını bilir: aynı ad + aynı hash → `zaten aldın`; aynı ad + farklı hash → `v3'ü aldın, bu v5` (kullanıcının en sık kaçırdığı durum)
- **Yinelenen indirmeyi engeller** — klasöre kaydetmede `-2` üretmek yerine "bu dosya zaten burada, aynısı" diyebilir
- **Sohbetler arası tanıma:** hash aynıysa öğe başka bir sohbette indirilmiş olsa bile tanınır — `bunu 3 gün önce başka bir sohbetten almıştın`. Aynı artifact'ı iki konuşmada üretmek yaygın; aynı dosyayı iki kez indirmek gereksiz
- **Geçmişte arama:** popup'ta `Geçmiş` sekmesi, ad/sağlayıcı/tarihe göre. "Şu dashboard'u geçen ay indirmiştim" sorusunun cevabı
- İleride **MCP yüzeyinin** (§4.2) indeksleyeceği şey tam olarak budur — o yüzden bu adım MCP'den önce gelir

**Gizlilik sonucu açıkça yazılır ve varsayılan kapalıdır.** Sohbet başlığı ve öğe adı **konuşma içeriğidir**; onları kalıcı saklamak, §17.2'deki "içerik yalnızca bellekte" taahhüdünün kapsamını değiştirir. Bu yüzden:
- Özellik **opt-in**; ilk açılışta ne saklandığı tek ekranda gösterilir
- Depolama `storage.local` (senkronize **edilmez** — geçmişin cihazlar arası dolaşması istenmeyen bir sürprizdir)
- `Geçmişi temizle` ayarlarda, tek tık, onaysız çalışmaz
- §17.2'nin 3. maddesi bu özelliği ayrıca sayar; kapalıyken hiçbir şey yazılmaz
- Kayıt satırı sayısı üst sınırlı (varsayılan 5000, ayarlanabilir); aşınca en eskiler düşer

## 4.4 Çoklu-model sidebar — neden bu ürün değil

Aynı promptu birden çok modele gönderen bir kenar çubuğu istenebilir. Bunu **yapmıyoruz**, üç somut sebeple:

1. **Kimlik bilgisi problemi.** Ya kullanıcıdan API anahtarı istenir (bu ürünün tamamen dışında bir güven ilişkisi, ve anahtar saklamak §17.2'yi bozar) ya da her sağlayıcının yazma kutusu otomatik doldurulup gönderilir — ki bunu §3.3.3'te bilerek reddettik: sağlayıcı başına yeni seçici yüzeyi, ve kullanıcı adına başka bir şirkete veri gönderen bir eylem.
2. **Yan yana gösterim teknik olarak kapalı.** Sağlayıcılar `X-Frame-Options`/CSP ile çerçevelenmeyi engelliyor; bir sidebar'da gerçek arayüzlerini göstermek mümkün değil.
3. **Tek amaç beyanı çöker** (§19.6). "İndirici" ile "çok modelli istemci" aynı listeleme altında savunulamaz; inceleme bunu kapsam patlaması olarak görür ve haklıdır.

**Buna karşılık zaten sunduğumuz komşu yetenek:** konuşmayı taşıma (§3.3.3) N hedefe uygulanabilir — aynı bağlamı üç sağlayıcıda ayrı sekmede başlatmak tek tıkla mümkün, gönderme kararı kullanıcıda kalır. Ve çıktılarını indirip yan yana karşılaştırmak bu ürünün zaten yaptığı şey. İhtiyacın gerçek çekirdeği (aynı soruyu birden çok modele sormak) karşılanıyor; karşılanmayan kısım otomasyon, ve o kısım bilinçli olarak kullanıcıda bırakılıyor.

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
      common-dom.js # sağlayıcıdan bağımsız pre>code çıkarımı (§3.4.4)
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
    // TABAN: kayıttaki tüm sağlayıcılar tek blok — hepsi aynı dosyaları yükler,
    // ayrı blok yalıtım kazandırmaz (§3.4.6 yalnızca adaptör dosyaları için geçerli)
    "matches": ["https://gemini.google.com/app/*", "https://www.perplexity.ai/search/*",
                "https://chat.deepseek.com/*", "https://chat.mistral.ai/*", "…"],
    "js": ["src/parse.js", "src/zip.js", "src/registry.js",
           "src/adapters/common-dom.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }, {
    // ADAPTÖRLÜ: her biri kendi bloğunda — bir adaptör dosyasındaki hata
    // yalnızca kendi sağlayıcısını düşürsün (§3.4.6)
    "matches": ["https://claude.ai/chat/*", "https://claude.ai/project/*"],
    "js": ["src/parse.js", "src/zip.js", "src/registry.js",
           "src/adapters/common-dom.js", "src/adapters/claude.js", "src/content.js"],
    "css": ["src/overlay.css"], "run_at": "document_idle"
  }],   // chatgpt için aynı kalıpta bir blok daha
  "action": { "default_popup": "src/panel.html" },
  "options_ui": { "page": "src/panel.html", "open_in_tab": true },
  "commands": { "download-current": {
    "suggested_key": { "default": "Alt+Shift+D", "mac": "Alt+Shift+D" },
    "description": "__MSG_cmdDownload__" } }
}
```

**Her sağlayıcı kendi `content_scripts` bloğunu alır ve yalnızca kendi adaptörünü yükler.** Hepsini tek blokta yüklemek, §3.4.5'teki yalıtım iddiasını çürütürdü: `gemini.js`'teki bir sözdizimi hatası o dosyayı değil, **paketin tamamının o sekmedeki yüklemesini** düşürür ve Claude'da da extension ölür. Ayrı bloklar bunu imkânsız kılar; bedeli birkaç satır manifest tekrarı.

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

**Testlerimiz kendi matematiğimizi doğruluyor, arşivin açılabilirliğini değil.** CRC32'nin doğru, offset'in tutarlı olması bir zip'in gerçek araçlarda açılacağını **garanti etmez**: `version needed to extract`, dış öznitelik alanı, veri tanımlayıcısının varlığı gibi ayrıntılarda araçlar birbirinden ayrılır ve bozuk bir arşiv çoğu zaman *bir* araçta açılıp diğerinde açılmaz. Bu, tam da avlamaya çalıştığımız sınıf: dosya iner, kullanıcı çift tıklar, açılmaz.

Kural: yazıcı en muhafazakâr biçimi üretir — `version needed = 20`, sıkıştırma yöntemi 0, **veri tanımlayıcısı yok** (boyutlar zaten önceden biliniyor, akış yazmıyoruz), dizin girdisi yok (düz dosya listesi, klasörler yalnızca ad içindeki `/` ile ifade edilir). Ve manuel doğrulama listesine **birlikte çalışabilirlik testi** girer: üretilen zip Windows Gezgini, macOS Arşiv Yardımcısı, `unzip` ve 7-Zip ile açılır. Dördü de Türkçe adlı ve emoji içerikli girdi taşıyan arşivde denenir — ad kodlaması tam olarak bu araçlarda ayrışır.

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
   3. Adım 1'de bu **adaptörlü her sağlayıcıda kasten zorlanır** (taban sağlayıcılarda enjeksiyon yok, §8.1.1): buton enjekte edilir, sonra versiyon değiştirme, panel yeniden boyutlandırma, yeni mesaj gönderme, sekme değiştirme ile arka arkaya render tetiklenir ve konsol React hatası için izlenir
   4. Hata görülürse plan B: buton action bar'a **hiç** girmez; `document.body`'ye bağlı, `getBoundingClientRect` ile action bar'ın üstüne hizalanan bir katman olarak çizilir. React DOM'una sıfır müdahale. Bedeli: yeniden boyutlandırma/kaydırmada konum senkronu — görsel olarak biraz daha kırılgan, ama sayfayı asla düşürmez. Kod blokları için bu yol zaten varsayılan (§8.1.1)

   Menü, pill ve toast zaten shadow root içinde ve `body`'ye bağlı (§8.7); risk yalnızca butona ait.

   **Framework enjekte edilen düğümü siler.** Action bar yeniden render edildiğinde butonumuz DOM'dan uçar. Bu, SPA'lara enjeksiyon yapan extension'ların bir numaralı kırılma sebebi. Karşı önlem: observer yalnızca "panel açıldı" olayını değil, **butonun hâlâ bağlı olup olmadığını** da kontrol eder (`document.contains(btn)`), yoksa yeniden enjekte eder. Enjeksiyon fonksiyonu ucuz ve idempotent olacak şekilde yazılır; observer callback'i `requestAnimationFrame` ile debounce edilir ki render fırtınasında CPU yakmasın.
3. Buton tıklanınca `getConversation(convUuid)` — bellek içi cache; DOM mesaj sayısı değiştiğinde veya 60 sn geçince geçersiz. Her mutation'da fetch **yok**.

   **Mesaj sayısı akış sırasında değişmez.** Claude yazarken op'lar **aynı** mesajın içine eklenir; mesaj sayısı sabit kalır. Sadece sayıya bakan bir geçersizleştirme, akış ortasında alınmış bir yanıtı 60 saniye boyunca taze sayar ve kullanıcı Claude bitirdikten hemen sonra indirdiğinde **yarım artifact** alır — üstelik §3.2'deki "yazılıyor" uyarısı da o eski anlık görüntüye göre hesaplanır, yani uyarı bile çıkmaz. Kural: akış sürerken alınan yanıt **cache'lenmez**, yalnızca o anlık kullanım için tutulur; akışın bittiği tespit edildiğinde cache koşulsuz geçersizleşir.
4. `parseOps` → `buildVersions` → versiyon listesi.
5. **Açık artifact eşleştirme:** panel başlığı → aday artifact'lar. Aynı başlıktan birden fazla varsa ayırt etmek gerekir.

   **İlk 200 karakter en kötü ayırt edicidir.** Kod dosyalarının başı en az özgün yeridir: iki React artifact'ı da `import { useState } from "react";` ile başlar, iki Python dosyası da aynı import bloğunu taşır. Bu ölçüt tam da ayırt etmesi gereken durumda başarısız olur.

   Doğru sıra:
   1. Görünen metnin **uzunluğu** her adayın son sürümünün uzunluğuyla karşılaştırılır; tam eşleşme tek adaya düşüyorsa kazanan odur (uzunluk ucuz ve kod dosyalarında yüksek ayırt edici)
   2. Birden fazla aday aynı uzunluktaysa görünen metnin **tamamının** hash'i karşılaştırılır
   3. Görünen metin kesik olabilir (§4 sanallaştırma) — o durumda uzunluk karşılaştırması geçersizdir ve **ortadan bir örnek** (metnin %40-60 aralığındaki 200 karakter) kullanılır; baş taraf değil
   4. Hiçbiri ayırt etmiyorsa menüde **her iki aday da** gösterilir, başlığın yanında ilk farklı satırıyla — belirsizlik sessizce çözülmez
6. **Görüntülenen versiyon:** panelin kendi versiyon göstergesinden okunur; okunamazsa son versiyon varsayılır.
7. Seçim → `Blob` + `<a download>` → başarı toast'ı.

### 7.1 Eşzamanlılık

Boru hattı async ve kullanıcı beklemek zorunda değil. Üç yarış durumu:

**Uçuştaki istek başka konuşmaya ait olabilir.** Kullanıcı ↓'ye basar, fetch sürerken başka bir sohbete geçer. Yanıt döndüğünde artık başka bir konuşmadayız — cevabı uygulamak **yanlış artifact'ı indirmek** demektir. Kural: her istek bir `requestId` + `convUuid` ile damgalanır; yanıt işlenmeden önce `location`'daki konuşma hâlâ aynı mı diye bakılır, değilse sessizce atılır. Rota değişiminde uçuştaki istekler `AbortController` ile iptal edilir.

**Çift tıklama = çift indirme.** Aynı artifact için uçuşta istek varken ikinci tık yeni fetch açmaz; buton `aria-busy` alır ve mevcut isteğe bağlanır.

**Otomatik indirme akış sırasında tetiklenir.** Claude artifact'ı yazarken her op yeni bir "versiyon" gibi görünür; `autoDownload` açıksa tek artifact için onlarca dosya iner. Kural: otomatik indirme **akış bitene kadar beklemek zorunda** (§3.2'deki yazılıyor tespiti), sonra bir kez tetiklenir. Aynı artifact + aynı versiyon için oturumda tekrar inmez.

### 7.2 Yaşam döngüsü

**Menü sahipsiz kalabilir.** React action bar'ı yeniden çizerse buton uçar ama açık menü havada kalır. Kural: yeniden enjeksiyondan önce menü kapatılır. Menü ayrıca şu durumlarda kapanır: dışarı tık, `Esc`, panel kapanması, rota değişimi, panelin kaydırılması.

**Extension güncellenince content script öksüz kalır.** Extension yeniden yüklendiğinde/güncellendiğinde sayfadaki eski content script yaşamaya devam eder ama `chrome.runtime.sendMessage` artık `Extension context invalidated` fırlatır — MV3'te en sık görülen konsol çöplüğü ve kırık buton sebebi. Kural: her `chrome.*` çağrısı sarmalanır; bu hata görülünce content script **kendini kapatır**: observer durur, enjekte edilen UI kaldırılır, bir daha denenmez.

Ama sessizce kaybolmak da yanlış: kullanıcı butonu arar, bulamaz, sebebini bilemez. Kapanmadan önce **tek seferlik** bir toast gösterilir: `Extension güncellendi — sayfayı yenile`. Metin `chrome.i18n` ölmüş olabileceği için **önceden belleğe alınmış** iki dilli sabitten okunur (bu, i18n kuralının bilinçli ve tek istisnası; gerekçesi burada yazılı). Kullanıcı sayfayı yenileyince temiz kurulum gelir.

## 8. UI kararları

### 8.1 İndirme kontrolü — split buton
`↓` yarısı varsayılan versiyonu **tek tıkla** indirir; `▾` yarısı versiyon menüsünü açar. Gerekçe: indirmelerin çoğu "şu an baktığım versiyon"; menü-önce tasarım her kullanıcıya, her seferinde, azınlığın vergisini ödetir.

**Tek versiyon varsa `▾` yarısı çizilmez** — tek satırlık menü gürültüdür. Kontrol ancak seçenek varsa var olur.

**`defaultVersion: "ask"` seçiliyken buton bölünmez.** "Sor" demek "varsayılan yok" demektir; `↓` yarısının indireceği bir şey kalmaz. O ayarda buton tek parçadır ve tıklama doğrudan menüyü açar. İki yarısı da aynı şeyi yapan bir split buton, kullanıcıya olmayan bir seçim sunar.

### 8.1.1 Kod bloğu kontrolü — tek gezici düğme, N enjeksiyon değil

Bir mesajda onlarca kod bloğu olabilir. Her birine ayrı buton enjekte etmek üç bedeli birden getirir: React/Angular reconciliation çökme riskinin **blok sayısı kadar katlanması** (§7 adım 2), akış sırasında sürekli yeniden enjeksiyon, ve arayüzün kontrol çöplüğüne dönmesi.

**Düğme üreteceği dosya adını gösterir.** Ad, dört basamaklı bir zincirden türetiliyor (§3.3.1) ve kullanıcının o zincirin sonucunu **tıklamadan önce** görmesi gerekir — aksi hâlde `kod-7.txt` inen dosyayı indirilenler klasöründe bulmaya çalışır. Düğme `↓ backfill.py` biçiminde çizilir; ad uzunsa ortadan kısaltılır (`↓ order-serv…py`), tam ad `title` özniteliğinde durur.

Aynı ilke belge butonunda da geçerli: split butonun `↓` yarısına hover edildiğinde ipucu üretilecek adı söyler.

Kural: **tek** bir gezici indirme düğmesi. Kapsayıcıya olay delegasyonuyla bağlanır, farenin/odak noktasının üstünde bulunduğu kod bloğuna `getBoundingClientRect` ile hizalanır, shadow root içinde `body`'ye bağlı durur. Sağlayıcının DOM'una **hiç** düğüm eklenmez — kod blokları için React riski tamamen ortadan kalkar.

**Klavye ve ekran okuyucu yolu ayrıdır — ve olması gereken de bu.** Hover'a bağlı bir kontrol ekran okuyucu kullanıcısı için **yok** hükmündedir. İlk çözüm "kod bloğunu odaklanabilir yap" olurdu, ama bu `tabindex` eklemek demek, yani sağlayıcının DOM'unu değiştirmek — §8.1.1'in "hiç düğüm eklenmez" kuralıyla aynı aileden bir ihlal (öznitelik de yeniden render'da ezilir ve her ezilişte geri yazmak, kaçındığımız enjeksiyon döngüsünün ta kendisi).

Doğru çözüm zaten tasarımda var: **popup'taki öğe listesi erişilebilir yoldur** (§8.6). Kod blokları orada ad, dil ve satır sayısıyla listeleniyor; klavye ve ekran okuyucu kullanıcısı hiç sayfa içi kontrole ihtiyaç duymadan indirebiliyor. Gezici düğme bir **işaretçi kolaylığı**, tek erişim yolu değil.

Bunun sonucu: kod bloğu erişilebilirliği popup'ın erişilebilirliğine bağlıdır, o yüzden popup listesi tam klavye gezinmesi ve `aria` etiketleriyle yayın öncesi kapıya girer (§19.5). Blok zaten odaklanabilirse (sağlayıcı kendi `tabindex`'ini vermişse) düğme ona da hizalanır — bu bir bonus, dayanak değil. `Alt+Shift+D` odaktaki bloğu indirir.

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

**Menü "ne değişti" söylemeden seçim yaptıramaz.** Kullanıcının verdiği karar "hangi versiyonu istiyorum" — ve bu kararın tek gerçek girdisi **ne değiştiği**. Boyut ve zaman damgası bunu söylemez: 8.4 KB ile 8.1 KB arasındaki farkın bir satır mı yoksa bütün bir bölüm mü olduğu görünmez.

Fold zaten her iki içeriği de elinde tutuyor, yani satır bazlı fark **bedava**: her satır için `+n / −n` gösterilir (`v2 · +12 −3`). Tam diff üretmiyoruz, yalnızca sayım.

**Küme farkı değil, çokluk kümesi farkı.** Satırları bir kümeye atıp farkını almak, tekrar eden satırları yok sayar — bir dosyada onlarca `}` , `return`, boş satır bulunur ve küme yaklaşımı bunları tek sayar. Sonuç: 40 satır silinmiş bir düzenleme `−3` görünür ve kullanıcı yanlış sürümü seçer. Doğrusu satır → adet eşlemesi (`Map<satır, sayı>`) üzerinden fark: `+n` = yeni tarafta fazla olan adetlerin toplamı, `−n` = eski tarafta fazla olanların. Hâlâ O(n), hâlâ LCS'siz, 500 satırlık dosyada milisaniye altı — ama doğru.

Sayım her zaman **bir önceki sürüme** göredir; v1 için karşılaştırılacak bir şey yok, `ilk sürüm` yazılır.

Kazanç orantısız: kullanıcı "üç satır düzeltilmiş" ile "yarısı yeniden yazılmış" arasındaki farkı görüp doğru versiyonu ilk denemede seçiyor. Bunu göstermemek, elimizdeki bilgiyi saklamak olurdu.

**Aynı içerikli ardışık versiyonlar işaretlenir.** Bir `update` hiçbir şeyi değiştirmemiş olabilir (aynı `new_str`, ya da sonuç aynı bayta çıkan bir düzenleme). Menüde iki satır aynı boyutu gösterir ve kullanıcı ikisini de indirip fark arar. Fold sırasında ardışık versiyonların baytları karşılaştırılır; aynıysa satır `değişiklik yok` etiketi alır. Satır **silinmez** — Claude o adımı attıysa kullanıcı bunu görmeyi hak eder; sadece boşuna indirme yapmaz.

**Numaralarımız panelin numarasıyla aynı olmak zorunda.** claude.ai artifact panelinde kendi versiyon göstergesi var ("Version 3"). Bizim fold'umuz op sayısına göre numara üretiyor ve bu **aynı sonucu vermeyebilir**: Claude başarısız bir op'u saymıyor olabilir, `create`'i 0'dan başlatıyor olabilir, ya da ardışık iki `update`'i tek versiyon gösteriyor olabilir. Kayma olursa menüden "v2" seçen kullanıcı, panelin v3 dediği şeyi indirir — ve bunu **asla fark etmez**, çünkü iki numara da makul görünür. Yanlış dosya vermenin en sinsi biçimi.

Kural: adım 1'de bizim numaralarımız panelin göstergesiyle karşılaştırılır. Birebir tutuyorsa `v1…vN` kullanılır. Tutmuyorsa **kendi numaramızı panelinkiymiş gibi sunmayız**: menü satırları `v` yerine sıra + zaman damgasıyla etiketlenir (`3. düzenleme · 14 dk önce`) ve görüntülenen olan `✓ görüntülenen` ile işaretlenir. Kullanıcı yanlış bir eşleşmeye ikna edilmez.

**Yetenek yoksa kontrol de yok.** Versiyon desteklemeyen bir sağlayıcıda (Gemini, Perplexity) buton hiç bölünmez; `▾` yarısı çizilmez, menü açılmaz. Boş bir menü veya tek satırlık liste, kullanıcıya olmayan bir yetenek vaat eder. Aynı kural ek desteği ve panel/canvas için de geçerli — kapalı yetenek görünmez, "bu sağlayıcıda desteklenmiyor" yazan gri bir kontrol de değil.

### 8.2.1 Sohbet seviyesi zip

Menüdeki `🗜 Tüm versiyonlar` **bir** artifact'ı kapsar. Sohbetin tamamı için ayrı bir giriş var: popup'ta `🗜 Sohbetteki 9 öğe → zip`.

İçerik: her öğenin **son** versiyonu, `kind` başına klasörde: `artifacts/`, `kod/`, `ekler/`, `arac-ciktilari/`.

**Sıra önemli: `sanitize` önce, klasör öneki sonra.** `sanitize` dosya adındaki `/` karakterini temizliyor (§6) — klasör önekini ada önce eklersek onu da siler ve zip düz bir liste olur. Zip girdisi `kind öneki + "/" + sanitize(ad)` olarak kurulur; ayırıcı `/`'ler sanitize'dan **geçmez**. Aynı kural klasöre kaydetmede yok, çünkü orada alt klasör üretmiyoruz (§8.6). Klasörleme şart, çünkü kod bloğu adları (`kod-3.py`) ile artifact adları aynı düzlemde karışır ve arşivi açan kişi neyin ne olduğunu ayırt edemez. Tüm artifact'ların tüm versiyonları değil — 4 artifact × 5 versiyon = 20 dosyalık bir arşiv kimsenin istediği şey değil; versiyon geçmişi tek artifact düzeyinde anlamlı.

Zip adı sohbet başlığından üretilir: `<sohbet-başlığı>-indirilenler.zip`. Başlık okunamazsa `<sağlayıcı>-indirilenler-<tarih>.zip`.

Sohbetin Markdown'ı (§3.3.3) arşivin **kökünde** `sohbet.md` olarak yer alır — arşivi altı ay sonra açan kişi dosyaların hangi konuşmadan çıktığını bilmeli; bağlamsız bir dosya yığını arşivin yarısını değersizleştirir.

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

**Badge yalnızca belge sınıfını sayar** — kod blokları gibi araç çıktıları da sayılmaz. Bir sohbette 30 araç çağrısı olabilir; rozette `30` görmek "indirilecek bir şey var" sinyalini yine değersizleştirirdi. Aynı gerekçe, aynı kural.

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
2. **Öğe listesi**, `kind` başına gruplu: *Belgeler* (artifact/canvas), *Kod blokları · N*, ***Araç çıktıları · N***, *Ekler · N*, *Sohbet*. Araç çıktısı satırında araç adı ve sonuç büyüklüğü görünür (`search_events · 214 satır`) — hangi çağrının hangisi olduğu ancak böyle ayırt edilir. Her satır: ad, kısa meta (tip/satır/boyut), `↓`. Belge satırlarında ayrıca `▾` (versiyon) ve `🗜`. En altta `🗜 Tümü → zip`.
   Eski tek-kartlı "şu an" tasarımının yerini bu aldı: artık öğe tek değil ve panel açık olmak zorunda değil (§8.8).
3. **Neleri göster** (`kinds`): artifact/canvas · kod blokları · ekler — üç anahtar. Kod bloklarını kapatmak, uzun teknik sohbetlerde listeyi sadeleştirmenin tek yolu.
4. **Bildirim** (`badge`, `notify`): toolbar rozeti (aç/kapa) + "indirilebilir" duyurusu (kapalı / sayfa içi pill / sistem bildirimi) — **tek kontrol**, ayrı bir "pulse" anahtarı yok.
5. **İndirme** (`defaultVersion`, `zipAll`, `autoDownload`, `dragEnabled`): varsayılan versiyon (görüntülenen / son / sor) · menüde zip satırı (aç/kapa) · sürükle-bırak (aç/kapa — bazı kullanıcılar kazara sürüklemeyi sevmez) · otomatik indirme (aç/kapa, **varsayılan kapalı**).
6. **Kayıt yeri** (`saveTo`) — **sağlayıcı başına**: `Kayıt yeri · Claude: ~/Projects/artifacts` / `· ChatGPT: seçilmedi`. Handle origin'e bağlı olduğu için tek bir global seçim mümkün değil (§8.7.2); panel bunu gizlemek yerine adıyla gösterir.
7. **Dosya adı** (`nameTemplate`): şablon input + tıklanabilir token chip'leri + **canlı önizleme**. Önizleme, yer tutucu bir örnek değil **o an listedeki ilk öğenin gerçek adı** üzerinden hesaplanır (`Sales-Dashboard-v3.tsx`); liste boşsa jenerik örneğe düşer. Kullanıcının göreceği şeyle önizlemenin aynı olmaması, önizlemenin varlık sebebini yok eder.
   Şablondaki `/` ve `\` **temizlenir**, alt klasör oluşturmaz. Alt klasör desteği izin, iç içelik ve hata yollarını çoğaltır; karşılığında kazandırdığı şey nadir bir düzen tercihi. Token yardımında bu açıkça yazılır ki kullanıcı denemesin.
8. **Siteler** (`sites`): kayıttaki sağlayıcılar için aç/kapa. Liste uzun olduğundan **arama kutusu** ve `Tümünü kapat / aç` bulunur; varsayılan hepsi açık. Kullanıcının eklediği hostlar (`extraHosts`, §3.4.2) ayrı bir grupta, her biri **kaldır** düğmesiyle — verdiği izni geri almanın yolu extension ayarlarında aranmamalı. Kullanmadığın sağlayıcıda extension hiç çalışmasın diyebilmek, izin listesini daraltmasa da davranışı daraltır.
9. **Adı indirmeden önce düzeltebilme.** Satırdaki ada tıklamak onu yerinde düzenlenebilir yapar; `Enter` onaylar, `Esc` iptal eder. Uzantı ayrı ve düzenlenmez (yanlış uzantı sessiz bir hata kaynağı).

   Gerekçe: ad dört basamaklı bir **sezgisel** zincirden geliyor (§3.3.1) ve sezgisel her zaman yanılabilir — `kod-7.py`, `use-cart.ts` yerine `index.ts`. Düzeltmenin tek yolu indirip dosyayı yeniden adlandırmak olurdu. Türetme ne kadar iyi olursa olsun, kullanıcıya son sözü vermeyen bir ad üreticisi eksiktir. Düzeltilen ad o oturum boyunca o öğe için hatırlanır.

10. **İçeriği panoya kopyala.** Her satırda `↓` yanında bir kopyala eylemi. Uzun basış / ikincil menü **`Bağlam olarak kopyala`** verir: ad + dil + fenced içerik, yeni bir sohbete yapıştırılmaya hazır (§2.1.1). Sürümlü bir öğede kopyalanan sürüm, indirmeyle **aynı kurala** uyar (`defaultVersion`, §11.2) — iki eylemin farklı sürüm seçmesi kullanıcının en zor fark edeceği tutarsızlık olurdu. Aynı içerik, iki farklı biçim — hangisini istediği kullanıcının işine bağlı. Çoğu zaman insanın gerçek ihtiyacı dosya değil, içeriğin kendisidir — ve indirip açıp kopyalamak üç adımdır. Sağlayıcının kendi kopyala düğmesi yalnızca kod bloklarında ve yalnızca güncel sürümde var; bizimki **eski bir sürümü** de, **belgeyi** de, **sohbetin Markdown'ını** da kopyalayabiliyor. Aynı içerik boru hattı, yeni bir hedef.

11. **Bağlam devri önerisi.** Mesaj sayısı `handoffAt`'i aşınca listenin üstünde tek satırlık, kapatılabilir bir öneri: `Bu sohbet uzadı — bağlamı yeni bir sohbete taşı`. Toast değil, satır: davetsiz ama kesintisiz. Oturumda bir kez.

12. **Uzun sohbet davranışı.** Öğe sayısı 10'u aşınca listenin üstünde bir **filtre** kutusu belirir (ad ve dile göre, anlık). 40 kod bloklu bir sohbette filtresiz liste kullanılamaz; 3 öğelik sohbette filtre gürültüdür — bu yüzden koşullu.
13. **Çoklu seçim.** Her satırda, üzerine gelince beliren bir onay kutusu; en az biri seçiliyken alt bar `Seçilenleri indir (4) → zip` olur. "Tümü → zip" seçim yokken görünür. 40 blokluk bir sohbette "hepsi ya da bir tane" ikilemi gerçek bir kısıt.
14. **İndirilenler işaretlidir** (`history`). Geçmiş kapalıyken işaret **oturum içi**; açıkken kalıcı ve sürüm farkını bilir: aynı hash → `zaten aldın`, farklı hash → `v3'ü aldın, bu v5` (§4.3). Aynı dosyayı ikinci kez indirmek zararsız ama kafa karıştırıcı; farklı bir sürümü aynı sanmak ise gerçek bir hata.

    Geçmiş açıkken popup'a **`Geçmiş`** sekmesi eklenir: ad/sağlayıcı/tarihe göre arama, satırdan yeniden indirme, `Geçmişi temizle`. Kapalıyken sekme hiç görünmez — kapalı bir özelliğin boş kabuğunu göstermek §3.4.5'teki "yetenek yoksa kontrol de yok" kuralının ihlali olurdu. Geçmiş açıkken ayarlarda kayıt sayısı ve **üst sınır** (`historyMax`) görünür, sınır düzenlenebilir; sessizce düşen kayıtların sebebi görünmeden kalmaz.
15. **Araç çıktısında çağrı bilgisi** (`includeCall`): aç/kapa. Kapatan kullanıcı ham sonucu alır; açık olan altı ay sonra dosyanın ne olduğunu bilir.

16. **Ekler boyutunu indirmeden gösterir.** Ek içeriği ayrı istekle geliyor (§3.3.2); boyut meta veriden okunabiliyorsa satırda görünür, okunamıyorsa `boyut bilinmiyor` yazar — tahmin edilmez.
17. **İlerleme, iş uzunsa.** Sohbet zip'i 40 öğe ve ekler içerebilir; 300 ms'yi aşan işlemlerde alt barda belirleyici bir ilerleme çubuğu (`12/40`) çıkar. Kısa işlerde çıkmaz — 80 ms'lik bir çubuk titremeden başka bir şey değildir. İşlem **iptal edilebilir**; iptalde yarım zip üretilmez.
18. **Alt satır:** `🔒 Veri cihazdan çıkmıyor · dış istek yok` · `⏻ Bu sitede kapat` · `Teşhis bilgisini kopyala` · `Alt ⇧ D` (kısayol değiştirilmişse gerçek atanmış tuş `chrome.commands.getAll()` ile okunup gösterilir — yanlış tuş göstermek kullanıcıyı boşuna uğraştırır).

Gerekçeler: popup'ı açan çoğu insan ayar değil indirme için gelir → eylem üstte, ayarlar altta. Token'lı input'un klasik hatası kullanıcının çıktıyı tahmin edememesidir → canlı önizleme. Geri alınamayan davranış (otomatik indirme) varsayılan olmaz. Gizlilik cümlesi görünür, çünkü bu extension özel sohbetleri okuyor.

### 8.6.1 Popup etkileşim modeli

Popup, kod bloklarının **tek erişilebilir yolu** (§8.1.1). O iddia ancak popup'ın klavye ve ekran okuyucu modeli tanımlıysa geçerli — aksi hâlde erişilebilirliği bir yerden alıp başka bir yere taşımış, çözmemiş oluruz.

**Klavye.** Açılışta odak: liste 10'dan uzunsa filtre kutusu, kısaysa ilk öğe satırı. `↑`/`↓` satırlar arasında gezer (filtredeyken de çalışır, odak kutuyu terk etmez). `Enter` indirir, `Space` seçim kutusunu değiştirir, `Shift+↑/↓` aralık seçer. `E` odaktaki satırın adını düzenlemeye açar, `C` içeriğini kopyalar, `V` sürüm menüsünü açar. `Esc` sırayla: düzenlemeyi iptal → filtreyi temizle → popup'ı kapat. `Tab` gruplar arası değil **bölümler** arası gezer (filtre → liste → toplu bar → alt satır); listenin 47 elemanı `Tab` sırasına girmez, bu klavye kullanıcısını cezalandırırdı.

**Semantik.** Liste `role="listbox"`, satırlar `role="option"` + `aria-selected`. Her satırın erişilebilir adı: `<ad>, <tür>, <meta>` (`backfill.py, kod bloğu, 14 satır`) — görsel ikonların taşıdığı bilgi metne de girer. Filtre sonucu `aria-live="polite"` bir bölgede duyurulur (`3 eşleşme`); her tuş vuruşunda değil, 300 ms sonra bir kez. İlerleme çubuğu `role="progressbar"` + `aria-valuenow`.

**Boyut.** Chrome popup'ı en fazla 800×600. Liste bölümüne `max-height` verilir ve **kendi içinde** kaydırılır; başlık, sağlayıcı şeridi, toplu bar ve alt satır sabit kalır. Aksi hâlde 47 öğelik listede toplu bar ekranın dışına çıkar ve seçim yapılıp indirilemez — sessiz bir çıkmaz.

**Tema ve yön.** Popup bizim sayfamız: `prefers-color-scheme` ile açık/koyu, `dir` arayüz diline göre. Sayfadan renk okuma (§12) yalnızca enjekte edilen UI için geçerli; burada geçerli değil.

**Ekran okuyucu doğrulaması yayın öncesi kapıda** (§19.5): bir kod bloğu, popup üzerinden **yalnızca klavye ve ekran okuyucu ile** indirilebiliyor mu. Bu tek test, §8.1.1'deki iddianın kanıtı.

### 8.7 Stil izolasyonu, erişilebilirlik, dosya yazımı

**Shadow DOM tam yalıtım değildir.** Shadow root, sayfanın seçicilerinden korur ama **miras alınan** özellikler host üzerinden içeri sızar: `font-size`, `line-height`, `color`, `direction`, `visibility`, `text-transform`. Bir sağlayıcının kök stilinde bunlardan biri sıra dışıysa kutularımız onu devralır. Kural: shadow host'a `all: initial` verilir ve ihtiyaç duyulan her özellik shadow içinde **yeniden** tanımlanır; `direction` ise bilerek devralınır, çünkü RTL'de sayfayla aynı yönde olmalıyız (§8.7).

**Shadow DOM.** Pill, toast ve versiyon menüsü bize ait tek bir `<div>`'e bağlı **shadow root** içinde çizilir. Sağlayıcının global CSS'i (Tailwind/Angular Material reset dahil) bizim kutularımızı yiyemez, bizim CSS'imiz de sayfayı kirletemez. İstisna: split buton, native görünmesi için sağlayıcının action bar'ının **içinde** durmak zorunda — shadow DOM'a alınamaz. Onun için `adl-` önekli sınıf adları ve gerekli her özelliğin açıkça yazılması (miras alınan değerlere güvenilmez).

**Erişilebilirlik.** Buton `role="button"` + `aria-label` (i18n) + `title`. Menü `role="menu"`, satırlar `role="menuitem"`; ok tuşlarıyla gezinilir, `Enter` seçer, `Esc` kapatır ve odağı butona geri verir. Odak halkası görünür bırakılır. Toast'lar `role="status"` (hata: `role="alert"`).

**Hareket.** `@media (prefers-reduced-motion: reduce)` altında nabız ve pill animasyonu iptal; pill yine görünür, sadece nabız atmaz. Badge nabzı da bu durumda tek karede sabitlenir.

**Yazım yönü.** Sağlayıcılar Arapça/İbranice arayüzde `dir="rtl"` çalışır; `right: 10px` ile sabitlenen pill ve menü yanlış tarafa düşer, hatta panel kenarından taşar. Konumlandırmada fiziksel değil **mantıksal** özellikler kullanılır (`inset-inline-end`, `padding-inline`, `margin-inline-start`). Maliyeti sıfır, sonradan düzeltmesi her kuralı tek tek gözden geçirmek demek.

**Dosya yazımı.** İçerik **birebir**, UTF-8, BOM yok, satır sonu dönüştürmesi yok, sona satır sonu eklenmez — kullanıcı modelin ürettiği baytı alır. `Blob` MIME'ı gerçek tipe göre verilir (`text/html`, `image/svg+xml`, kod için `text/plain;charset=utf-8`). Oluşturulan object URL indirme tetiklendikten sonra `URL.revokeObjectURL` ile serbest bırakılır.

**`tabs` izni neden yok.** Kısayol ve popup, hedef sekmeye `chrome.tabs.sendMessage(tabId, …)` ile ulaşır; `tabId`, popup için `chrome.tabs.query({active:true, currentWindow:true})`'den gelir. Bu çağrı `tabs` izni olmadan da sekme kimliğini döndürür — izin yalnızca `url`/`title` gibi alanları okumak için gerekir ve bize gerekmiyor. Content script yoksa `sendMessage` hata döner, sessizce yutulur ve kullanıcıya "bu sayfada indirilecek öğe yok" toast'ı gösterilir.

### 8.7.1 Sürükle-bırak

`↓` butonu `draggable`. Sürüklenince dosya doğrudan VS Code'a, Finder'a, Explorer'a bırakılabilir — indirilenler klasöründen geçmeden.

```js
e.dataTransfer.setData("DownloadURL", `${mime}:${filename}:${blobUrl}`)
```

**Tuzak: `dragstart` senkron.** Bu satırın çalıştığı anda içeriğin **hazır olması** gerekir; orada `await fetch(...)` yapılamaz. Sürükleme ancak versiyonlar zaten yüklenmişse mümkün.

Çözüm **hover ön-yükleme**: kullanıcı butonun üzerine geldiğinde (veya klavyeyle odaklandığında) fetch sessizce başlar. İnsan sürüklemeye başlamadan önce neredeyse her zaman fareyi butonun üstünde bir an tutar; o an bize yetiyor. Hazır değilse buton `draggable` olmaz — yarım dosya sürüklemektense sürüklenememek iyidir.

**Gezici kod düğmesi de sürüklenebilir.** Aynı `DownloadURL` mekanizması, aynı hover ön-yüklemesi — kod bloğunu editöre sürüklemek, belgeyi sürüklemek kadar doğal bir jest ve ayrı bir kod yolu gerektirmiyor.

**Çoklu seçim sürüklenirse zip olur.** `DataTransfer` tek bir `DownloadURL` taşır; birden fazla dosyayı sürüklemenin yolu yok. Seçim varken sürükleme başlatılırsa yük, seçimin zip'idir (§8.2.1'deki aynı üretici). Kullanıcı için tutarlı: seçim + tık = zip indir, seçim + sürükle = zip'i bırak.

**Popup'tan sürüklenemez — ve bu bir tasarım kararı değil, platform sınırı.** Chrome popup'ı odak kaybında kapanır; sürükleme popup'tan çıkar çıkmaz popup kapanır ve sürükleme iptal olur. Denenip başarısız olmasındansa **hiç sunulmaması** doğru: popup satırları `draggable` yapılmaz. `docs/LIMITATIONS.md`'de yazılı.

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

Aynı adlı dosya varsa üzerine yazılmaz; `-2`, `-3` soneki eklenir (en fazla `-99`; ötesinde hata toast'ı — sonsuz döngü yerine görünür başarısızlık). Tarayıcı indirmesinde bunu Chrome yapıyor; klasöre yazarken **biz** yapmak zorundayız, yoksa sessiz veri kaybı olur. Varlık kontrolü `getFileHandle(name)` ile yapılır — `NotFoundError` fırlatması adın **boş** olduğu anlamına gelir; `create:true` ile çağırmak dosyayı oluşturup kontrolü anlamsız kılar, o yüzden kontrol her zaman `create` olmadan yapılır.

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
| Yazma başarısız (klasör) | Satır kırmızı kalır + `Tekrar dene`; öğe listeden **düşmez**, kullanıcı ikinci kez deneyebilir |
| Adaptör doğrulamadan geçemedi | `Bu sitede geçici olarak devre dışı` + `Sayfayı yenile` (yeniden etkinleşmenin tek yolu; sessizce kaybolmaz) |
| Arayüz değişmiş görünüyor | §8.8.1'deki kendi kendini teşhis mesajı + `Sorun bildir` |

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

### 8.8.1 Kendi bozulduğunu fark etmek

Sahadaki en olası arıza, sağlayıcının arayüzünü değiştirmesi ve butonun kaybolmasıdır. Bu arızanın **hiçbir hata mesajı yoktur** — kullanıcı için extension bir gün çalışır, ertesi gün yoktur, ve büyük ihtimalle "ben mi kapattım" diye düşünür. Bizim de haberimiz olmaz (telemetri yok), yani arıza kullanıcı şikâyet edene kadar sürer.

Oysa tespit ucuz: **konuşma sayfasında olduğumuzu biliyoruz ama hiçbir `SEL` tutmuyorsa**, arayüz değişmiş demektir. Bu iki koşul birlikte anlamlı — tek başına "selector tutmadı" boş sohbette de olur.

Kural: sayfa yüklendikten sonra konuşma kimliği çözülebiliyor (§4) ama `SEL.chatRoot` **ve** `SEL.codeBlock` **ve** `SEL.docCard` üçü birden hiçbir şey bulamıyorsa, 5 sn içinde tekrar denenir; hâlâ boşsa durum `arayüz-değişmiş` olur:
- Badge kırmızı `!`
- Popup üstünde: `Bu sitede arayüz değişmiş görünüyor — extension güncellenmeli` + `Sorun bildir` bağlantısı (teşhis bloğu hazır yapıştırılmış)
- Sayfaya **hiçbir şey** enjekte edilmez, toast çıkmaz — kullanıcı zaten bir şey istemedi; davetsiz uyarı ancak popup'ı açtığında gösterilir

Kazancı iki taraflı: kullanıcı "bozuk mu, ben mi" sorusundan kurtulur; biz de rapor akışını (§19.9) doğru sınıfa yönlendirmiş oluruz. Sıfır telemetriyle **kendi kendini teşhis eden** bir arıza sınıfı.

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

**İçinde ne yok:** konuşma metni, öğe içeriği, öğe başlığı, **araç adları** (§2.1.3.2 — araç adı tek başına iş bilgisi sızdırır), **geçmiş kayıtları**, konuşma/org UUID'si, kullanıcı adı, e-posta, URL. Yalnızca hangi kademenin çalıştığı, hangi selector'ın tuttuğu, hata tipi.

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
  kinds: { artifact:true, code:true, attachment:true, conversation:true, tool_output:true },
  sites: { … },              // kayıt id → bool; eksik id varsayılan açık
  extraHosts: [],            // kullanıcının izin verdiği ek origin'ler (§3.4.2)
  history: false,            // indirme geçmişi — opt-in, kapalı (§4.3)
  historyMax: 5000,          // kayıt üst sınırı; aşınca en eskiler düşer
  includeCall: true,        // araç çıktısına çağrı parametrelerini göm (§2.1.3.0)
  handoffAt: 40,             // bu mesaj sayısını aşınca bağlam devri önerilir (§2.1.1); 0 = kapalı
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
| Adaptör `Item[]` doğrulamasından geçemedi | O adaptör devre dışı, teşhise yazılır, diğerleri çalışır (§3.4.6) |
| Sağlayıcıda yetenek yok | Kontrol hiç çizilmez — gri/pasif kontrol de gösterilmez |
| Araç çıktısı yalnızca DOM'dan okunabildi | Öğe `⚠ kırpılmış olabilir`, ad `-partial`; arayüz katlanmış/kırpılmış gösteriyor olabilir (§2.1.3.1) |
| Ek indirme endpoint'i bulunamadı | Ekler o sağlayıcıda kapsam dışı; UI'da hiç söz edilmez |
| Sağlayıcı kapalı shadow root kullanıyor | O sağlayıcı **kapsamdan çıkarılır** (§3.4.4.1); yarım destek verilmez |
| Konuşma iframe içinde | `all_frames` gerekiyorsa eklenir; gerekmiyorsa eklenmez (izin yüzeyi) |
| Ek ikili dosya | `ArrayBuffer` olarak yazılır; metin dönüşümüne **sokulmaz** |
| Kademe 1 ile DOM %5'ten fazla ayrışıyor | İndirme engellenmez; sarı toast + teşhise yazılır (§4.1) |
| Konuşma endpoint'i pencereliyor | Sayfalama; mümkün değilse en eski versiyonlar `⚠ erişilemedi` |
| Enjeksiyon React'i çökertiyor | Plan B: buton `body`'ye bağlı hizalı katman olur (§7 adım 2) |
| Kademe 2 gövdesinde artifact işareti kalıntısı | Versiyon `ok:false`, `reason:"tier2_ambiguous"` |
| `old_str` satır sonu farkından tutmuyor | Mismatch raporlanır; içerik **normalize edilmez**, BREAKAGE.md ilk tanı maddesi |
| Boş gövdeli `create` | Geçerli; 0 baytlık dosya iner |
| Numaralarımız panelin göstergesiyle tutmuyor | `v` etiketi bırakılır, sıra + zaman damgası kullanılır (§8.2) |
| Ardışık iki versiyon birebir aynı | Menüde `değişiklik yok` etiketi; ikisi de indirilebilir kalır |
| Zip/toplu indirme iptal edildi | Yarım arşiv **üretilmez**; hiçbir dosya inmez, bilgi toast'ı |
| Toplu ek indirmede 429/403 | İşlem durur, zip üretilmez, `daha az öğe seçin` mesajı — yeniden denenmez (§3.3.2) |
| Ek boyutu meta veriden okunamıyor | `boyut bilinmiyor` yazılır, tahmin edilmez |
| Geçmiş `historyMax`'ı aştı | En eski kayıtlar düşer, sessizce; kullanıcıya sınır ayarlarda görünür |
| `storage.local` kotası doldu | Geçmiş yazımı durur + bir kez uyarı; **indirme etkilenmez** — geçmiş bir kolaylık, yol değil |
| `<a download>` sonrası dosya yazılmadı | Öğrenilemez; toast bu yüzden "indiriliyor" der, "indirildi" demez |
| `old_str` gövdede 2+ kez geçiyor | Versiyon `⚠ kısmi`, `reason:"old_str_ambiguous"` |
| `create` görülmeden `update` geldi | Öğe `⚠ temel bulunamadı`, indirilebilir sürüm yok (§3.0.1) |
| Sürümler arası `type` değişti | Uzantı versiyon başına; `v2.html` + `v3.tsx` birlikte olabilir |
| Aktif dal çıkarılamadı (`parent_message_uuid` zinciri kopuk) | En yeni `created_at`'li yaprak seçilir + sarı toast |
| Kısayol basıldı, öğe yok | `! Bu sayfada indirilecek öğe yok` toast'ı |
| Content script yüklenmemiş sekmede kısayol | Sessiz no-op (hata yutulur) |

İlke: bozuk dosya vermektense hiç dosya vermemek.

### 11.1 Hangi sayılar ayarlanabilir, hangileri değil

Spec'teki eşiklerin bir kısmı **ilkeden** çıkıyor, bir kısmı **tahmin**. İkisini ayırt edememek, implementer'ın ya dokunmaması gereken bir şeyi değiştirmesine ya da gerçekten kötü seçilmiş bir sayıyla yaşamasına yol açar.

**Değişmez (ilkeden çıkar, dokunma):**
`old_str` tam 1 eşleşme kuralı · zip alanlarının bayt cinsinden olması · 120 kod noktası **ve** 200 bayt ad sınırı (dosya sistemi sınırı) · ZIP64 eşikleri (65535 / 4 GB) · `version needed = 20` · toast'ın "indiriliyor" demesi (bilgi sınırı, tercih değil)

**Ayarlanabilir (ölçümle iyileştir):**
`MIN_CODE_LINES = 3` · `handoffAt = 40` · konuşma cache TTL'i 60 sn · pill süresi 4 sn, tanıtım 6 sn · toast 2.5/5 sn · çapraz kademe uyuşmazlık eşiği %5 · sürükleme blob'unun serbest bırakılma gecikmesi 60 sn · `LAST_VERIFIED` 90/180 gün · performans bütçeleri (§19.2) · kademeli yayın %10/%50/%100 ve 48 saat

Ayarlanabilir sayılar tek yerde adlandırılmış sabit olarak tutulur; koda dağılmış çıplak sayı bırakılmaz. Bir sayının kaynağı belirsizse **ayarlanabilir** sayılır — ilke iddiası kanıt ister.

### 11.2 Etkileşim semantiği — ayarların kesiştiği yerler

Tek tek her ayar tanımlı, ama **birlikte** ne yaptıkları değildi. Her biri gerçek bir karar:

| Durum | Karar | Gerekçe |
|---|---|---|
| `defaultVersion: "current"` ama panel kapalı | "Görüntülenen" diye bir şey yok → **son sürüme** düşülür ve menüde `son sürüm` etiketiyle gösterilir | Tanımsız bir tercihi sessizce yorumlamak yerine, hangi kuralın uygulandığını söylemek |
| `cfg.sites[adapter] === false` | Content script'in **ilk işi** bu kontrol; false ise hiçbir observer kurulmaz, hiçbir DOM okunmaz, hemen çıkılır | Manifest eşleşmesi zaten yükledi; kapatma ancak koddan uygulanabilir ve en erken noktada uygulanmalı |
| `autoDownload` açık, `kinds.code` kapalı | Kod blokları otomatik inmez | Görünmeyen bir türün arka planda inmesi, kullanıcının kapatma niyetinin tersi |
| Tek öğe seçiliyken "Seçilenleri indir" | **Zip değil, düz dosya** iner | Tek dosyalık arşiv kullanıcıya fazladan bir açma adımı yükler |
| Filtre aktifken tümünü seç | Yalnızca **görünen** öğeler seçilir | Gördüğün şey aldığın şeydir; filtrenin gizlediğini seçmek sürpriz üretir |
| Seçim varken "Tümü → zip" | Bar **seçime** dönüşür; "tümü" yalnızca seçim yokken görünür | İki toplu eylemin aynı anda görünmesi hangisinin çalışacağını belirsizleştirir |
| Kısayol, odakta öğe yokken | Açık belge indirilir; o da yoksa `! Bu sayfada indirilecek öğe yok` | Sessiz no-op, kısayolun bozuk olduğunu düşündürür |
| `kinds` ile gizlenen tür, sohbet zip'inde | Zip **görünen türleri** kapsar | Zip, listenin toplu hâlidir; listede olmayanı içermesi tutarsızlık olurdu |

## 12. DOM bağımlılık katmanı

Bir sağlayıcıya ait **tüm** selector'lar, o adaptörün dosyasındaki tek `SEL` objesinde. `content.js` hiçbir sağlayıcı seçicisi içermez — içerirse adaptör yalıtımı (§3.4.6) delinir ve bir sağlayıcının değişimi çekirdeği tamir etmeyi gerektirir:
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

**Selector'lar metne bağlanamaz.** Sağlayıcı arayüzleri yerelleştirilmiştir; `[aria-label="Copy"]` veya "Preview" yazısını arayan bir selector, arayüzü Türkçe olan kullanıcıda **sessizce çalışmaz** — ve extension'ı yazan kişi kendi arayüzü İngilizceyse bunu asla göremez. Kural: yalnızca yapısal ve dilden bağımsız işaretler (DOM hiyerarşisi, `data-*`, `role`, ikon `svg` yapısı). Metin eşleştirme yasak. Doğrulama: her sağlayıcının arayüzü Türkçeye alınıp tüm akış tekrar denenir.

**Tema.** Sağlayıcıların açık teması da var; koyu tema varsayan enjekte UI, açık temada okunmaz bir leke olur. Renkler sabit yazılmaz: sağlayıcının kendi hesaplanmış arka plan ve metin rengi okunup CSS değişkenlerine (`--adl-bg`, `--adl-fg`, `--adl-line`) yazılır. Böylece hangi sağlayıcı temayı hangi mekanizmayla değiştirirse değiştirsin (class, `data-*`, `prefers-color-scheme`) peşinden geliriz — ve dördü için ayrı renk tablosu tutmak gerekmez. Vurgu rengi (#d97757) her iki temada da kontrast sağladığı için sabit kalır.

### 12.1 DOM'dan metin okuma kuralları

Sanallaştırma (§4) tek tuzak değil. DOM bir **görüntüleme katmanı**; kodu okunur kılmak için yaptığı her şey, onu veri olarak okuyan için bir bozulma kaynağı. Dördü de gerçek ve dördü de sessiz:

**1. Kod düğümünün içinde UI parçaları olabilir.** Satır numarası sütunu, "Kopyala" düğmesi, dil etiketi — sağlayıcıya göre `pre`'nin **içine** konabilir. `pre.textContent` bunları da alır ve dosyanın başına `1 2 3 …` ya da ortasına `Kopyala` yazar. Kural: metin, `SEL.codeBlock`'un işaret ettiği **kod düğümünden** okunur ve o düğümün altındaki UI çocukları (`button`, `[role="button"]`, satır numarası gutter'ı, dil rozeti) okumadan önce **klonlanmış** bir kopyadan çıkarılır. Sayfanın kendi DOM'una dokunulmaz — klon üzerinde çalışılır.

**2. `innerText` değil, `textContent`.** `innerText` CSS'e tabidir: `text-transform: uppercase` uygulanmış bir tema kodu büyük harfe çevirir, gizli düğümleri atlar, boşlukları normalleştirir. `textContent` ham metni verir. Bu, tercih değil kuraldır.

**3. Sıfır genişlikli karakterler.** Bazı arayüzler satır kaydırma için `<wbr>` ya da U+200B ekler; `textContent` onları da taşır ve kod **görünmez biçimde** bozulur — derleyici hata verir, kullanıcı sebebini göremez. Kural: DOM kademesinde U+200B, U+200C, U+FEFF temizlenir. Kademe 1/2'de **temizlenmez** — orada içerik ham gelir ve o karakterler gerçekten kodun parçası olabilir. Temizlik, bozulmanın kaynağına özgüdür.

**4. Katlanmış / "daha fazla göster" bloklar.** İçerik CSS ile kırpılmışsa `textContent` tamdır, sorun yok; DOM'dan çıkarılmışsa bu §4'teki sanallaştırma kuralının aynısıdır ve aynı tamlık kanıtı aranır.

Bu dört kural `common-dom.js`'te tek bir `readCodeText(node)` fonksiyonunda toplanır — bütün sağlayıcılar ve hem kod blokları hem Kademe 3 aynı yolu kullanır. Ayrı ayrı yazılırsa biri eksik kalır.

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
- `toolOutputs`: çağrı parametreleri `.json`'da sarmalanıyor / `.csv`'de yorum satırı / `.md`'de front-matter; `includeCall:false` ile ham çıktı; `tool_result` bloğundan ad (araç + sıra), uzantı (nesne→`.json`, satır/sütun→`.csv`, metin→`.md`); aynı araç 5 kez çağrılınca 5 ayrı öğe; içerik kırpılmadan
- `activeBranch`: düzenlenmiş mesaj yüzünden dallanmış ağaçta yalnızca aktif dalın op'ları toplanır; terk edilmiş daldaki `update` replay'e **karışmaz**; kopuk zincirde en yeni yaprağa düşüş; op sırası `created_at` geriye gitse bile dal konumunu takip eder
- `readCodeText`: gutter/kopyala düğmesi içeren blokta yalnızca kod döner; U+200B temizlenir; `text-transform` uygulanmış temada büyük/küçük harf korunur
- `sanitize` güvenlik kolu: `../../etc/passwd` ve `~/x` yol bileşenlerini kaybeder; `<img onerror=x>` başlığı dosya adında zararsız metne iner
- `buildVersions` kenar durumları (§3.0.1): ikinci `create` sayacı sıfırlamaz; `create`'siz `update` → `no_base`; `type` değişimi versiyon başına uzantı üretir
- `buildVersions`: create→update→rewrite→update replay doğruluğu; `old_str` bulunamayınca `ok:false` ve içeriğin bozulmaması; `old_str` 2+ kez geçince `ok:false` + `old_str_ambiguous`; tek `create` → tek versiyon; versiyonlar arası başlık değişiminin dosya adına yansıması
- `extFor`: react+tsx → `.tsx`; react+jsx → `.jsx`; text/html → `.html`; mermaid → `.mmd`; svg → `.svg`; code+python → `.py`; bilinmeyen → `.txt`
- `sanitize`: `a/b:c*?"<>|` temizliği; `CON` → `_CON`; 200 karakterlik başlık → 120 cap; sadece `...` → `kind`'e göre yedek ad; **emoji'li başlık kırpılınca yarım surrogate kalmıyor**; çok baytlı başlıkta 200 baytlık sınır önce doluyor
- `fmtName`: her token, eksik token, bilinmeyen token literal kalır; `-partial` uzantıdan hemen önce ve şablondan bağımsız eklenir
- `lineDelta`: tekrar eden satır içeren iki sürümde çokluk kümesi farkı doğru sayar (küme farkı bu testte **kalır**); v1'de `ilk sürüm`
- zip girdi yolu: `kod/` öneki `sanitize`'dan sonra eklenir, ayırıcı `/` hayatta kalır

**zip.js**
- `CRC32("hello") === 0x3610a686`
- local header imzası `0x04034b50`, EOCD imzası `0x06054b50`
- 2 girişli zip'te central directory offset'i local header'ların toplam boyutuna eşit
- **Türkçe adlı + emoji içerikli girdide tüm boyut alanları `byteLength`'e eşit, karakter sayısına değil** — bu test olmadan çok baytlı içerikte sessizce bozuk arşiv üretilir
- general purpose bit 11 (UTF-8 flag) set; `version needed = 20`; veri tanımlayıcısı **yok**

Manuel doğrulama listesi — **her adaptörlü sağlayıcıda tam, taban sağlayıcılarda örnekleme ile** koşulur: her sürümde adaptörlerin tamamı + taban listesinden rastgele üç sağlayıcı, ve `LAST_VERIFIED`'ı 90 günü aşan her taban sağlayıcı. Yirmi sağlayıcıyı her sürümde elle denemek sürdürülemez; tazelik mekanizması (§19.8) kalanı zamana yayar. Seçilen örnek `docs/SMOKE.md`'ye tarihle yazılır ki rastgelelik kapsamı gerçekten dolaşsın.

Koşulan liste; sağlayıcıda o yetenek yoksa satır "uygulanamaz" olarak işaretlenir, atlanmaz. Ek olarak her sağlayıcıda: kod bloğu gezici düğmesinin doğru bloğa hizalanması, üç satırdan kısa blokların kontrol almaması, ad türetme zincirinin dört basamağının da denenmesi, ek indirmenin ikili dosyayı bozmaması, ve klasör tercihinin sağlayıcı başına ayrı sorulması. Claude'a özgü liste: gerçek 3 versiyonlu React artifact; tek versiyonlu markdown; SVG; mermaid; çok uzun (>500 satır) HTML; aynı başlıklı iki artifact; oturum kapalıyken fallback; **mesaj düzenlenip dallanmış konuşma**; iki claude.ai sekmesi açıkken badge'lerin karışmaması; React yeniden render'ından sonra butonun hâlâ orada olması; Preview modundayken fallback sonrası sekmenin geri gelmesi; `prefers-reduced-motion` açıkken animasyonsuz çalışma; klavyeyle menü gezinme; **uzun bir yanıt akarken Performance profili** (extension'ın CPU payı ölçülebilir olmamalı); `{date}` şablonunun `en-US` yerelinde de ISO üretmesi; teşhis bloğunun içinde konuşma verisi bulunmaması; **Claude yazarken indirip akış bitince tekrar indirmek** (ikinci dosya tam olmalı); panel kapalıyken popup'tan indirme; iki artifact'lı sohbette popup'ın seçim listesi; **butonu VS Code'a sürükleyip bırakmak** (hover etmeden ve hover ederek); klasör seçip tarayıcıyı kapatıp açtıktan sonraki ilk indirme (izin istemi + reddedince fallback); klasörde aynı adlı dosya varken indirme; 4 artifact'lı sohbetin zip'i; **sürüklenen dosyanın hedefte tam açılması** (blob erken serbest bırakılmamalı); aynı butonda tıklama ve sürüklemenin ayrı ayrı çalışması; `defaultVersion:"ask"` iken butonun tek parça olması; **eski bir sohbeti açmanın hiç sinyal üretmemesi**; **buton enjekte edilmişken art arda render tetikleyip React hatası aranması** (versiyon değiştir, paneli yeniden boyutlandır, yeni mesaj gönder, sekme değiştir); gövdesinde `</antArtifact>` geçen bir artifact'ın tam inmesi; popup'tan devre dışı bırakma; **dokunmatik ekranda kod bloğu indirme** (hover yokken düğme erişilebilir mi); %200 tarayıcı yakınlaştırmasında hizalanan katmanların kayması; **menüdeki numaraların panelin "Version N" göstergesiyle karşılaştırılması**; **Kademe 1 çıktısının sağlayıcının kopyala düğmesiyle bayt bayt karşılaştırılması**; 200+ mesajlık sohbette API'nin tüm mesajları döndürmesi; aynı artifact'ı iki kez indirip adların ayrışması; DOM fallback'inde `{version}` yerine tarih gelmesi; **↓'ye basıp yanıt gelmeden başka sohbete geçmek** (yanlış dosya inmemeli); hızlı çift tık (tek dosya inmeli); otomatik indirme açıkken Claude artifact yazarken (akış bitene kadar dosya inmemeli); menü açıkken panelin kapanması; **extension'ı yeniden yükleyip eski sekmeye dönmek** (konsol temiz kalmalı, UI kendini kaldırmalı); ilk kurulumda ayar sekmesinin açılması; claude.ai dışında popup'ın boş durumu.

## 15. Chrome Web Store teslimatları

`store/` klasöründe:
- **Gizlilik politikası** (TR+EN): hangi veriye erişiliyor (kayıttaki sağlayıcılarda ve kullanıcının izin verdiği hostlarda konuşma içeriği, yalnızca kullanıcının kendi oturumunda), nereye gidiyor (**hiçbir yere** — dış istek yok, telemetri yok, analytics yok), ne saklanıyor (sadece ayarlar, `storage.sync`)
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
| **Çok sağlayıcının bakımı** — her biri arayüzünü bağımsız değiştirir | Herhangi bir anda bir veya birkaç adaptör bozuk olabilir | Kabul edilmiş risk (§1). Sınırlayıcılar: adaptör yalıtımı (biri bozulunca diğerleri çalışır, §3.4.5) · sağlayıcıdan bağımsız DOM tabanı (değerin çoğu tek kod yolunda, §3.4.3) · adaptör başına uyumluluk testi · bozuk yeteneğin sessizce değil **açıkça** kapanması · sağlayıcı bazında `docs/BREAKAGE.md` girdisi |
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
| Filtre eşleşmelerini vurgulamak için `innerHTML` kullanılmaz; vurgu, metin parçalarının ayrı `textContent` düğümlerine bölünmesiyle yapılır | Kullanıcı girdisi + öğe başlığı aynı satırda buluşuyor; en cazip `innerHTML` kullanım yeri tam da burası |
| `Sorun bildir` bağlantısı bir **gezinme**dir, istek değil: sabit bir depo adresine açılır, gövdesi teşhis bloğudur ve URL kodlamasından geçer | Kullanıcı tıklamadan hiçbir şey olmaz; "dış istek yok" iddiası korunur, ama incelemede sorulmaması için burada yazılı |
| Ağa **hiç** çıkılmaz; `fetch` hedefleri yalnızca kayıttaki ve kullanıcının izin verdiği origin'ler | Gizlilik politikasının doğrulanabilir olması için; CI'daki ağ taraması bunun teknik dayanağı (§19.3) |

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
3. Konuşma içeriği yalnızca bellekte. Cihazdan çıkışı **yalnızca kullanıcının açık eylemiyle** olur ve üç yolu vardır: indirdiği dosya, seçtiği klasöre yazılan dosya, ve taşıma özelliğinde **panoya** yazılan Markdown (§3.3.3). **İstisna, kullanıcının açıkça açtığı indirme geçmişidir** (§4.3): açıksa sohbet başlığı ve öğe adı yerel olarak kalıcı saklanır — içerik değil, hash. Kapalıyken hiçbir şey yazılmaz. Panoyu üçüncü bir hedef olarak burada saymak zorundayız — saymamak bu listeyi yanlış yapardı
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
- `README.md`'de ve mağaza uzun açıklamasında **MCP ajan çıktısı** kullanım örneği (§2.2.2, birinci yol): bir MCP ajanının ürettiği rapor/kod da sohbetin içinde olduğu için sıradan bir öğedir — kullanıcı bunu kendiliğinden düşünmüyor, yazılmazsa keşfedilmiyor
- `docs/SMOKE.md` — aylık smoke test listesi, sonuçlar commit'lenir (§19.8)
- `docs/ADDING-A-PROVIDER.md` — kayıt satırı nasıl eklenir: hangi alanlar zorunlu (`host`, `name`), hangileri opsiyonel (`chatRoot`, `newChatUrl`), fixture nasıl çıkarılır ve temizlenir, uyumluluk paketi nasıl koşulur. Kayıt modeli katkıya açık olmayı hedefliyor; nasıl katkı verileceği yazılı değilse hedef değil temennidir
- `.github/ISSUE_TEMPLATE/provider.yml` — yeni sağlayıcı isteği: host, ekran görüntüsü, `pre > code` var mı
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

Chromium tabanlı Edge/Brave/Opera çalışır ama **test edilmez ve iddia edilmez**. Firefox kapsam dışı (§16'daki bakım yükü zaten kayıtla dolu).

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
8. **Ağ hedefi taraması:** kaynaktaki tüm `http(s)://` literalleri kayıttaki origin'lerin dışına çıkmıyor (kullanıcı hostları çalışma anında gelir, kaynakta yazılı değildir). Mağazadaki "veri toplamıyor" beyanının (§19.6) teknik dayanağı bu kapıdır — beyan ile kod arasındaki tutarsızlık kaldırma sebebi
9. **Selector metin taraması:** `adapters/` içinde doğal dil string'i selector konumunda yok — `[aria-label="Copy"]`, `:has(:contains(…))`, `textContent === "Preview"` gibi kalıplar kırmızı (§12). Yazan kişinin arayüzü İngilizceyse asla göremeyeceği hatayı CI görür
10. **Katman ihlali:** `content.js` hiçbir sağlayıcı seçicisi içermiyor; `SEL` yalnızca `adapters/` altında (§3.4.5, §12). Adaptör yalıtımının tek koruyucusu bu kapı
11. **Ayar kapsaması:** `cfg` şemasındaki her anahtarın panelde bir kontrolü var, panelde şemada olmayan kontrol yok (§8.6). Ayar eklenip UI unutulması bu kapıyla imkânsız
12. **Mantıksal CSS:** `overlay.css` fiziksel yön özelliği içermiyor (`left:`, `right:`, `margin-left`, `padding-right`); yalnızca `inset-inline-*`, `margin-inline-*` (§8.7). RTL bozulmasını sonradan aramak yerine yazarken engeller
13. **Kayıt/adaptör tazeliği:** her kayıt satırında ve her adaptörde `LAST_VERIFIED` var; 90 günden eski **uyarı**, 180 günden eski **kırmızı** (§19.8). Doğrulanmamış bir adaptörle yeni sürüm çıkmaz
15. **Çekirdek taşınabilirliği:** `parse.js`, `zip.js`, `registry.js` içinde `chrome.`, `document.`, `window.` **geçmez** (§4.2). Bu kapı olmadan çekirdek fark edilmeden tarayıcıya çivilenir ve ikinci yüzey yeniden yazım olur
14. **Spec tutarlılığı** (`tools/check-spec.mjs`): kırık `§` referansı yok (kod blokları **dahil** — bir kırık referans tam orada bulunmuştu) · bölüm numaraları artan · `cfg` şeması ile ayar paneli iki yönlü örtüşüyor · spec'te adı geçen her dosya mimari ağaçta veya teslimat listesinde var · `SEL.*` ve `cfg.*` referansları tanımlı · 2+ kez geçen sayısal eşikler raporlanır (tutarsızlık insan gözüyle bakılsın diye)

   Bu kapının gerekçesi doğrudan bu dokümanın geçmişi: kusurların büyük çoğunluğu **aynı değerin iki yerde yazılıp birinin güncellenmemesinden** çıktı. Dokümanda derleyici yok; onun yerini bu kapı alır. Spec de kod gibi bakım gerektirir, ve bakım gerektiren her şey bir kapı hak eder

### 19.4 Sürümleme ve paketleme

Semver. `node tools/pack.mjs` → `dist/ai-chat-downloader-<version>.zip`; `docs/`, `test/`, `tools/`, `.superpowers/`, `.github/` hariç. Üretilen zip'in SHA-256'sı `CHANGELOG.md`'ye yazılır — mağazadaki paketin depodaki commit'ten üretildiği doğrulanabilir olsun.

Her yayın bir git tag'i: `v1.0.0`.

### 19.5 Yayın öncesi kapı

Aşağıdakilerin **tamamı** işaretlenmeden gönderim yapılmaz:

- [ ] CI yeşil (§19.3'ün **tamamı** — sayı burada tekrarlanmaz, sayılar sürüklenir)
- [ ] Manuel doğrulama listesi (§14) örnekleme kuralına göre koşuldu ve örnek `SMOKE.md`'ye yazıldı
- [ ] Performans bütçeleri (§19.2) ölçüldü ve aşılmadı
- [ ] Enjeksiyon çökme testi (§7 adım 2) adaptörlü sağlayıcılarda temiz
- [ ] Erişilebilirlik: klavyeyle tam akış, ekran okuyucuyla toast/menü duyurusu, `prefers-reduced-motion`, **bir kod bloğu yalnızca klavye + ekran okuyucu ile popup'tan indirildi** (§8.6.1) (kod bloklarının tek erişilebilir yolu, §8.1.1)
- [ ] Açık + koyu tema, TR + EN arayüz, RTL kontrolü
- [ ] Dokunmatik cihazda kod bloğu indirme erişilebilir (§8.1.1) · %200 yakınlaştırmada hizalama
- [ ] Yayıncı hesabında donanım anahtarı/passkey aktif, CI'da yayın yetkisi yok (§17.1)
- [ ] Her adaptörün `LAST_VERIFIED`'ı güncel · paket SHA-256'sı CHANGELOG'a yazıldı (§19.4)
- [ ] Teşhis bloğu (§8.9) hiçbir konuşma verisi içermiyor — çıktı gözle denetlendi
- [ ] `history` varsayılan **kapalı**; kapalıyken hiçbir kalıcı kayıt yazılmadığı doğrulandı (§4.3)
- [ ] İzin listesi minimal: `storage` + 4 host + opsiyonel `notifications`. Fazlası yok
- [ ] Gizlilik politikası yayımlandı ve URL erişilebilir
- [ ] Ekran görüntüleri **demo** konuşmadan
- [ ] Marka feragatnamesi kayıttaki **her** sağlayıcı için açıklamada
- [ ] `docs/BREAKAGE.md` adaptörlü sağlayıcılar için dolu, taban için ortak bölüm var
- [ ] Önceki sürümün zip'i saklandı (§19.7)

### 19.6 Mağaza gönderimi

- **Tek amaç beyanı:** "AI sohbet asistanlarında üretilen kod, doküman ve dosyaları çıkarmak, sürümlemek ve yeniden kullanılabilir hâle getirmek." — §2.1'deki omurgayla birebir aynı cümle olmalı; ürünün ne olduğu iki yerde farklı yazılırsa incelemede tutarsızlık olur
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
- **Aylık smoke test:** adaptörlü sağlayıcılar + üç taban örneği için kısa kontrol listesi (buton görünüyor mu, indirme çalışıyor mu, konsol temiz mi). Depoda `docs/SMOKE.md` olarak; sonuç tarih + sağlayıcı ile commit'lenir.
- Mağaza yorumları ve GitHub issue'ları haftalık gözden geçirilir. Sağlayıcı arayüz değişimleri genelde önce burada görünür.
- Bir sağlayıcı bozulduğunda kullanıcıya görünen davranış: o sağlayıcıda yetenek kapanır ve teşhis bloğu sebebi taşır — sessiz hata yok.

### 19.9 Destek akışı

GitHub issue şablonu **teşhis bloğunu (§8.9) zorunlu alan** yapar. Blok olmadan açılan issue'ya ilk yanıt: "popup → Teşhis bilgisini kopyala". Böylece hata raporu ilk turda tanı tablosuna (§18 `BREAKAGE.md`) düşer.

Kullanıcıya açık **bilinen sınırlar** listesi (`docs/LIMITATIONS.md`), README'den bağlantılı: tarayıcı indirmelerinde tamamlanma doğrulanamaz (§8.4) · versiyon geçmişi Claude'da kesin, diğer sağlayıcılarda yetenek matrisine bağlı (§3.4.4) · DOM kademesinde yalnızca görüntülenen sürüm · ekler sağlayıcıya göre değişir · sağlayıcı arayüz değişiminde geçici bozulma olabilir. Sınırları önceden söylemek, sonradan şikâyet olarak öğrenmekten ucuz.

### 19.10 Bitti tanımı

Bir sağlayıcı **bitti** sayılır ancak: adaptör yetenek matrisindeki her satırı ya uygular ya açıkça kapatır · uyumluluk paketi geçer · fixture'ları commit'li · `SEL` tek objede ve metne bağlı değil · enjeksiyon çökme testi temiz · manuel liste o sağlayıcıda koşuldu · `BREAKAGE.md` bölümü yazıldı · `LAST_VERIFIED` güncel.

Ürün **yayına hazır** sayılır ancak §19.5'teki kapının tamamı işaretliyse.

## Uygulama sırası (özet)

1. **Sağlayıcı keşfi (adaptör adayları için tam, taban adayları için yalnızca erişilebilirlik + `chatRoot`):** konuşma kimliği nereden okunur, API var mı ve yanıt şekli nedir, akış nasıl tespit edilir, `SEL` seçicileri, ek endpoint'i, enjeksiyonun framework'ü çökertip çökertmediği (§7 adım 2). Claude için ayrıca `tool_use` şeması **ve** ağaç alanları (`parent_message_uuid`, `current_leaf_message_uuid`). Keşif çıktısı yetenek matrisini (§3.4.4) doldurur; doğrulanamayan yetenek o sağlayıcıda kapatılır
2. Çekirdek saf katman: `Item` modeli, `parse.js` (fold + `Item` doğrulama), adlandırma zinciri, `zip.js` — hepsi `selftest.js` ile TDD
3. `manifest.json` iskeleti (sağlayıcı başına ayrı `content_scripts` bloğu, §5) + i18n altyapısı
4. `content.js` çekirdeği: adaptör seçimi, observer, UI kabuğu (buton, menü, pill, toast). **Sağlayıcı seçicisi içermez** (§12)
5. `common-dom.js` — sağlayıcıdan bağımsız kod bloğu çıkarımı + gezici düğme (§8.1.1); kayıttaki her sağlayıcıda doğrulanır. Bu adım tek başına **kayıttaki tüm sağlayıcılarda** çalışan bir ürün verir
6. `claude.js`: aktif dal çıkarımı → op toplama → versiyonlar → versiyon menüsü + üç kademe
7. `chatgpt.js` ve keşifte belge/versiyon çıkan diğer adaptörler — yetenek matrisine göre; doğrulanamayan yetenek kapatılır. Taban sağlayıcılar adaptör almaz, kayıt satırıyla yetinir
8. Ekler: endpoint keşfi, ikili yazım, yoksa kapsamdan çıkar (§3.3.2)
8a. Araç çıktıları (§2.1.3): `tool_use`/`tool_result` blokları → `kind:"tool_output"`, ad/uzantı türetme, API'siz sağlayıcıda `⚠ kırpılmış olabilir`
8b. Sohbet Markdown'ı + taşıma (§3.3.3): `kind:"conversation"`, pano, `newChatUrl`, boyut uyarısı
8c. İndirme geçmişi (§4.3): opt-in, hash indeksi, `Geçmiş` sekmesi, sohbetler arası tanıma
8d. Omurga üçlüsü (§2.1.1): bağlam devri önerisi, alınmamış öğe göstergesi, `Bağlam olarak kopyala` — üçü de 8c'ye bağlı ya da ondan ucuzlar
9. `sw.js`: badge, nabız, kısayol, sistem bildirimi
10. `panel.html/js`: öğe listesi, ayarlar, canlı önizleme, teşhis, acil durdurma
11. Sürükle-bırak + klasöre kaydet (§8.7.1, §8.7.2)
12. İkonlar (16/48/128 + nabız kareleri)
13. CI kapıları + `tools/check-invariants.mjs` + `tools/pack.mjs` (§19.3, §19.4)
14. Manuel doğrulama listesi — örnekleme kuralına göre (§14)
15. Performans bütçelerinin ölçümü (§19.2)
16. `store/` teslimatları + gizlilik politikasının yayımlanması
17. Yayın öncesi kapı (§19.5) → kademeli yayın (§19.7)

### MVP kesme çizgisi

Kapsam bu dokümanın ömrü boyunca büyüdü (artifact → dört öğe türü → sağlayıcı kaydı + kullanıcı hostları). Tek kişilik bir projede bunun gerçek riski kod değil, **hiçbirinin bitmemesi**. Bu yüzden kesme çizgisi baştan yazılı:

**MVP = 1-5. adımlar.** (Araç çıktıları 8a'da, MVP dışında — API kademesi gerektirdiği için taban sağlayıcılarda zaten çalışmaz.)

**MVP = 1-5. adımlar.** Yani: çekirdek + `common-dom.js` + gezici düğme, **kayıttaki her sağlayıcıda** kod bloğu indirme, doğru ad ve uzantı, tekil dosya indirmesi, adı düzeltebilme, kopyalama. Versiyon yok, zip yok, ek yok, klasör yok, sürükleme yok.

Bu neden yayınlanabilir bir üründür: kod blokları **kaç sağlayıcı olursa olsun tek kod yolundan** çıkar (§3.4.4), yani MVP'nin bakım yükü sağlayıcı sayısıyla değil, kayıt satırı sayısıyla artar — ve bir satır bir seçicidir. Ve indirilen kodun çoğu zaten artifact değil (§2) — kullanıcının en sık ihtiyacı burada.

**Sonra sırayla:** 6-7 (artifact/canvas + versiyon, Claude'dan başlayarak) → 11 (sürükle-bırak, klasör) → 8 (ekler). Her biri bağımsız olarak yayınlanabilir ve her biri kendi başına bir sürüm notu eder.

**Kesme çizgisinin altında kalanlar ertelenmez, kapatılır:** MVP'de versiyon menüsü *gizlenmez*, hiç çizilmez (§3.4.4'deki "yetenek yoksa kontrol de yok" kuralı). Kullanıcı eksik bir şey görmez, olmayan bir şeyi de beklemez.

**Sıra gerekçesi:** 5. adım bilerek adaptörlerden önce — kod blokları tüm sağlayıcılarda tek kod yoluyla çalıştığı için, oraya kadar gelen bir yapı zaten yayınlanabilir bir üründür. Artifact/versiyon katmanı (6-7) onun üstüne eklenir, altına değil.

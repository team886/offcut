# İzin gerekçeleri ve veri kullanım beyanı

Mağaza formu her izni ayrı soruyor. Aşağıdakiler doğrudan yapıştırılabilir.

| İzin | Gerekçe |
|---|---|
| `storage` | Kullanıcının ayarlarını (dosya adı şablonu, hangi öğe türleri gösterilsin, hangi siteler açık) ve isteğe bağlı indirme geçmişini cihazda saklamak için. |
| Host izni — `claude.ai`, `chatgpt.com`, `gemini.google.com`, `www.perplexity.ai` ve kayıttaki diğer sohbet siteleri | Açık sohbetin içeriğini okuyup indirilebilir öğeleri (kod blokları, belgeler, araç çıktıları, kaynaklar, görseller, ekler) bulmak için. Yalnızca kullanıcının kendi oturumunda ve yalnızca o an açık olan konuşma için. |
| `notifications` *(opsiyonel)* | Yalnızca kullanıcı "sistem bildirimi" seçeneğini kendisi açarsa istenir; bir belge tamamlandığında haber vermek için. |
| `optional_host_permissions` | Listede olmayan, kullanıcının kendi kurduğu sohbet arayüzlerinde (Open WebUI, LibreChat) çalışabilmek için. Kurulumda değil, kullanıcı o sitede "burada da çalıştır" dediğinde istenir. |

## Veri kullanımı beyanı

Chrome her kategoriyi ayrı soruyor:

| Kategori | Cevap |
|---|---|
| Kişisel iletişim bilgisi | Toplanmıyor |
| Sağlık / finansal / kimlik doğrulama bilgisi | Toplanmıyor |
| Kişisel iletişim içeriği | **Toplanmıyor** — okunur ve işlenir, cihazda kalır, hiçbir yere gönderilmez |
| Konum, kullanıcı etkinliği, web geçmişi | Toplanmıyor |

Üç ek beyan da işaretlenir: veri satılmaz veya üçüncü taraflara aktarılmaz · onaylanan tek amaç dışında kullanılmaz · kredi değerlendirmesi veya borç toplama amacıyla kullanılmaz.

## Beyanın teknik dayanağı

Bu beyan iddia değil, **her sürümde doğrulanan** bir kısıt: CI'daki ağ hedefi taraması (spec §19.3, kapı 8) kaynak kodda izin verilen origin'ler dışında hiçbir `http(s)://` literali bulunmadığını kontrol eder ve ihlalde paket üretilmez.

Beyanla kodun tutarsız olması mağazadan kaldırma sebebidir. Bu kapı o tutarsızlığı imkânsız kılıyor — inceleme sorarsa gösterilecek şey budur.

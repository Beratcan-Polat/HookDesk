# Mimari

**Türkçe** · [English](overview.en.md) · [Proje](../../README.md)

## Çalışma düzeni

React arayüzü, Laravel API'sinden bağımsız bir SPA olarak çalışır. Üretimde Caddy, derlenmiş arayüzü sunar ve API ile kimlik doğrulama isteklerini aynı adres üzerinden Laravel PHP-FPM'e yönlendirir. Tarayıcı oturumlarında Sanctum/Fortify çerezleri ve CSRF koruması kullanılır. Proje API anahtarları ayrı bir middleware ile doğrulanır; kullanıcı paneline veya yönetim API'sine erişim sağlamaz.

Olaylar, teslimat durumları, denemeler, işlem sahipliği, kullanım sayaçları ve işlem geçmişi PostgreSQL'de tutulur. Redis, kuyruk işleri ve paylaşılan önbellek sayaçları için kullanılır. Zamanlayıcı, zamanı gelen teslimatları PostgreSQL'den bulup kuyruğa alır, yarıda kalan işlemleri toparlar ve saklama kurallarını uygular.

Test alıcısı aynı backend imajını `APP_ROLE=receiver` ile çalıştırır. Yalnızca iç ağdan erişilir; dışarıya açılmış portu yoktur. Kullanıcının tanımladığı hedefler, bu sistem alıcısına ait özel ağ istisnasını kullanamaz.

## Olayın kabulü ve teslimatı

Kabul işlemi çalışma alanı satırını kilitler; hesap ve proje durumunu, kullanım limitini ve idempotency anahtarını kontrol eder. Değişmez olay gövdesi ve ilk teslimatlar aynı veritabanı transaction'ında kaydedilir. Hedef servisin erişilebilir olması kabul yanıtının ön koşulu değildir.

Dağıtıcı, kuyruğa aldığı teslimatın `queued_until` alanını 60 saniye ilerletir. Worker, zamanı gelen teslimatı satır kilidi ve yeni bir sahiplik token'ıyla alır; başlayan denemeyi kaydeder. HTTP isteğini transaction dışında gönderir. Sonucun yazılması için sahiplik token'ının hâlâ aynı olması ve teslimatın `processing` durumunda bulunması gerekir.

Bir zaman aşımı veya kaybolan yanıt, alıcının olayı işleyip işlemediğini belirsiz bırakabilir. Kurtarma işlemi böyle bir denemeyi `unknown` olarak kaydeder ve yeniden deneme politikasını uygular. Teslimat modeli **en az bir kez** çalışır; alıcının olay kimliğine göre tekilleştirme yapması gerekir.

## Yetki ve güvenlik sınırları

- Platform rolü ile çalışma alanı rolü birbirinden ayrıdır.
- Çalışma alanına erişimde üyelik ve kaynağın ilgili çalışma alanına ait olması doğrulanır.
- Süper Admin işlemleri ayrı API üzerinden yürür. Doğrulanmış e-posta, kritik işlemlerde güncel parola onayı ve işlem gerekçesi gerekir. Süper Admin girişinde Authenticator kodu istenmez.
- Destek oturumlarının otomatik süre sınırı yoktur; elle sonlandırılana veya erişim iptal edilene kadar kullanılabilir.
- Destek işlemlerinde gerçek yönetici kimliği korunur ve hedef kullanıcının güncel yetkileri her işlemde kontrol edilir.
- API anahtarları ve kaynak token'ları özetlenerek saklanır. Teslimatta tekrar kullanılması gereken imza sırları şifrelenir.
- Yönetici payload erişimi, gerekçe gerektiren ayrı bir istekle yapılır. Yanıt `no-store` ile tarayıcı önbelleğine alınmaz.
- cURL bağlantısı, DNS kontrolünden geçen IP adresine `CURLOPT_RESOLVE` ile sabitlenir. Başka bir HTTP işleyicisine geçilerek bu kontrolün atlanmasına izin verilmez.
- Kimlik doğrulama çerezleri, yetkilendirme başlıkları, kaynak token'ları ve payload içerikleri işlem geçmişinin metadata alanlarına kopyalanmaz.

## Veri modeli ve indeksler

Birincil anahtarlar ULID biçimindedir. Migration'lar; üyeliklerin, idempotency kapsamının, hedef aboneliklerinin ve teslimat/deneme numarası çiftlerinin benzersizliğini korur. Her çalışma alanında tek sahip bulunur. Aynı olay ve hedef için tek aktif teslimat veritabanı seviyesinde korunur.

Teslimat taramalarında durum ve `next_attempt_at`, olay listelerinde proje ve oluşturulma zamanı indekslerinden yararlanılır.

Kabul edilen olayın gövdesi ve verisi değiştirilmez. Süresi dolan idempotency arama anahtarı temizlenebilir. Saklama işlemi, bir olayı bağlı teslimat ve deneme kayıtlarıyla birlikte ancak tüm teslimatlar terminal duruma geldikten sonra siler.

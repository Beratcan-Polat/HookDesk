# Testler

**Türkçe** · [English](testing.en.md) · [Proje](../../README.md)

Testler; çalışma alanı izolasyonunu, kesintiden sonra teslimatın devam etmesini, yinelenen istekleri ve yönetici ile destek oturumu yetkilerinin sınırlarını doğrular.

## Birim ve özellik testleri

`backend` klasöründe:

```sh
php vendor/bin/pest
php vendor/bin/pint --test
php vendor/bin/phpstan analyse --memory-limit=512M
```

Varsayılan test profili bellekte SQLite kullanır. PostgreSQL'e özel senaryolar bu profilde atlanır. Veritabanı testleri migration çalıştırır ve test tablolarını kaldırır. Varsayılan bağlantı değiştirildiğinde, konteyner içindeki çalıştırmalar dahil, mutlaka ayrı bir test veritabanı kullanılmalıdır.

## PostgreSQL entegrasyonu

Test sürecinde `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE=hookdesk_test`, `DB_USERNAME` ve `DB_PASSWORD` değişkenleri ayarlanır. PHP'de `pdo_pgsql` eklentisi etkin olmalıdır.

Eşzamanlılık testleri, aynı idempotency anahtarıyla dört bağımsız PHP süreci başlatır ve tek olay kabul edildiğini doğrular. Başka bir testte dört worker aynı teslimatı sahiplenmeye çalışır; yalnızca biri başarılı olmalıdır.

HTTP entegrasyon testi, yerel ağ adresindeki geçici bir portta alıcı başlatır. Gerçek imzalı istekleri, geçici hatalardan sonra yeniden denemeyi, alıcıda tekilleştirmeyi ve yanıt gövdesinin boyut sınırında kesilmesini kontrol eder.

## Redis entegrasyonu

Gerçek kuyruğa iş bırakma ve işleme testini açmak için `RUN_REDIS_TESTS=true` kullanılır. `REDIS_HOST`, `REDIS_PORT` ve `REDIS_DB` ile ayrı bir Redis sunucusu veya veritabanı seçilir. Uygulamanın kullandığı Redis verileri test ortamıyla paylaşılmaz.

## Frontend kontrolleri

`frontend` klasöründe:

```sh
npm ci
npm run lint
npm run test
npm run build
```

## Tarayıcı testleri

API, alıcı, worker, zamanlayıcı ve frontend; tarayıcı testlerine ayrılmış veritabanıyla başlatılır. E-postası doğrulanmış test hesabı için `E2E_EMAIL` ve `E2E_PASSWORD` ayarlanır. `hookdesk:demo`, testlerin kullandığı örnek kullanıcıyı ve çalışma alanını oluşturur.

Yönetici test verisini hazırlamak için `backend` klasöründe:

```sh
php tests/Support/seed-browser.php
```

JSON çıktısı Git'in yok saydığı bir dosyaya kaydedilir; `E2E_ADMIN_FILE` değişkenine dosyanın mutlak yolu verilir. Çıktı, oluşturulan hesap bilgilerini ve TOTP test sırrını içerir. Bu sır, Süper Admin girişinde doğrulama kodu gerektirmez; mevcut bir Authenticator kurulumu olan yönetici hesabının da parolayla girebildiği test edilir. Yardımcı betik üretim ortamında çalışmaz.

Betik, test yöneticisinin giriş bilgilerini yeniler; Türkçe ve İngilizce senaryolar için ayrı çalışma alanları, doğrulanmış/doğrulanmamış üyeler ve terminal durumdaki örnek teslimatlar oluşturur. Panel testleri bu verilerle gerçek sahiplik aktarımı ve limit değişikliği yapar. Bu nedenle hazırlık yalnızca tarayıcı test veritabanında çalıştırılır.

Davet, 2FA kurulumu ve destek oturumu yaşam döngüsü testleri için `APP_ENV=testing` ve `hookdesk_browser` veya `hookdesk_browser_<suffix>` adlı veritabanı gerekir. Ek test verileri `backend` klasöründen hazırlanır ve çıktısı paylaşılmadan saklanır:

```sh
php tests/Support/seed-lifecycle.php > ../.runtime/browser-lifecycle.json
```

`E2E_LIFECYCLE_FILE` değişkeni bu JSON dosyasının mutlak yoluna ayarlanır. Her dil için ayrı sahipler, davet edilen kullanıcılar ve 2FA kurulumu bulunmayan kullanıcılar oluşturulur. Worker'ın SMTP gönderimi Mailpit'e yönlendirilir. `E2E_MAILPIT_URL`, Mailpit HTTP API adresidir; varsayılanı `http://localhost:8025` olur. Davet testleri kuyruktan gönderilen gerçek e-postadaki bağlantıyı izler.

Yalnızca komut satırından çalışan `control-browser.php`, test hesabının 2FA kurulum sırrını okur ve bu test verilerine ait destek oturumunu açıkça iptal eder. İşlemden önce ortam ve veritabanı adı kontrol edilir; oturumun özel test dosyasıyla eşleşmesi gerekir. Uygulamaya saat veya oturum durumunu değiştiren bir test HTTP ucu eklenmez. Hazırlık betikleri normal geliştirme hesaplarının bulunduğu veritabanlarında çalıştırılmaz.

`frontend` klasöründe:

```sh
npx playwright install chromium
npm run test:e2e
```

Yedi dosyada 14 tarayıcı senaryosu bulunur. Bunlar tanıtım ve belge sayfalarını, Türkçe/İngilizce metinleri, mobil düzeni, giriş hatalarını, parola kurtarmayı, olay yayımlamayı, yöneticinin yalnızca parolayla girişini, kritik işlem öncesi parola onayını ve işlem yapılabilen destek oturumlarını kapsar. Panel senaryoları toplu yeniden gönderimi, limit geçersiz kılmayı, varsayılan limitlere dönmeyi ve doğrulanmış üyeye sahiplik aktarımını doğrular. Yönetici giriş ve parola onayı yardımcıları Authenticator kodu istenmediğini de kontrol eder.

Türkçe ve İngilizce olarak çalışan altı davet, 2FA ve destek senaryosu şunları doğrular:

- **Ekip davetleri:** kuyruk üzerinden SMTP gönderimi, e-posta dili, farklı e-postayla kabulün reddi, süresi dolmuş veya kullanılmış davetin reddi, başarılı kabul ve Viewer rolünün yazma kısıtları.
- **İki aşamalı doğrulama:** QR ile kurulum, hatalı kodun reddi, kurulum onayı, yenileme sonrası kurtarma kodlarının gizlenmesi, Authenticator ve kurtarma koduyla giriş, kullanılan kurtarma kodunun tekrar reddedilmesi. Kurulum ekranlarında ekran görüntüsü ve trace kaydı kapatılır. Bu akış normal kullanıcılar içindir.
- **Destek yaşam döngüsü:** sunucunun bitiş süresi döndürmemesi, izinli işlemlerin yapılması, tarayıcı saati iki gün ilerletildiğinde oturumun açık kalması, açık iptalle işlem kontrollerinin kaldırılması, eski okuma/yazma isteklerine `403` dönmesi ve yöneticinin kendi oturumunun korunması.

Destek testleri, sınırsız süreyi ve sunucu tarafındaki sonlandırmayı ayrı ayrı doğrulamak için tarayıcı saatini ilerletir ve eşleşen test veritabanı kaydını iptal eder.

İki yerel adres senaryosu da `localhost` ve `127.0.0.1` üzerinden giriş, sayfa yenileme ve çıkışı kontrol eder. Her iki adres/port çifti `SANCTUM_STATEFUL_DOMAINS` içinde bulunmalıdır. `E2E_BASE_URL`, Playwright'ın varsayılan `http://localhost:5173` adresini değiştirmek için kullanılabilir.

Ekran görüntüleri ve başarısız testlerin trace kayıtları, Git'in yok saydığı `test-results` ve `playwright-report` klasörlerine yazılır.

## Docker uçtan uca kontrolü

Geliştirme servisleri açıldıktan sonra proje kökünde Node.js 24 ile:

```sh
node infra/scripts/smoke.mjs
```

Bu kontrol; Mailpit üzerinden SMTP'yi, imzalı e-posta doğrulama bağlantısını, çerez/CSRF oturumunu, API anahtarlarını, idempotency davranışını, gerçek webhook tekrarlarını, alıcıda tekilleştirmeyi ve gelen kaynakları doğrular.

`--recovery` seçeneği ayrıca worker'ı durdurur, Redis'i yeniden başlatır ve bekleyen teslimatın sonradan tamamlandığını kontrol eder. Bu seçenek ayrı bir geliştirme ortamında çalıştırılmalıdır. Kurulum, test sonrası temizlik ve hata inceleme adımları [Docker geliştirme rehberindedir](docker-development.md) (İngilizce).

## Yük testleri

İzole Docker ortamında temel ölçümü çalıştırmak için proje kökünde `node infra/performance/run.mjs` kullanılır. Daha küçük CI senaryosu için `--smoke` eklenir. API yanıt süresi, kuyruk ve teslimat süreleri, gerçek imzalı alım sayıları ve Docker kaynak kullanımı ölçülür. Senaryo büyüklükleri, test limitleri, temizlik ve ölçüm hassasiyeti [performans rehberinde](performance.md) açıklanır (İngilizce).

## Sürekli entegrasyon

[GitHub Actions](../../.github/workflows/ci.yml); PostgreSQL ve Redis ile backend kontrollerini, frontend kontrollerini, konteyner derlemelerini, Docker uçtan uca/kurtarma akışını, tarayıcı senaryolarını ve izole yük testi kontrolünü çalıştırır. Çalışma sonuçları deponun [Actions sayfasından](https://github.com/Beratcan-Polat/HookDesk/actions) izlenebilir.

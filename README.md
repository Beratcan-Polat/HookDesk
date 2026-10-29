# HookDesk

**Türkçe** · [English](README.en.md) · [Mimari](docs/architecture/overview.md) · [API](docs/api/openapi.json) · [Testler](docs/runbooks/testing.md)

HookDesk'i, uygulamalar arasında webhook ile taşınan olayların teslimatını ve takibini yönetmek için geliştirdim. Bir hedef servis yanıt vermediğinde olayın kaybolmaması, gönderimin yeniden denenmesi ve ne olduğunu panelden görebilmek bu projenin çıkış noktası oldu.

Backend'i Laravel 13, arayüzü React 19 ve TypeScript ile ayrı uygulamalar olarak kurdum. Olayları ve teslimat durumlarını PostgreSQL'de saklıyorum; Redis'i kuyruk, önbellek ve hız sınırları için kullanıyorum.

## Özellikler

- E-posta doğrulama, şifre sıfırlama ve normal kullanıcılar için isteğe bağlı iki aşamalı doğrulama.
- Çalışma alanları, projeler, ekip davetleri ve rol bazlı yetkiler.
- Proje bazlı API anahtarları ve gelen webhook kaynakları.
- Olay türüne göre hedef abonelikleri ve HMAC-SHA256 ile imzalı gönderim.
- Başarısız teslimatlarda yeniden deneme, elle tekrar gönderim ve deneme geçmişi.
- Aynı isteğin tekrarında yeni olay oluşmasını önleyen idempotency desteği.
- Kullanım limitleri, hedef duraklatma ve işlem kayıtları.
- Süper Admin yönetimi ve kullanıcının yetkileriyle sınırlı, süre sınırı olmayan destek oturumları.
- Türkçe ve İngilizce arayüz.

## Teslimat akışı

1. API anahtarı, proje yetkisi ve kullanım limiti kontrol edilir.
2. Olay ve ilgili teslimatlar aynı PostgreSQL transaction'ında kaydedilir.
3. Worker, hedefe imzalı HTTP isteğini gönderir ve sonucu kaydeder.
4. Geçici hatalarda gönderim yeniden planlanır. Zamanlayıcı, kuyrukta kaybolan veya yarıda kalan işleri veritabanından tekrar işleme alır.

API'nin döndürdüğü `202`, olayın kalıcı olarak kabul edildiğini belirtir. Teslimat sırası garanti edilmez ve aynı olay alıcıya birden fazla kez ulaşabilir. Örnek alıcıda bu nedenle olay kimliğiyle tekilleştirme uyguladım.

## Teknolojiler

- **Backend:** PHP 8.4, Laravel 13, Eloquent, Sanctum, Fortify.
- **Frontend:** React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS, shadcn/ui, i18next.
- **Veri ve altyapı:** PostgreSQL 18, Redis 8, Docker Compose, Caddy, Mailpit.
- **Test ve kalite:** Pest, Larastan, Pint, Vitest, React Testing Library, Playwright ve GitHub Actions.

## Kurulum

Docker Engine ve Docker Compose gerekir. Windows'ta Docker Desktop, Linux konteynerleri ve WSL 2 ile kullanılmalıdır.

```sh
git clone https://github.com/Beratcan-Polat/HookDesk.git
cd HookDesk
```

### Windows

Kurulum betiği ortam dosyasını hazırlar, uygulama anahtarını oluşturur, servisleri başlatır ve migration'ları çalıştırır:

```powershell
.\infra\scripts\setup.ps1
```

### Linux

Yeni bir klonda:

```sh
cp .env.example .env
docker compose build app
docker compose run --rm --user root app composer install --no-interaction
docker compose run --rm --user root app sh -c 'chown -R www-data:www-data vendor storage bootstrap/cache'
docker compose run --rm app php artisan key:generate --show
```

Son komutun ürettiği değeri kök dizindeki `.env` dosyasının `APP_KEY` alanına yazdıktan sonra:

```sh
docker compose up -d
docker compose exec app php artisan migrate --force
```

- Uygulama: [localhost:8080](http://localhost:8080)
- Geliştirme e-postaları: [localhost:8025](http://localhost:8025)

Çalışan Docker ortamını Node.js 24 ile uçtan uca kontrol etmek için:

```sh
node infra/scripts/smoke.mjs
```

Bu kontrol kayıt, e-posta doğrulama, API anahtarı, imzalı teslimat ve yeniden deneme akışını gerçek servislerle çalıştırır. Kurulum, servisleri yeniden başlatma ve kesinti testi için [Docker geliştirme rehberini](docs/runbooks/docker-development.md) ekledim.

Docker kullanmadan geliştirme için [yerel kurulum rehberini](docs/runbooks/native-development.md) hazırladım.

## Uygulamayı deneme

Kayıt ekranından hesap açılabilir; doğrulama e-postaları Mailpit üzerinden görüntülenir. Hazır bir çalışma alanıyla başlamak için:

```sh
docker compose exec app php artisan hookdesk:demo
```

Bu komut, rastgele parolalı bir geliştirme hesabı ve test hedefi oluşturur. Hesap bilgileri komut çıktısında gösterilir. Test hedefi ilk iki isteğe `500`, sonraki isteğe `200` döner; panelde yeniden deneme akışı izlenebilir. Komut üretim ortamında çalışmaz.

İlk Süper Admin hesabını e-postası doğrulanmış etkin bir kullanıcıya atamak için:

```sh
docker compose exec app php artisan hookdesk:admin admin@example.com
```

### Yönetim ve destek

Süper Admin hesabına e-posta ve parolayla giriş yapılır; Authenticator kodu istenmez. Hassas değişikliklerde işlem gerekçesi ve beş dakika geçerli bir parola onayı gerekir. Bu onay süresi, destek oturumunu sınırlandırmaz.

Destek oturumlarını, yöneticinin sorunu kullanıcının çalışma alanında inceleyip o kullanıcının yetkileriyle işlem yapabilmesi için ekledim:

- Destek oturumunda süre sınırı yoktur. Yönetici elle sonlandırır; yeni oturum başlatıldığında önceki oturum kapanır.
- Üyelik ve yetkiler her istekte kontrol edilir. Hesabın askıya alınması veya yöneticilik rolünün kaldırılması erişimi sonlandırır.
- İşlem kayıtlarında hem yönetici hem de adına işlem yapılan kullanıcı korunur.

Normal kullanıcılar kendi hesaplarında isterse iki aşamalı doğrulamayı açabilir.

## API kullanımı

Olay kabulü için `POST /api/v1/events` kullanılır. İstek, proje API anahtarını `Authorization: Bearer ...` başlığında taşır ve `Content-Type: application/json` ile gönderilir:

```json
{
  "type": "order.created",
  "data": {
    "order_id": "ORD-1042",
    "amount": 1200
  }
}
```

İsteğe bağlı `Idempotency-Key` başlığı 24 saat boyunca aynı ham istek gövdesini aynı olayla eşleştirir. İmza doğrulaması ve olay tekilleştirme için [örnek alıcıyı](examples/receiver.php), tüm uçlar için [OpenAPI sözleşmesini](docs/api/openapi.json) ekledim.

## Araç kiralama entegrasyonu

HookDesk'i araç kiralama projemde rezervasyon onayları için kullandım. Java uygulaması rezervasyonu ve gönderilecek olayı aynı MySQL transaction'ında kaydediyor; HookDesk `rental.created` olayını kabul edip imzalı olarak Python e-posta servisine teslim ediyor.

Normal teslimatı, e-posta alıcısının kesilmesini ve HookDesk kapalıyken olayın Java tarafında bekleyip daha sonra gönderilmesini ayrı Docker ortamında test ettim. Üç senaryo da yerelde ve GitHub Actions'ta geçti. Araç kiralamanın ana sürümünü koruyup entegrasyonu [ayrı dalda](https://github.com/Beratcan-Polat/arac-kiralama/tree/feature/hookdesk-integration) tuttum. Kurulum ve kullanım adımları [entegrasyon rehberinde](https://github.com/Beratcan-Polat/arac-kiralama/blob/feature/hookdesk-integration/docs/hookdesk-integration.md), kısa gösterim akışı [demo belgesinde](docs/portfolio-demo.md#reservation-integration).

## Testler

```sh
cd backend
php vendor/bin/pest
php vendor/bin/pint --test
php vendor/bin/phpstan analyse --memory-limit=512M

cd ../frontend
npm run lint
npm run test
npm run build
```

PostgreSQL ve Redis entegrasyon testleri ayrı test veritabanlarıyla çalıştırılmalıdır. Playwright senaryoları çalışan uygulama servislerini gerektirir. Ortam değişkenleri ve komutlar [test rehberinde](docs/runbooks/testing.md), mevcut sonuçlar [doğrulama notlarında](docs/verification.md) yer alıyor.

Kabul yanıt süresini, kuyruk/teslimat sürelerini ve worker sayısının etkisini ölçmek için ayrı bir Docker yük testi ekledim. Proje kökünde `node infra/performance/run.mjs` komutuyla çalışır; izole test ortamı oluşturup JSON/HTML raporlarını kaydeder. Senaryoları ve ölçüm sınırlarını [performans rehberinde](docs/runbooks/performance.md) açıkladım.

## Dokümantasyon

- [Mimari ve teslimat modeli](docs/architecture/overview.md)
- [Teknik kararlar](docs/decisions)
- [API kimlik doğrulaması](docs/api/authentication.md)
- [Uçtan uca demo akışı](docs/portfolio-demo.md)
- [Linux sunucusuna dağıtım, yedekleme ve geri yükleme](docs/runbooks/deployment.md)
- [Yayın öncesi kontroller](docs/runbooks/smoke-check.md)

Proje geliştirme aşamasında; canlı demo henüz yayınlanmadı. Üretim dağıtımı için alan adı, SMTP ve sunucu ayarları ayrıca yapılandırılmalıdır.

## Lisans

[MIT](LICENSE)

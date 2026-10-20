import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Webhook, ArrowLeft } from 'lucide-react'
import { LanguageSwitch } from '@/features/auth/Auth'
import { CopyText, JsonView } from '@/components/common'
const content = {
  en: {
    title: 'From event to delivery.',
    intro: 'Create a workspace, add a project and a destination, then publish your first event.',
    steps: [
      'Create an API key with events:write permission. Keep it on your server.',
      'Create an HTTPS endpoint or a controlled test receiver. Subscribe it to an event type or *.',
      'Publish a JSON event. A 202 response means the event is persisted, not that the destination has processed it.',
    ],
    idempotency:
      'Use Idempotency-Key for safe ingestion retries. Keys are scoped to the project and producer for 24 hours. The same key and exact body bytes return the same event. Different bytes return 409.',
    delivery:
      'HookDesk attempts delivery up to six times. Receivers must deduplicate by event ID. Delivery order is not guaranteed. A 2xx response acknowledges delivery.',
    signature:
      'Verify HMAC-SHA256 over timestamp + "." + the unmodified request body. Compare signatures in constant time and reject timestamps older than five minutes.',
    sources:
      'Incoming sources accept POST requests containing a JSON object. Capture-only sources store the request. Forwarding sources wrap it in the HookDesk envelope and apply project subscriptions.',
    errors:
      '400/422: invalid input · 401: invalid key · 403: blocked project or insufficient scope · 409: idempotency conflict · 413: payload too large · 415: JSON required · 429: usage limit · 503: ingestion paused.',
  },
  tr: {
    title: 'Olaydan teslimata.',
    intro: 'Çalışma alanı, proje ve hedef oluştur. Ardından ilk olayını gönder.',
    steps: [
      'events:write iznine sahip bir API anahtarı oluştur. Anahtarı sunucunda tut.',
      'HTTPS hedefi veya kontrollü test alıcısı ekle. Bir olay türüne ya da * ile bütün olaylara abone ol.',
      'JSON olayını gönder. 202 yanıtı, olayın kalıcı kaydedildiğini belirtir; hedefin işlemi tamamladığını belirtmez.',
    ],
    idempotency:
      'Güvenli kabul tekrarları için Idempotency-Key kullan. Anahtarlar proje ve üretici kapsamında 24 saat geçerlidir. Aynı anahtar ve aynı gövde baytları aynı olayı döndürür. Farklı gövde 409 döndürür.',
    delivery:
      'HookDesk en fazla altı deneme yapar. Alıcı olay kimliğine göre tekrarları tekilleştirmelidir. Teslim sırası garanti edilmez. 2xx yanıtı teslimatın kabul edildiğini belirtir.',
    signature:
      'Değiştirilmemiş gövde üzerinde timestamp + "." + body için HMAC-SHA256 doğrula. İmzayı sabit zamanlı karşılaştır ve beş dakikadan eski zaman damgalarını reddet.',
    sources:
      'Gelen kaynaklar JSON nesnesi içeren POST isteklerini kabul eder. Yalnızca kayıt modu isteği saklar. Yönlendirme modu içeriği HookDesk zarfına koyar ve proje aboneliklerini uygular.',
    errors:
      '400/422: geçersiz girdi · 401: geçersiz anahtar · 403: engelli proje veya yetersiz izin · 409: idempotency çakışması · 413: büyük gövde · 415: JSON gerekli · 429: kullanım limiti · 503: kabul duraklatılmış.',
  },
}
export default function Docs() {
  const { i18n, t } = useTranslation()
  const c = content[i18n.language === 'tr' ? 'tr' : 'en']
  return (
    <div className="docs-page">
      <header className="landing-header">
        <Link className="brand" to="/">
          <Webhook size={24} />
          HookDesk
        </Link>
        <LanguageSwitch />
      </header>
      <main>
        <Link className="text-link" to="/app">
          <ArrowLeft size={15} />
          {t('workspace')}
        </Link>
        <span className="eyebrow">QUICKSTART</span>
        <h1>{c.title}</h1>
        <p className="docs-intro">{c.intro}</p>
        <ol className="docs-steps">
          {c.steps.map((step, index) => (
            <li key={step}>
              <span>{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <section>
          <h2>POST /api/v1/events</h2>
          <CopyText
            value={
              'curl -X POST https://YOUR_DOMAIN/api/v1/events -H "Authorization: Bearer YOUR_API_KEY" -H "Content-Type: application/json" -H "Idempotency-Key: order-1042" -d \'{"type":"order.created","data":{"order_id":1042}}\''
            }
          />
          <JsonView value={{ type: 'order.created', data: { order_id: 1042 } }} />
        </section>
        <section>
          <h2>Idempotency</h2>
          <p>{c.idempotency}</p>
        </section>
        <section>
          <h2>{t('deliveries')}</h2>
          <p>{c.delivery}</p>
          <code>10s → 1m → 5m → 15m → 1h</code>
        </section>
        <section>
          <h2>HMAC-SHA256</h2>
          <p>{c.signature}</p>
          <JsonView
            value={
              'X-HookDesk-Event-Id\nX-HookDesk-Delivery-Id\nX-HookDesk-Attempt\nX-HookDesk-Timestamp\nX-HookDesk-Signature: v1=<hex>'
            }
          />
        </section>
        <section>
          <h2>{t('sources')}</h2>
          <p>{c.sources}</p>
        </section>
        <section>
          <h2>HTTP</h2>
          <p>{c.errors}</p>
        </section>
        <a href="/openapi.json">OpenAPI 3.1 JSON</a>
      </main>
    </div>
  )
}

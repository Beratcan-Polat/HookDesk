export function renderReport(report) {
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
    )
  const format = (value) =>
    typeof value === 'number' ? value.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '—'
  const maximum = Math.max(1, ...report.phases.map((phase) => phase.acceptance_ms.p95 || 0))
  const resources = report.resources.map((sample) =>
    sample.containers.reduce((sum, item) => sum + item.memory_bytes, 0),
  )
  const memory = resources.length ? Math.max(...resources) / 1024 ** 2 : null
  const rows = report.phases
    .map(
      (phase) =>
        `<tr><th scope="row">${escape(phase.name)}</th><td>${phase.workers}</td><td>${phase.accepted}/${phase.offered}</td><td>${format(phase.observed_request_rate_per_second)}</td><td>${format(phase.acceptance_ms.p95)}</td><td>${format(phase.acceptance_ms.p99)}</td><td>${format(phase.metrics.queue_ms.p95)}</td><td>${format(phase.metrics.http_ms.p95)}</td><td>${format(phase.metrics.delivery_ms.p95)}</td><td>${phase.passed ? 'Geçti' : 'Başarısız'}</td></tr>`,
    )
    .join('')
  return `<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HookDesk yük testi</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f6f7fb;color:#20283b;font:15px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:48px 24px}h1{font-size:30px;line-height:1.2;margin:8px 0 16px}h2{font-size:20px;margin:32px 0 12px}.tag{color:#375acd;font-weight:650}.meta{color:#596279}.facts{display:flex;flex-wrap:wrap;gap:32px;margin:28px 0;padding:20px 0;border-block:1px solid #dbe0ed}.facts strong{display:block;font-size:24px}.chart{max-width:760px}.bar{display:grid;grid-template-columns:175px 1fr 100px;gap:12px;align-items:center;margin:12px 0}.track{background:#e4e8f2;height:16px}.fill{height:100%;background:#4566da}.scroll{overflow:auto}table{border-collapse:collapse;min-width:1020px;width:100%;font-size:13px}th,td{text-align:right;padding:12px 8px;border-bottom:1px solid #dbe0ed}th:first-child{text-align:left}thead th{color:#596279;font-weight:600}code{overflow-wrap:anywhere}li{margin:6px 0}footer{margin-top:36px;border-top:1px solid #dbe0ed;padding-top:16px;color:#596279}@media(max-width:600px){main{padding:24px 16px}.bar{grid-template-columns:130px 1fr 80px;font-size:12px}}
  </style><main><span class="tag">HOOKDESK · YEREL DOCKER ÖLÇÜMÜ</span><h1>Webhook kabulü ve teslimat performansı</h1><p class="meta">${escape(report.started_at)} — ${escape(report.finished_at)} · ${escape(report.profile)} · Uygulama revizyonu <code>${escape(report.environment.revision)}</code></p>
  <div class="facts"><div>Sonuç<strong>${report.passed ? 'Geçti' : 'Başarısız'}</strong></div><div>Ölçülen aşama<strong>${report.phases.length}</strong></div><div>Örneklenen en yüksek toplam bellek<strong>${format(memory)} MiB</strong></div></div>
  <h2>API kabul yanıtı p95 (ms)</h2><p>Yatay uzunluk yanıt süresini, satırlar test aşamalarını gösterir. Daha kısa süre daha iyidir.</p><div class="chart">${report.phases.map((phase) => `<div class="bar"><span>${escape(phase.name)}</span><div class="track"><div class="fill" style="width:${((phase.acceptance_ms.p95 || 0) / maximum) * 100}%"></div></div><span>${format(phase.acceptance_ms.p95)} ms</span></div>`).join('')}</div>
  <h2>Aşama sonuçları</h2><div class="scroll"><table><thead><tr><th>Aşama</th><th>Worker</th><th>Kabul / İstek</th><th>İstek/sn</th><th>API p95 ms</th><th>API p99 ms</th><th>Kuyruk p95 ms*</th><th>HTTP p95 ms</th><th>Teslimat p95 ms*</th><th>Kontrol</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h2>Politika kontrolü</h2><p>${report.policy ? `${report.policy.accepted} kabul, ${report.policy.rate_limited} hız sınırı yanıtı; limit sonrası okuma HTTP ${report.policy.read_after_limit_status}.` : 'Politika kontrolü tamamlanmadı.'}</p>
  <h2>Ölçümün sınırları</h2><ul><li>Kaynak: gerçek HTTP istekleri, PostgreSQL teslimat/deneme kayıtları, imza doğrulayan test alıcısı ve 5 saniyelik Docker kaynak örnekleri.</li><li>* Kuyruk ve toplam teslimat süreleri veritabanındaki saniye çözünürlüklü zamanlardan hesaplanır. HTTP deneme ve istemci yanıt süreleri ayrı ölçülür.</li><li>İstek/sn, bu yük modelindeki gözlenen hızdır. Sürekli yük 5 istek/sn ile sınırlandırılır. Bunlar sunucunun azami kapasitesi veya üretim SLA değeri değildir.</li><li>Kapasite aşamalarında yalnızca test çalışma alanının kabul/günlük/teslimat limitleri yükseltilir. Varsayılan limitler ayrı sınanır.</li><li>Testler yerel Docker Desktop üzerinde çalışır. Normal geliştirme ortamının açık olması kaynakları paylaşır. Örneklenen bellek değeri anlık gerçek tepeyi garanti etmez.</li></ul>
  <p class="meta">Docker ${escape(report.environment.docker)} · PHP ${escape(report.environment.php)} · Node ${escape(report.environment.node)} · Docker VM ${format(report.environment.docker_cpu_count)} vCPU / ${format((report.environment.docker_memory_bytes || 0) / 1024 ** 3)} GiB · APP_DEBUG=false · Kod imaj içinde · Alıcı Caddy/PHP-FPM</p>
  ${report.errors.length ? `<h2>Notlar</h2><ul>${report.errors.map((error) => `<li>${escape(error)}</li>`).join('')}</ul>` : ''}<footer>Tekrar çalıştırma: <code>node infra/performance/run.mjs</code> · Bu rapor erişim anahtarı veya olay içeriği içermez.</footer></main></html>`
}

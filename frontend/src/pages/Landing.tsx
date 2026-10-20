import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Webhook,
  ArrowRight,
  Check,
  Database,
  Send,
  Activity,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from '@/features/auth/Auth'
export default function Landing() {
  const { t } = useTranslation()
  return (
    <div className="landing">
      <header className="landing-header">
        <Link className="brand" to="/">
          <Webhook size={26} />
          HookDesk
        </Link>
        <nav>
          <Link to="/docs">{t('docs')}</Link>
          <LanguageSwitch />
          <Link to="/sign-in">
            {t('login')}
            <ArrowUpRight size={14} />
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">{t('landingTag')}</span>
            <h1>{t('landingTitle')}</h1>
            <p>{t('landingDescription')}</p>
            <div className="hero-actions">
              <Button size="lg" asChild>
                <Link to="/sign-up">
                  {t('getStarted')}
                  <ArrowRight size={17} />
                </Link>
              </Button>
              <Link className="text-link" to="/docs">
                {t('readDocs')}
                <ArrowUpRight size={16} />
              </Link>
            </div>
          </div>
          <div className="delivery-flow" aria-label={t('landingFlow')}>
            {(
              [
                ['accept', Webhook],
                ['persist', Database],
                ['deliver', Send],
                ['observe', Activity],
              ] as const
            ).map(([label, Icon], index) => (
              <div className="flow-node" key={label}>
                <span className="flow-index">{String(index + 1).padStart(2, '0')}</span>
                <Icon size={23} />
                <strong>{t(label)}</strong>
                <Check size={16} />
              </div>
            ))}
            <div className="flow-caption">
              <ShieldCheck size={17} />
              {t('landingFlow')}
            </div>
          </div>
        </section>
        <section className="landing-features">
          <article>
            <span className="feature-symbol">
              <Activity size={25} />
            </span>
            <h2>{t('landingFeature1')}</h2>
            <p>{t('landingFeature1Body')}</p>
          </article>
          <article>
            <span className="feature-symbol">
              <Webhook size={25} />
            </span>
            <h2>{t('landingFeature2')}</h2>
            <p>{t('landingFeature2Body')}</p>
          </article>
        </section>
      </main>
      <footer className="landing-footer">
        <Link className="brand" to="/">
          <Webhook size={20} />
          HookDesk
        </Link>
        <span>{t('landingFooter')}</span>
        <a href="/openapi.json">
          OpenAPI
          <ArrowUpRight size={14} />
        </a>
      </footer>
    </div>
  )
}

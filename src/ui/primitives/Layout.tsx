import type { ReactNode } from 'react'

/** `accent` is one italic phrase appended to the title. Titles only: never in labels, tables or numbers. */
export function PageHeader({ title, accent, subtitle, actions }: { title: string; accent?: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page__head">
      <div>
        <h1>
          {title}
          {accent && (
            <>
              {' '}
              <span className="accent-phrase">{accent}</span>
            </>
          )}
        </h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions}
    </header>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  flush,
  className = '',
}: {
  title?: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <div className="card__head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={flush ? '' : 'card__body'}>{children}</div>
    </section>
  )
}

export interface TabDef<K extends string> {
  key: K
  label: string
  count?: number
}

export function Tabs<K extends string>({ tabs, value, onChange, label }: { tabs: TabDef<K>[]; value: K; onChange: (k: K) => void; label: string }) {
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t) => (
        <button key={t.key} role="tab" className="tab" aria-selected={value === t.key} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count !== undefined && <span className="tab__count num">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

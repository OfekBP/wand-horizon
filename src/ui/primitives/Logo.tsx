export const PRODUCT_NAME = 'Wand Horizon'
export const PRODUCT_LINE = 'One workforce. Full accountability.'

/** The Wand Horizon wordmark (transparent PNG, made for dark grounds). Pass `href` to make it a link. */
export function Logo({ href }: { href?: string }) {
  const img = <img className="logo__img" src="/wand-horizon-logo.png" alt={PRODUCT_NAME} width="865" height="314" />
  return href ? (
    <a className="logo" href={href} title="Back to the Wand Horizon introduction">
      {img}
    </a>
  ) : (
    <span className="logo">{img}</span>
  )
}

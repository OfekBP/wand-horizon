/**
 * Site-level configuration for the Wand Horizon website (landing page and System).
 * Values that are not known yet are configured here, never hard-coded in components.
 */

/**
 * Public GitHub repository. Set VITE_GITHUB_REPO_URL (in a `.env` file or the host's build settings) to the real
 * repository URL. Defaults to the project repository.
 */
export const GITHUB_REPO_URL: string = import.meta.env.VITE_GITHUB_REPO_URL || 'https://github.com/OfekBP/wand-horizon'

/**
 * Demo video. There is no video yet. When one exists, set VITE_DEMO_VIDEO_URL (or replace this constant) and the
 * "Demo video" links appear on the landing page and in the System top bar. While it is empty nothing renders.
 */
export const DEMO_VIDEO_URL: string = import.meta.env.VITE_DEMO_VIDEO_URL || ''

export const SITE_NAME = 'Wand Horizon'
export const SITE_TAGLINE = 'One workforce. Full accountability.'

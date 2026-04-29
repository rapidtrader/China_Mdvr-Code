/**
 * Backend base URL resolver (browser-safe):
 * - Default empty string → same-origin `/api/*` (works with nginx reverse-proxy)
 * - Optional `VITE_API_BASE_URL` override (must not break HTTPS pages)
 */

const rawBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')
    : '';

const getEffectiveBase = () => {
  if (!rawBase) return '';

  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && rawBase.startsWith('http://')) {
    // eslint-disable-next-line no-console
    console.warn(
      '[api] VITE_API_BASE_URL is http:// while page is https:// — using same-origin /api instead (fix your env to https:// or remove VITE_API_BASE_URL).'
    );
    return '';
  }

  return rawBase;
};

export const getApiBaseUrl = () => getEffectiveBase();

/** Kept for debugging; reflects effective base after scheme checks */
export const API_BASE_URL = getEffectiveBase();

export const apiUrl = (path) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getEffectiveBase()}${p}`;
};

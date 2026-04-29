/**
 * Backend base URL:
 * - Production: same-origin (/api...) — served via nginx reverse-proxy to Node
 * - Local dev (Vite): uses dev-server proxy (/api...) — see vite.config.js
 *
 * Rarely you may set `VITE_API_BASE_URL` to override (e.g. http://127.0.0.1:3001)
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const apiUrl = (path) => {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${p}`;
};

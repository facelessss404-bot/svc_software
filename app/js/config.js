// SVC Smart Move — Phase 1: Environment & Cloud Configuration
// Supports Localhost, Factory LAN, and Distributed Cloud (Netlify Frontend + Render Backend)

window.SVC_CONFIG = {
  // Set your default Render backend URL here if deploying Frontend on Netlify or opening locally:
  DEFAULT_RENDER_URL: 'https://svc-software.onrender.com',

  getBackendUrl() {
    // 1. Check user override in localStorage
    const saved = localStorage.getItem('SVC_RENDER_BACKEND_URL');
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
    // 2. If running directly on a server (Localhost, Factory LAN, or Cloud), use same-origin relative paths
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        if (!window.location.hostname.includes('netlify.app')) {
          return '';
        }
      }
    }
    // 3. Fallback for file:/// protocol or Netlify static hosting
    if (this.DEFAULT_RENDER_URL && this.DEFAULT_RENDER_URL.trim()) {
      return this.DEFAULT_RENDER_URL.trim().replace(/\/+$/, '');
    }
    return '';
  },

  setBackendUrl(url) {
    if (!url || !url.trim()) {
      localStorage.removeItem('SVC_RENDER_BACKEND_URL');
    } else {
      localStorage.setItem('SVC_RENDER_BACKEND_URL', url.trim().replace(/\/+$/, ''));
    }
    if (window.db) {
      window.db.checkServerConnection();
    }
  },

  apiUrl(path) {
    const base = this.getBackendUrl();
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return base ? `${base}${cleanPath}` : cleanPath;
  }
};

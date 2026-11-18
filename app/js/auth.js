// SVC Smart Move - Phase 1 Authentication & Role-Based Access Control

const SESSION_KEY = 'SVC_SmartMove_Session';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.token = localStorage.getItem('SVC_SmartMove_Token') || null;
  }

  async init() {
    await db.init();
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const session = JSON.parse(stored);
        this.currentUser = session;
      } catch (e) {
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }

  apiUrl(path) {
    if (typeof window !== 'undefined' && window.SVC_CONFIG && window.SVC_CONFIG.apiUrl) {
      return window.SVC_CONFIG.apiUrl(path);
    }
    return path;
  }

  getToken() {
    return this.token || localStorage.getItem('SVC_SmartMove_Token') || '';
  }

  async login(username, pin) {
    if (!username || !pin) {
      throw new Error('Username and Password/PIN are required.');
    }

    // 1. Try Central Server Authentication
    if (window.db && window.db.isServerConnected) {
      const res = await fetch(this.apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Server login failed.');
      }
      this.token = data.token;
      this.currentUser = {
        id: data.user.id,
        username: data.user.username,
        name: data.user.fullName || data.user.name,
        role: data.user.role
      };
      localStorage.setItem('SVC_SmartMove_Token', data.token);
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.currentUser));
      return this.currentUser;
    }

    // 2. Standalone Offline Fallback
    const cleanUser = username.trim().toLowerCase();
    const user = db.users.find(u => u.username.toLowerCase() === cleanUser);
    
    if (!user || !user.active) {
      throw new Error('Invalid credentials or inactive user account.');
    }

    if (user.pin !== pin.trim()) {
      throw new Error('Incorrect Password / PIN.');
    }

    this.currentUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify({
      username: user.username,
      name: user.name,
      role: user.role,
      loginTime: new Date().toISOString()
    }));

    db._addAuditLog('LOGIN', user.username, `User logged in with role: ${user.role} (Standalone Mode)`, user.username);
    db.persist();
    return this.currentUser;
  }

  async logout() {
    if (window.db && window.db.isServerConnected && this.token) {
      await fetch(this.apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` }
      }).catch(() => {});
    }
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem('SVC_SmartMove_Token');
    localStorage.removeItem(SESSION_KEY);
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  getUser() {
    return this.currentUser;
  }

  hasRole(allowedRoles) {
    if (!this.currentUser) return false;
    if (this.currentUser.role === 'Admin') return true;
    return allowedRoles.includes(this.currentUser.role);
  }
}

const auth = new AuthManager();
if (typeof window !== 'undefined') {
  window.auth = auth;
}

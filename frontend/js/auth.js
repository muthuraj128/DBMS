// Authentication state management
const Auth = {
  _user: null,
  _token: null,
  _listeners: [],

  init() {
    const stored = localStorage.getItem('canteen_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this._token = parsed.token;
        this._user = parsed.user;
      } catch { /* ignore */ }
    }
  },

  getToken() { return this._token; },
  getUser() { return this._user; },
  isLoggedIn() { return !!this._token; },
  isAdmin() {
    return this._user && this._user.role && this._user.role.toUpperCase() === 'ADMIN';
  },

  login(user, token) {
    this._user = user;
    this._token = token;
    localStorage.setItem('canteen_auth', JSON.stringify({ user, token }));
    this._notify();
  },

  logout() {
    this._user = null;
    this._token = null;
    localStorage.removeItem('canteen_auth');
    Cart.clear();
    this._notify();
  },

  onChange(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => fn()); },
};

Auth.init();

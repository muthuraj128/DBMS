// Simple hash-based router
const Router = {
  _routes: {},
  _current: null,

  register(hash, renderFn) {
    this._routes[hash] = renderFn;
  },

  navigate(hash) {
    window.location.hash = hash;
  },

  getCurrentHash() {
    return window.location.hash.slice(1) || 'menu';
  },

  async resolve() {
    const hash = this.getCurrentHash();
    if (hash === this._current) return;
    this._current = hash;

    // Auth guards
    const publicPages = ['login', 'register', 'menu'];
    const adminPages = ['admin', 'admin-dishes', 'admin-orders'];

    if (!publicPages.includes(hash) && !Auth.isLoggedIn()) {
      this.navigate('login');
      return;
    }

    if (adminPages.includes(hash) && !Auth.isAdmin()) {
      this.navigate('menu');
      return;
    }

    const renderFn = this._routes[hash];
    if (renderFn) {
      document.getElementById('app').innerHTML = '<div class="spinner"></div>';
      await renderFn();
    } else {
      this.navigate('menu');
    }
    Navbar.render();
  },

  init() {
    window.addEventListener('hashchange', () => {
      this._current = null;
      this.resolve();
    });
    if (!window.location.hash) window.location.hash = '#menu';
    this.resolve();
  },
};

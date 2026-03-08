// Toast helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3500);
}

// Format cents to currency string
function formatPrice(cents) {
  return '\u20B9' + (cents / 100).toFixed(2);
}

// Format minutes (0-1439) to HH:MM AM/PM
function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return h12 + ':' + String(m).padStart(2, '0') + ' ' + suffix;
}

// Format ISO date string
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Navbar component
const Navbar = {
  render() {
    const nav = document.getElementById('navbar');
    const user = Auth.getUser();
    const hash = Router.getCurrentHash();
    const cartCount = Cart.getCount();

    let links = '';

    if (!Auth.isLoggedIn()) {
      links = `
        <a href="#menu" class="${hash === 'menu' ? 'nav-active' : ''}">Menu</a>
        <a href="#login" class="${hash === 'login' ? 'nav-active' : ''}">Login</a>
        <a href="#register" class="${hash === 'register' ? 'nav-active' : ''}">Register</a>
      `;
    } else if (Auth.isAdmin()) {
      links = `
        <a href="#admin" class="${hash === 'admin' ? 'nav-active' : ''}">Dashboard</a>
        <a href="#admin-dishes" class="${hash === 'admin-dishes' ? 'nav-active' : ''}">Dishes</a>
        <a href="#admin-orders" class="${hash === 'admin-orders' ? 'nav-active' : ''}">Orders</a>
        <a href="#admin-customers" class="${hash === 'admin-customers' ? 'nav-active' : ''}">Customers</a>
        <a href="#admin-revenue" class="${hash === 'admin-revenue' ? 'nav-active' : ''}">Revenue</a>
        <button onclick="Auth.logout(); Router.navigate('login');">Logout</button>
      `;
    } else {
      links = `
        <a href="#menu" class="${hash === 'menu' ? 'nav-active' : ''}">Menu</a>
        <a href="#checkout" class="${hash === 'checkout' ? 'nav-active' : ''}">Cart${cartCount > 0 ? '<span class="nav-cart-badge">' + cartCount + '</span>' : ''}</a>
        <a href="#orders" class="${hash === 'orders' ? 'nav-active' : ''}">My Orders</a>
        <button onclick="Auth.logout(); Router.navigate('login');">Logout</button>
      `;
    }

    nav.innerHTML = `
      <div class="navbar-brand" onclick="Router.navigate('${Auth.isAdmin() ? 'admin' : 'menu'}')">
        🍽 Canteen<span>Pro</span>
      </div>
      <div class="navbar-links">${links}</div>
    `;
  },
};

// Re-render navbar when cart changes
Cart.onChange(() => Navbar.render());

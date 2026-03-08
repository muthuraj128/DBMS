// Menu Page — lists active dishes
Router.register('menu', async function renderMenu() {
  const app = document.getElementById('app');
  try {
    const dishes = await Api.get('/dishes');
    if (!dishes.length) {
      app.innerHTML = `
        <div class="page-header">
          <h1>Today's Menu</h1>
          <p>Browse and add dishes to your cart</p>
        </div>
        <div class="empty-state">
          <h3>No dishes available right now</h3>
          <p>Check back later for today's menu.</p>
        </div>
      `;
      return;
    }

    app.innerHTML = `
      <div class="page-header">
        <h1>Today's Menu</h1>
        <p>Browse and add dishes to your cart</p>
      </div>
      <div class="grid-3" id="menu-grid"></div>
    `;

    const grid = document.getElementById('menu-grid');
    dishes.forEach(dish => {
      const imgHtml = dish.photo_url
        ? `<img class="dish-card-img" src="${CONFIG.API_BASE.replace('/api', '')}${dish.photo_url}" alt="${dish.name}" />`
        : `<div class="dish-card-img-placeholder">🍽</div>`;

      const card = document.createElement('div');
      card.className = 'card dish-card';
      card.innerHTML = `
        ${imgHtml}
        <div class="dish-card-body">
          <div class="dish-card-name">${dish.name}</div>
          <div class="dish-card-desc">${dish.description || 'No description'}</div>
          <div class="dish-card-meta">
            <span class="dish-card-price">${formatPrice(dish.price_cents)}</span>
            <span class="dish-card-avail">${dish.available_quantity} left</span>
          </div>
          <div class="dish-card-time">Available: ${formatTime(dish.available_from_minutes)} – ${formatTime(dish.available_to_minutes)}</div>
          <div class="dish-card-actions">
            <div class="qty-control">
              <button data-action="dec" data-id="${dish.id}">−</button>
              <span id="qty-${dish.id}">1</span>
              <button data-action="inc" data-id="${dish.id}">+</button>
            </div>
            <button class="btn btn-accent btn-sm" data-add="${dish.id}">Add to Cart</button>
          </div>
        </div>
      `;
      grid.appendChild(card);

      // Quantity controls
      card.querySelector('[data-action="dec"]').addEventListener('click', () => {
        const span = document.getElementById('qty-' + dish.id);
        let v = Number.parseInt(span.textContent, 10);
        if (v > 1) span.textContent = --v;
      });
      card.querySelector('[data-action="inc"]').addEventListener('click', () => {
        const span = document.getElementById('qty-' + dish.id);
        let v = Number.parseInt(span.textContent, 10);
        if (v < dish.available_quantity) span.textContent = ++v;
      });
      card.querySelector('[data-add]').addEventListener('click', () => {
        if (!Auth.isLoggedIn()) {
          showToast('Please login to add items to cart', 'error');
          Router.navigate('login');
          return;
        }
        const qty = Number.parseInt(document.getElementById('qty-' + dish.id).textContent, 10);
        Cart.add(dish, qty);
        showToast(dish.name + ' added to cart', 'success');
      });
    });
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><h3>Failed to load menu</h3><p>${err.message}</p></div>`;
  }
});

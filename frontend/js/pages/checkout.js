// Checkout Page — review cart & place order
Router.register('checkout', async function renderCheckout() {
  const app = document.getElementById('app');
  const items = Cart.getItems();

  if (items.length === 0) {
    app.innerHTML = `
      <div class="page-header">
        <h1>Your Cart</h1>
      </div>
      <div class="empty-state">
        <h3>Your cart is empty</h3>
        <p>Browse the <a href="#menu">menu</a> to add items.</p>
      </div>
    `;
    return;
  }

  function render() {
    const cartItems = Cart.getItems();
    if (cartItems.length === 0) {
      Router.navigate('menu');
      return;
    }

    app.innerHTML = `
      <div class="page-header">
        <h1>Checkout</h1>
        <p>Review your order and select a pickup time</p>
      </div>
      <div class="checkout-layout">
        <div>
          <div class="card">
            <div class="card-body">
              <h3 style="margin-bottom: 1rem; font-weight: 700;">Order Items</h3>
              <div id="checkout-items"></div>
            </div>
          </div>
          <div class="card" style="margin-top: 1.5rem;">
            <div class="card-body">
              <h3 style="margin-bottom: 1rem; font-weight: 700;">Pickup Details</h3>
              <div class="form-group">
                <label for="pickup-time">Pickup Time</label>
                <input type="datetime-local" id="pickup-time" class="form-control" required />
                <small style="color: var(--text-light); font-size: 0.8rem;">Must be at least 30 minutes from now. Same-day orders only.</small>
              </div>
            </div>
          </div>
        </div>
        <div class="cart-summary">
          <h3>Order Summary</h3>
          <div id="summary-items"></div>
          <div class="cart-total">
            <span>Total</span>
            <span id="summary-total"></span>
          </div>
          <button class="btn btn-accent btn-block btn-lg" style="margin-top: 1rem;" id="place-order-btn">Place Order</button>
        </div>
      </div>
    `;

    // Set minimum pickup time (30 mins from now) and maximum to end of today
    const minDate = new Date(Date.now() + 31 * 60 * 1000);
    const minStr = minDate.toISOString().slice(0, 16);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 0, 0);
    const maxStr = endOfToday.toISOString().slice(0, 16);
    const pickupInput = document.getElementById('pickup-time');
    pickupInput.min = minStr;
    pickupInput.max = maxStr;
    pickupInput.value = minStr;

    // Render items
    const itemsContainer = document.getElementById('checkout-items');
    const summaryContainer = document.getElementById('summary-items');

    cartItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <div>
          <div class="cart-item-name">${item.dish.name}</div>
          <div class="cart-item-qty">
            <div class="qty-control" style="display: inline-flex; margin-top: 0.3rem;">
              <button data-cdec="${item.dish.id}">−</button>
              <span>${item.quantity}</span>
              <button data-cinc="${item.dish.id}">+</button>
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span class="cart-item-price">${formatPrice(item.dish.price_cents * item.quantity)}</span>
          <button class="cart-item-remove" data-cremove="${item.dish.id}">✕</button>
        </div>
      `;
      itemsContainer.appendChild(row);

      row.querySelector('[data-cdec]').addEventListener('click', () => {
        Cart.updateQty(item.dish.id, item.quantity - 1);
        render();
      });
      row.querySelector('[data-cinc]').addEventListener('click', () => {
        Cart.updateQty(item.dish.id, item.quantity + 1);
        render();
      });
      row.querySelector('[data-cremove]').addEventListener('click', () => {
        Cart.remove(item.dish.id);
        render();
      });

      const summaryRow = document.createElement('div');
      summaryRow.className = 'cart-item';
      summaryRow.innerHTML = `
        <span>${item.dish.name} × ${item.quantity}</span>
        <span class="cart-item-price">${formatPrice(item.dish.price_cents * item.quantity)}</span>
      `;
      summaryContainer.appendChild(summaryRow);
    });

    document.getElementById('summary-total').textContent = formatPrice(Cart.getTotal());

    // Place order handler
    document.getElementById('place-order-btn').addEventListener('click', async () => {
      const pickupTime = document.getElementById('pickup-time').value;
      if (!pickupTime) {
        showToast('Please select a pickup time', 'error');
        return;
      }

      const btn = document.getElementById('place-order-btn');
      btn.disabled = true;
      btn.textContent = 'Placing order...';

      try {
        const orderItems = Cart.getItems().map(i => ({
          dishId: i.dish.id,
          quantity: i.quantity,
        }));
        const data = await Api.post('/orders', {
          items: orderItems,
          pickup_time: new Date(pickupTime).toISOString(),
        });
        Cart.clear();
        showToast('Order placed successfully! #' + (data.order.order_number || ''), 'success');
        Router.navigate('orders');
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Place Order';
      }
    });
  }

  render();
});

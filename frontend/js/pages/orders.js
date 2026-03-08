// My Orders Page
Router.register('orders', async function renderOrders() {
  const app = document.getElementById('app');
  try {
    const orders = await Api.get('/orders');

    app.innerHTML = `
      <div class="page-header">
        <h1>My Orders</h1>
        <p>Track your order history and status</p>
      </div>
      <div id="orders-list"></div>
    `;

    const list = document.getElementById('orders-list');

    if (!orders.length) {
      list.innerHTML = `
        <div class="empty-state">
          <h3>No orders yet</h3>
          <p>Visit the <a href="#menu">menu</a> to place your first order!</p>
        </div>
      `;
      return;
    }

    orders.forEach(order => {
      const statusClass = order.status.toLowerCase();
      const payClass = order.payment_status.toLowerCase();

      const card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML = `
        <div class="order-card-header">
          <div>
            <span class="order-number">#${order.order_number}</span>
            <span class="order-date" style="margin-left: 0.75rem;">${formatDate(order.created_at)}</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <span class="badge badge-${statusClass}">${order.status}</span>
            <span class="badge badge-${payClass}">${order.payment_status}</span>
          </div>
        </div>
        <div class="order-items-list">
          ${(order.items || []).map(it => `
            <div class="order-item-row">
              <span>${it.dish_name} × ${it.quantity}</span>
              <span>${formatPrice(it.unit_price_cents * it.quantity)}</span>
            </div>
          `).join('')}
        </div>
        <div class="order-footer">
          <span class="order-total">Total: ${formatPrice(order.total_cents)}</span>
          <span class="order-date">Pickup: ${formatDate(order.pickup_time)}</span>
        </div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><h3>Failed to load orders</h3><p>${err.message}</p></div>`;
  }
});

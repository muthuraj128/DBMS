// Admin Orders Management Page
Router.register('admin-orders', async function renderAdminOrders() {
  const app = document.getElementById('app');

  async function loadOrders() {
    try {
      const orders = await Api.get('/orders/admin/all');

      app.innerHTML = `
        <div class="page-header">
          <h1>Manage Orders</h1>
          <p>View and manage all customer orders</p>
        </div>
        <div id="admin-orders-list"></div>
      `;

      const list = document.getElementById('admin-orders-list');

      if (!orders.length) {
        list.innerHTML = `
          <div class="empty-state">
            <h3>No orders yet</h3>
            <p>Orders will appear here when customers place them.</p>
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
              <span style="color: var(--text-light); font-size: 0.85rem; margin-left: 0.5rem;">${order.user_name || ''} (${order.user_email}${order.user_phone ? ' · ' + order.user_phone : ''})</span>
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
            <div>
              <span class="order-total">Total: ${formatPrice(order.total_cents)}</span>
              <span class="order-date" style="margin-left: 1rem;">Pickup: ${formatDate(order.pickup_time)}</span>
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;" id="actions-${order.id}"></div>
          </div>
        `;
        list.appendChild(card);

        // Action buttons
        const actions = card.querySelector('#actions-' + order.id);

        if (order.status === 'PENDING') {
          const finishBtn = document.createElement('button');
          finishBtn.className = 'btn btn-success btn-sm';
          finishBtn.textContent = 'Mark Finished';
          finishBtn.addEventListener('click', async () => {
            try {
              await Api.patch('/orders/' + order.id + '/status', { status: 'FINISHED' });
              showToast('Order marked as finished', 'success');
              loadOrders();
            } catch (e) { showToast(e.message, 'error'); }
          });
          actions.appendChild(finishBtn);

          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'btn btn-danger btn-sm';
          cancelBtn.textContent = 'Cancel';
          cancelBtn.addEventListener('click', async () => {
            if (!confirm('Cancel this order? Dish quantities will be restored.')) return;
            try {
              await Api.patch('/orders/' + order.id + '/status', { status: 'CANCELLED' });
              showToast('Order cancelled', 'success');
              loadOrders();
            } catch (e) { showToast(e.message, 'error'); }
          });
          actions.appendChild(cancelBtn);
        }

        if (order.payment_status === 'PENDING') {
          const payBtn = document.createElement('button');
          payBtn.className = 'btn btn-primary btn-sm';
          payBtn.textContent = 'Mark Paid';
          payBtn.addEventListener('click', async () => {
            try {
              await Api.patch('/orders/' + order.id + '/payment', { payment_status: 'PAID', payment_method: 'cash' });
              showToast('Payment recorded', 'success');
              loadOrders();
            } catch (e) { showToast(e.message, 'error'); }
          });
          actions.appendChild(payBtn);
        }
      });
    } catch (err) {
      app.innerHTML = `<div class="empty-state"><h3>Failed to load orders</h3><p>${err.message}</p></div>`;
    }
  }

  await loadOrders();
});

// Admin Customers Page
Router.register('admin-customers', async function renderAdminCustomers() {
  const app = document.getElementById('app');

  async function loadCustomers() {
    try {
      const customers = await Api.get('/auth/admin/customers');

      app.innerHTML = `
        <div class="page-header">
          <h1>Customers</h1>
          <p>Registered customer accounts and their order history</p>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Joined</th>
                <th>Orders</th>
                <th>Total Spent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customers-tbody"></tbody>
          </table>
        </div>
        <div id="customer-modal-root"></div>
      `;

      const tbody = document.getElementById('customers-tbody');

      if (!customers.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; color: var(--text-light); padding: 2rem;">
              No customers registered yet.
            </td>
          </tr>
        `;
        return;
      }

      customers.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${c.name || '<em style="color:var(--text-light)">—</em>'}</strong></td>
          <td>${c.email}</td>
          <td>${c.phone || '<em style="color:var(--text-light)">—</em>'}</td>
          <td>${formatDate(c.created_at)}</td>
          <td style="text-align:center;">${c.order_count}</td>
          <td>${formatPrice(c.total_spent_cents)}</td>
          <td>
            <button class="btn btn-outline btn-sm" data-view="${c.id}">View Orders</button>
          </td>
        `;
        tbody.appendChild(tr);

        tr.querySelector('[data-view]').addEventListener('click', () => openCustomerModal(c));
      });
    } catch (err) {
      app.innerHTML = `<div class="empty-state"><h3>Failed to load customers</h3><p>${err.message}</p></div>`;
    }
  }

  async function openCustomerModal(customer) {
    const root = document.getElementById('customer-modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="customer-modal-overlay">
        <div class="modal" style="max-width: 640px; width: 95%;">
          <div class="modal-header">
            <h2>Customer Details</h2>
            <button class="modal-close" id="close-customer-modal">&times;</button>
          </div>
          <div class="modal-body">
            <dl class="customer-dl">
              <dt>Name</dt>       <dd>${customer.name || '—'}</dd>
              <dt>Email</dt>      <dd>${customer.email}</dd>
              <dt>Phone</dt>      <dd>${customer.phone || '—'}</dd>
              <dt>Joined</dt>     <dd>${formatDate(customer.created_at)}</dd>
              <dt>Orders</dt>     <dd>${customer.order_count}</dd>
              <dt>Total Spent</dt><dd>${formatPrice(customer.total_spent_cents)}</dd>
            </dl>
            <hr style="margin: 1.25rem 0;" />
            <h3 style="font-weight:700; margin-bottom:0.75rem;">Order History</h3>
            <div id="customer-orders-body">
              <p style="color:var(--text-light);">Loading…</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-customer-modal').addEventListener('click', () => { root.innerHTML = ''; });
    document.getElementById('customer-modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('customer-modal-overlay')) root.innerHTML = '';
    });

    // Load orders for this customer from the admin orders list
    try {
      const allOrders = await Api.get('/orders/admin/all');
      const orders = allOrders.filter(o => o.user_id === customer.id);
      const orderBody = document.getElementById('customer-orders-body');

      if (!orders.length) {
        orderBody.innerHTML = '<p style="color:var(--text-light);">No orders placed yet.</p>';
        return;
      }

      orderBody.innerHTML = orders.map(o => `
        <div style="border:1px solid var(--border); border-radius:8px; padding:0.75rem 1rem; margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <strong>#${o.order_number}</strong>
              <span style="font-size:0.82rem; color:var(--text-light); margin-left:0.5rem;">${formatDate(o.created_at)}</span>
            </div>
            <div style="display:flex; gap:0.4rem;">
              <span class="badge badge-${o.status.toLowerCase()}">${o.status}</span>
              <span class="badge badge-${o.payment_status.toLowerCase()}">${o.payment_status}</span>
            </div>
          </div>
          <ul style="margin:0.5rem 0 0 0; padding-left:1.1rem; font-size:0.9rem;">
            ${(o.items || []).map(it => `<li>${it.dish_name} × ${it.quantity} — ${formatPrice(it.unit_price_cents * it.quantity)}</li>`).join('')}
          </ul>
          <div style="text-align:right; font-weight:700; margin-top:0.35rem;">
            Total: ${formatPrice(o.total_cents)}
          </div>
        </div>
      `).join('');
    } catch (e) {
      const orderBody = document.getElementById('customer-orders-body');
      if (orderBody) orderBody.innerHTML = `<p style="color:var(--text-light);">Could not load orders: ${e.message}</p>`;
    }
  }

  loadCustomers();
});

// Admin Dashboard Page
Router.register('admin', async function renderAdminDashboard() {
  const app = document.getElementById('app');
  try {
    const [dishes, orders] = await Promise.all([
      Api.get('/dishes/admin'),
      Api.get('/orders/admin/all'),
    ]);

    // Today's date boundaries (local)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d >= todayStart && d <= todayEnd;
    });

    const totalDishes = dishes.length;
    const activeDishes = dishes.filter(d => d.is_active).length;
    const totalOrders = todayOrders.length;
    const pendingOrders = todayOrders.filter(o => o.status === 'PENDING').length;
    const finishedOrders = todayOrders.filter(o => o.status === 'FINISHED').length;
    const totalRevenue = todayOrders
      .filter(o => o.payment_status === 'PAID')
      .reduce((s, o) => s + o.total_cents, 0);

    app.innerHTML = `
      <div class="page-header">
        <h1>Admin Dashboard</h1>
        <p>Overview of canteen operations</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalDishes}</div>
          <div class="stat-label">Total Dishes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeDishes}</div>
          <div class="stat-label">Active Dishes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalOrders}</div>
          <div class="stat-label">Today's Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${pendingOrders}</div>
          <div class="stat-label">Pending Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${finishedOrders}</div>
          <div class="stat-label">Completed Today</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatPrice(totalRevenue)}</div>
          <div class="stat-label">Today's Revenue (Paid)</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-body">
            <h3 style="font-weight: 700; margin-bottom: 1rem;">Today's Orders</h3>
            ${todayOrders.slice(0, 5).map(o => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border);">
                <div>
                  <strong>#${o.order_number}</strong>
                  <span style="color: var(--text-light); font-size: 0.8rem; margin-left: 0.5rem;">${o.user_name || o.user_email}</span>
                </div>
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <span class="badge badge-${o.status.toLowerCase()}">${o.status}</span>
                  <span style="font-weight: 600;">${formatPrice(o.total_cents)}</span>
                </div>
              </div>
            `).join('') || '<p style="color: var(--text-light);">No orders today yet</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-body">
            <h3 style="font-weight: 700; margin-bottom: 1rem;">Quick Actions</h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <button class="btn btn-primary btn-block" onclick="Router.navigate('admin-dishes')">Manage Dishes</button>
              <button class="btn btn-accent btn-block" onclick="Router.navigate('admin-orders')">Manage Orders</button>
              <button class="btn btn-outline btn-block" onclick="Router.navigate('admin-customers')">View Customers</button>
              <button class="btn btn-outline btn-block" onclick="Router.navigate('admin-revenue')">Revenue Analysis</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3><p>${err.message}</p></div>`;
  }
});

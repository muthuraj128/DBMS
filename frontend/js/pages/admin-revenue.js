// Admin Revenue Analysis Page
Router.register('admin-revenue', async function renderAdminRevenue() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="page-header">
      <h1>Revenue Analysis</h1>
      <p>Sales performance and financial overview</p>
    </div>
    <div id="revenue-root"><p style="color:var(--text-light); padding:2rem 0;">Loading…</p></div>
  `;

  try {
    const data = await Api.get('/orders/admin/revenue');
    const { summary, daily, top_dishes, payment_methods } = data;
    const root = document.getElementById('revenue-root');

    // ── Summary stat cards ───────────────────────────────────────────
    const summaryHtml = `
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-bottom: 2rem;">
        <div class="stat-card">
          <div class="stat-value">${formatPrice(summary.total_revenue_cents)}</div>
          <div class="stat-label">Total Revenue (Paid)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatPrice(summary.today_revenue_cents)}</div>
          <div class="stat-label">Today's Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.total_orders}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.avg_order_cents ? formatPrice(summary.avg_order_cents) : '—'}</div>
          <div class="stat-label">Avg Order Value (Paid)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--warning);">${summary.pending_payment_orders}</div>
          <div class="stat-label">Pending Payments</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--danger);">${summary.cancelled_orders}</div>
          <div class="stat-label">Cancelled Orders</div>
        </div>
      </div>
    `;

    // ── Daily revenue bar chart (last 30 days) ───────────────────────
    const maxDaily = Math.max(...daily.map(d => d.revenue_cents), 1);
    const dailyBars = daily.length
      ? daily.map(d => `
          <div class="rev-bar-row">
            <span class="rev-bar-label">${d.day}</span>
            <div class="rev-bar-track">
              <div class="rev-bar-fill" style="width:${Math.round(d.revenue_cents / maxDaily * 100)}%"></div>
            </div>
            <span class="rev-bar-value">${formatPrice(d.revenue_cents)}</span>
            <span class="rev-bar-orders">${d.orders} order${d.orders !== 1 ? 's' : ''}</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-light); text-align:center; padding:1rem 0;">No orders in the last 30 days.</p>';

    const dailyHtml = `
      <div class="card" style="margin-bottom:2rem;">
        <div class="card-body">
          <h3 style="font-weight:700; margin-bottom:1rem;">Daily Revenue — Last 30 Days</h3>
          <div style="display:flex; justify-content:flex-end; gap:0; font-size:0.78rem; color:var(--text-light); margin-bottom:0.25rem; padding-right:0;">
            <span style="width:90px; text-align:right; flex-shrink:0;">Date</span>
            <span style="flex:1; margin-left:0.75rem;"></span>
            <span style="width:80px; text-align:right; flex-shrink:0;">Amount</span>
            <span style="width:62px; text-align:center; flex-shrink:0;">Orders</span>
          </div>
          <div class="rev-chart">${dailyBars}</div>
        </div>
      </div>
    `;

    // ── Top dishes ───────────────────────────────────────────────────
    const maxDish = Math.max(...top_dishes.map(d => d.revenue_cents), 1);
    const dishBars = top_dishes.length
      ? top_dishes.map(d => `
          <div class="rev-bar-row">
            <span class="rev-bar-label" style="width:130px;" title="${d.dish_name}">${d.dish_name}</span>
            <div class="rev-bar-track">
              <div class="rev-bar-fill accent" style="width:${Math.round(d.revenue_cents / maxDish * 100)}%"></div>
            </div>
            <span class="rev-bar-value">${formatPrice(d.revenue_cents)}</span>
            <span class="rev-bar-orders">${d.total_qty} sold</span>
          </div>
        `).join('')
      : '<p style="color:var(--text-light); text-align:center; padding:1rem 0;">No paid orders yet.</p>';

    // ── Order status breakdown ───────────────────────────────────────
    const statusRows = [
      ['PENDING',   summary.pending_orders,   'var(--warning)'],
      ['FINISHED',  summary.finished_orders,  'var(--success)'],
      ['CANCELLED', summary.cancelled_orders, 'var(--danger)'],
    ].map(([label, count, color]) => {
      const pct = summary.total_orders ? Math.round(count / summary.total_orders * 100) : 0;
      return `
        <div style="margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:4px;">
            <span style="font-weight:600;">${label}</span>
            <span style="color:var(--text-light);">${count} &nbsp;(${pct}%)</span>
          </div>
          <div class="rev-bar-track">
            <div class="rev-bar-fill" style="width:${pct}%; background:${color};"></div>
          </div>
        </div>
      `;
    }).join('');

    // ── Payment methods table ────────────────────────────────────────
    const pmRows = payment_methods.map(pm => `
      <tr>
        <td>${pm.method}</td>
        <td style="text-align:center;">${pm.orders}</td>
        <td style="text-align:right; font-weight:600;">${formatPrice(pm.revenue_cents)}</td>
      </tr>
    `).join('') || `<tr><td colspan="3" style="color:var(--text-light); text-align:center; padding:1rem;">No data</td></tr>`;

    root.innerHTML = `
      ${summaryHtml}
      ${dailyHtml}
      <div class="grid-2">
        <div class="card">
          <div class="card-body">
            <h3 style="font-weight:700; margin-bottom:1rem;">Top 10 Dishes by Revenue (Paid)</h3>
            <div style="display:flex; font-size:0.78rem; color:var(--text-light); margin-bottom:0.25rem;">
              <span style="width:130px; flex-shrink:0; text-align:right;">Dish</span>
              <span style="flex:1; margin-left:0.75rem;"></span>
              <span style="width:80px; text-align:right; flex-shrink:0;">Revenue</span>
              <span style="width:62px; text-align:center; flex-shrink:0;">Qty</span>
            </div>
            <div class="rev-chart">${dishBars}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:1.5rem;">
          <div class="card">
            <div class="card-body">
              <h3 style="font-weight:700; margin-bottom:1rem;">Order Status</h3>
              ${statusRows}
            </div>
          </div>
          <div class="card">
            <div class="card-body">
              <h3 style="font-weight:700; margin-bottom:1rem;">Payment Methods</h3>
              <table class="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th style="text-align:center;">Orders</th>
                    <th style="text-align:right;">Revenue</th>
                  </tr>
                </thead>
                <tbody>${pmRows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    const root = document.getElementById('revenue-root');
    if (root) root.innerHTML = `<div class="empty-state"><h3>Failed to load revenue data</h3><p>${err.message}</p></div>`;
  }
});

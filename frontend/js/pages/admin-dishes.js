// Admin Dishes Management Page
Router.register('admin-dishes', async function renderAdminDishes() {
  const app = document.getElementById('app');

  async function loadDishes() {
    try {
      const dishes = await Api.get('/dishes/admin');

      app.innerHTML = `
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1>Manage Dishes</h1>
            <p>Add, edit, and manage menu items</p>
          </div>
          <button class="btn btn-accent" id="add-dish-btn">+ Add Dish</button>
        </div>
        <div class="table-wrapper">
          <table class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Availability</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="dishes-tbody"></tbody>
          </table>
        </div>
        <div id="dish-modal-root"></div>
      `;

      const tbody = document.getElementById('dishes-tbody');

      if (!dishes.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-light); padding: 2rem;">No dishes yet. Click "Add Dish" to get started.</td></tr>';
      } else {
        dishes.forEach(dish => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${dish.name}</strong></td>
            <td>${formatPrice(dish.price_cents)}</td>
            <td>${dish.available_quantity}</td>
            <td>${formatTime(dish.available_from_minutes)} – ${formatTime(dish.available_to_minutes)}</td>
            <td><span class="badge ${dish.is_active ? 'badge-finished' : 'badge-cancelled'}">${dish.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
              <button class="btn btn-outline btn-sm" data-edit="${dish.id}">Edit</button>
              ${dish.is_active ? `<button class="btn btn-danger btn-sm" data-deactivate="${dish.id}" style="margin-left:0.25rem;">Deactivate</button>` : ''}
            </td>
          `;
          tbody.appendChild(tr);

          const editBtn = tr.querySelector('[data-edit]');
          if (editBtn) editBtn.addEventListener('click', () => openDishModal(dish));

          const deactBtn = tr.querySelector('[data-deactivate]');
          if (deactBtn) deactBtn.addEventListener('click', async () => {
            try {
              await Api.delete('/dishes/' + dish.id);
              showToast(dish.name + ' deactivated', 'success');
              loadDishes();
            } catch (e) { showToast(e.message, 'error'); }
          });
        });
      }

      document.getElementById('add-dish-btn').addEventListener('click', () => openDishModal(null));
    } catch (err) {
      app.innerHTML = `<div class="empty-state"><h3>Failed to load dishes</h3><p>${err.message}</p></div>`;
    }
  }

  function openDishModal(dish) {
    const isEdit = !!dish;
    const root = document.getElementById('dish-modal-root');

    root.innerHTML = `
      <div class="modal-overlay" id="dish-modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <h3>${isEdit ? 'Edit Dish' : 'Add New Dish'}</h3>
            <button class="modal-close" id="dish-modal-close">✕</button>
          </div>
          <div class="modal-body">
            <form id="dish-form">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="form-control" id="df-name" value="${isEdit ? dish.name : ''}" required />
              </div>
              <div class="form-group">
                <label>Description</label>
                <textarea class="form-control" id="df-desc">${isEdit ? (dish.description || '') : ''}</textarea>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Price (₹)</label>
                  <input type="number" class="form-control" id="df-price" step="0.01" min="0" value="${isEdit ? (dish.price_cents / 100).toFixed(2) : ''}" required />
                </div>
                <div class="form-group">
                  <label>Available Quantity</label>
                  <input type="number" class="form-control" id="df-qty" min="0" value="${isEdit ? dish.available_quantity : '0'}" required />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Available From</label>
                  <input type="time" class="form-control" id="df-from" value="${isEdit ? minutesToTime(dish.available_from_minutes) : '08:00'}" required />
                </div>
                <div class="form-group">
                  <label>Available To</label>
                  <input type="time" class="form-control" id="df-to" value="${isEdit ? minutesToTime(dish.available_to_minutes) : '17:00'}" required />
                </div>
              </div>
              <div class="form-group">
                <label>Photo</label>
                <input type="file" class="form-control" id="df-photo" accept="image/*" />
              </div>
              ${isEdit ? `
              <div class="form-group">
                <label>Status</label>
                <select class="form-control" id="df-active">
                  <option value="true" ${dish.is_active ? 'selected' : ''}>Active</option>
                  <option value="false" ${!dish.is_active ? 'selected' : ''}>Inactive</option>
                </select>
              </div>` : ''}
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline" id="dish-modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="dish-modal-save">${isEdit ? 'Save Changes' : 'Add Dish'}</button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { root.innerHTML = ''; };
    document.getElementById('dish-modal-close').addEventListener('click', closeModal);
    document.getElementById('dish-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('dish-modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) closeModal();
    });

    document.getElementById('dish-modal-save').addEventListener('click', async () => {
      const form = new FormData();
      form.append('name', document.getElementById('df-name').value.trim());
      form.append('description', document.getElementById('df-desc').value.trim());
      form.append('price_cents', Math.round(Number.parseFloat(document.getElementById('df-price').value) * 100));
      form.append('available_quantity', document.getElementById('df-qty').value);
      form.append('available_from_minutes', timeToMinutes(document.getElementById('df-from').value));
      form.append('available_to_minutes', timeToMinutes(document.getElementById('df-to').value));

      const photoFile = document.getElementById('df-photo').files[0];
      if (photoFile) form.append('photo', photoFile);

      if (isEdit) {
        const activeEl = document.getElementById('df-active');
        if (activeEl) form.append('is_active', activeEl.value);
      }

      const saveBtn = document.getElementById('dish-modal-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        if (isEdit) {
          await Api.put('/dishes/' + dish.id, form, true);
          showToast('Dish updated', 'success');
        } else {
          await Api.post('/dishes', form, true);
          showToast('Dish added', 'success');
        }
        closeModal();
        loadDishes();
      } catch (e) {
        showToast(e.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Dish';
      }
    });
  }

  function minutesToTime(m) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0');
  }

  function timeToMinutes(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  await loadDishes();
});

// Shopping cart state (stored in memory, cleared on logout)
const Cart = {
  _items: [], // { dish, quantity }
  _listeners: [],

  getItems() { return this._items; },
  getCount() { return this._items.reduce((s, i) => s + i.quantity, 0); },
  getTotal() { return this._items.reduce((s, i) => s + i.dish.price_cents * i.quantity, 0); },

  add(dish, qty) {
    const existing = this._items.find(i => i.dish.id === dish.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      this._items.push({ dish, quantity: qty });
    }
    this._notify();
  },

  updateQty(dishId, qty) {
    const item = this._items.find(i => i.dish.id === dishId);
    if (!item) return;
    if (qty <= 0) {
      this._items = this._items.filter(i => i.dish.id !== dishId);
    } else {
      item.quantity = qty;
    }
    this._notify();
  },

  remove(dishId) {
    this._items = this._items.filter(i => i.dish.id !== dishId);
    this._notify();
  },

  clear() {
    this._items = [];
    this._notify();
  },

  onChange(fn) { this._listeners.push(fn); },
  _notify() { this._listeners.forEach(fn => fn()); },
};

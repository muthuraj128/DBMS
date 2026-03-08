// Centralized API helper
const Api = {
  async request(method, path, body, isFormData) {
    const headers = {};
    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!isFormData) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    const res = await fetch(CONFIG.API_BASE + path, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (data && data.error) || 'Request failed';
      throw new Error(msg);
    }
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body, isFormData) { return this.request('POST', path, body, isFormData); },
  put(path, body, isFormData) { return this.request('PUT', path, body, isFormData); },
  patch(path, body) { return this.request('PATCH', path, body); },
  delete(path) { return this.request('DELETE', path); },
};

// Login Page
Router.register('login', async function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Welcome Back</h2>
        <p class="auth-subtitle">Sign in to your canteen account</p>
        <form id="login-form">
          <div class="form-group">
            <label for="login-email">Email Address</label>
            <input type="email" id="login-email" class="form-control" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" class="form-control" placeholder="Enter your password" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="login-btn">Sign In</button>
        </form>
        <div class="auth-footer">
          Don't have an account? <a href="#register">Register here</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const data = await Api.post('/auth/login', { email, password });
      Auth.login(data.user, data.token);
      showToast('Welcome back, ' + (data.user.name || data.user.email) + '!', 'success');
      Router.navigate(Auth.isAdmin() ? 'admin' : 'menu');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
});

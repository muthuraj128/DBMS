// Register Page
Router.register('register', async function renderRegister() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Create Account</h2>
        <p class="auth-subtitle">Join the canteen pre-order system</p>
        <form id="register-form">
          <div class="form-group">
            <label for="reg-name">Full Name</label>
            <input type="text" id="reg-name" class="form-control" placeholder="John Doe" />
          </div>
          <div class="form-group">
            <label for="reg-email">Email Address</label>
            <input type="email" id="reg-email" class="form-control" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label for="reg-phone">Phone Number</label>
            <input type="tel" id="reg-phone" class="form-control" placeholder="+91 9876543210" />
          </div>
          <div class="form-group">
            <label for="reg-password">Password</label>
            <input type="password" id="reg-password" class="form-control" placeholder="Min. 6 characters" required minlength="6" />
          </div>
          <button type="submit" class="btn btn-primary btn-block btn-lg" id="reg-btn">Create Account</button>
        </form>
        <div class="auth-footer">
          Already have an account? <a href="#login">Sign in</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reg-btn');
    btn.disabled = true;
    btn.textContent = 'Creating account...';
    try {
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const phone = document.getElementById('reg-phone').value.trim();
      const password = document.getElementById('reg-password').value;
      const data = await Api.post('/auth/register', { name, email, phone, password });
      Auth.login(data.user, data.token);
      showToast('Account created successfully!', 'success');
      Router.navigate('menu');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});

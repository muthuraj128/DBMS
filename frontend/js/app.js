// App bootstrap
(function () {
  Auth.onChange(() => {
    Navbar.render();
    Router._current = null;
    Router.resolve();
  });
  Navbar.render();
  Router.init();
})();

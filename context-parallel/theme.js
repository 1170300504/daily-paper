(() => {
  const key = 'daily-paper-theme';
  let stored;
  try { stored = localStorage.getItem(key); } catch (_) { /* Preferences are optional. */ }
  document.documentElement.dataset.theme = stored === 'dark' || stored === 'light'
    ? stored
    : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('articleTheme');
    const updateLabel = () => {
      const dark = document.documentElement.dataset.theme === 'dark';
      button.textContent = dark ? '浅色模式' : '深色模式';
      button.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
    };
    updateLabel();
    button.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      try { localStorage.setItem(key, theme); } catch (_) { /* Still switch this page. */ }
      updateLabel();
    });
  });
})();

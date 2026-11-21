// Sets the saved theme before the first paint. Extension pages may not run inline scripts, so this is its own file.
try {
  const t = localStorage.getItem('sk-theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch { /* storage blocked: follow the system theme */ }

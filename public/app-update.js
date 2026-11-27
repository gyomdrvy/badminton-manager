(() => {
  const script = document.currentScript;
  const base = new URL('./', script.src);
  if (!('serviceWorker' in navigator) || !crypto.subtle) return;
  const workers = navigator.serviceWorker;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Mettre à jour';
  button.hidden = true;
  button.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:10000;padding:8px 12px;border:1px solid #fff;border-radius:8px;background:#202e40;color:#fff;font:700 14px system-ui;box-shadow:0 2px 8px #0005';
  document.body.append(button);

  let registration, checking = false, applying = false, pendingInput = false, timeout;
  document.addEventListener('input', event => {
    if (event.target.matches('input:not([type=hidden]), textarea, [contenteditable]')) pendingInput = true;
  });
  const show = () => {button.hidden = !registration?.waiting || !workers.controller;};
  function watch() {
    registration.installing?.addEventListener('statechange', show);
    show();
  }
  async function check() {
    if (checking || applying || !navigator.onLine) return;
    checking = true;
    try {
      const url = new URL('sw.js', base);
      if (script.hasAttribute('data-static-update')) {
        const response = await fetch(new URL('index.html', base), {cache:'no-store'});
        if (!response.ok) return;
        const hash = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
        url.searchParams.set('release', [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join(''));
      }
      const next = await workers.register(url.href, {scope:base.href, updateViaCache:'none'});
      if (next !== registration) {
        registration = next;
        registration.addEventListener('updatefound', watch);
      }
      watch();
      await registration.update();
    } catch (error) {
      console.warn('Vérification de la mise à jour indisponible', error);
    } finally {
      checking = false;
    }
  }

  workers.addEventListener('controllerchange', () => {
    if (!applying) {show(); return;}
    clearTimeout(timeout);
    window.location.reload();
  });
  button.addEventListener('click', () => {
    const waiting = registration?.waiting;
    if (!waiting || applying) return;
    const message = window.appUpdateBlocker?.();
    if (message) {window.alert(message); return;}
    if (pendingInput && !window.confirm('Enregistre tes saisies avant de mettre à jour. Continuer et recharger l’application ?')) return;
    applying = true;
    button.disabled = true;
    button.textContent = 'Mise à jour…';
    timeout = setTimeout(() => {
      applying = false;
      button.disabled = false;
      button.textContent = 'Mettre à jour';
      show();
      window.alert('La mise à jour prend du temps. Réessaie ou rouvre l’application.');
    }, 15000);
    waiting.postMessage('APPLY_UPDATE');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  window.addEventListener('online', check);
  check();
})();

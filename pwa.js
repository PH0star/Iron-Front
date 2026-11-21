(() => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  const status = document.getElementById('offlineStatus');
  const install = document.getElementById('installApp');
  let promptEvent;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    install.hidden = false;
  });
  install.addEventListener('click', async () => {
    if (!promptEvent) return;
    const event = promptEvent;
    promptEvent = null;
    install.hidden = true;
    try { await event.prompt(); await event.userChoice; } catch { /* Browser dismissed installation. */ }
  });
  window.addEventListener('appinstalled', () => { install.hidden = true; promptEvent = null; });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .then(() => { status.textContent = '離線就緒'; })
    .catch(() => { status.textContent = '離線功能未啟用'; });
})();

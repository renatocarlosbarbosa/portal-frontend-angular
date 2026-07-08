export function registrarServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const protocoloSuportado = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!protocoloSuportado) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((erro: unknown) => {
      console.warn('Nao foi possivel registrar o service worker.', erro);
    });
  });
}

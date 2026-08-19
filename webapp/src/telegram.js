function getWebApp() {
  return typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
}

export function initTelegram() {
  const webApp = getWebApp();
  if (!webApp) return;
  webApp.ready();
  webApp.expand();
  try {
    webApp.setHeaderColor?.('#0a0a0b');
    webApp.setBackgroundColor?.('#0a0a0b');
  } catch {
    // старые клиенты Telegram могут не поддерживать эти методы — не критично
  }
}

export function getInitData() {
  return getWebApp()?.initData || '';
}

export function getTelegramUser() {
  return getWebApp()?.initDataUnsafe?.user || null;
}

export function hapticSelect() {
  getWebApp()?.HapticFeedback?.selectionChanged();
}

export function hapticSuccess() {
  getWebApp()?.HapticFeedback?.notificationOccurred('success');
}

export function hapticError() {
  getWebApp()?.HapticFeedback?.notificationOccurred('error');
}

export function setBackButton(onClick) {
  const webApp = getWebApp();
  if (!webApp?.BackButton) return () => {};
  if (onClick) {
    webApp.BackButton.show();
    webApp.BackButton.onClick(onClick);
  } else {
    webApp.BackButton.hide();
  }
  return () => {
    if (onClick) webApp.BackButton.offClick(onClick);
  };
}

export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
}

export function isInsideTelegram() {
  return !!getWebApp()?.initData;
}

export function openTelegramLink(url) {
  const webApp = getWebApp();
  if (webApp?.openTelegramLink) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

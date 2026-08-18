import { getInitData } from './telegram';

const API_URL = import.meta.env.VITE_API_URL || '';
const DEBUG_USER_ID = import.meta.env.VITE_DEBUG_USER_ID || '';

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Telegram-Init-Data': getInitData(),
    ...(DEBUG_USER_ID ? { 'X-Debug-User-Id': DEBUG_USER_ID } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getProfile: () => request('/api/profile'),
  getBonus: () => request('/api/profile/bonus'),
  getProducts: () => request('/api/products'),
  getOrders: () => request('/api/orders'),
  createOrder: (payload) =>
    request('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
  uploadReceipt: (orderId, imageBase64) =>
    request(`/api/orders/${orderId}/receipt`, { method: 'POST', body: JSON.stringify({ imageBase64 }) }),
};

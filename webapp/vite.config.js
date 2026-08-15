import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Явно IPv4 — на некоторых Windows-машинах Vite слушает только [::1]
    // (IPv6), а браузер/локальные туннели идут через 127.0.0.1 и получают
    // ERR_CONNECTION_REFUSED, хотя сервер на самом деле работает.
    host: '127.0.0.1',
    // Разрешаем туннели ngrok / Cloudflare — иначе Vite отклоняет запросы с
    // незнакомым Host-заголовком ("Blocked request. This host is not allowed").
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io', '.trycloudflare.com'],
  },
});

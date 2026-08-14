import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Разрешаем туннели ngrok — иначе Vite отклоняет запросы с незнакомым
    // Host-заголовком ("Blocked request. This host is not allowed").
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
  },
});

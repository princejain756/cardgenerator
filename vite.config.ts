import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiProxyTarget = env.VITE_API_URL || 'http://localhost:4000';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true
          }
        }
      },
      preview: {
        port: 4001,
        host: '0.0.0.0',
        allowedHosts: ['id.maninfini.com', 'localhost'],
        proxy: {
          '/api': {
            target: apiProxyTarget,
            changeOrigin: true
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      optimizeDeps: {
        exclude: ['onnxruntime-web', 'onnxruntime-web/webgpu']
      },
      build: {
        rollupOptions: {
          external: ['onnxruntime-web', 'onnxruntime-web/webgpu']
        }
      }
    };
});

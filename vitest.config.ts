import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['src/tests/setup/imagedata-polyfill.ts'],
  },
});

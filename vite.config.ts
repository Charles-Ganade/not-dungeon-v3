import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [devtools(), solidPlugin(), tailwindcss(), viteTsConfigPaths()],
  server: {
    port: 5217,
  },
  build: {
    target: 'esnext',
  },
});

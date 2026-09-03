import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverPort = parseInt(env.PORT, 10) || 3000;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      open: false,
      proxy: {
        "/api": {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false
        }
      }
    },
    preview: {
      port: 3000,
      host: true
    }
  };
});
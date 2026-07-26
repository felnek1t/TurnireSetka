import netlify from "@netlify/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  // The Netlify Vite emulator runs functions in child processes. Loading the
  // unprefixed server variables here makes `.env` available to those local
  // functions without exposing them to the browser bundle.
  const serverEnv = loadEnv(mode, process.cwd(), "");
  for (const key of ["ADMIN_PIN", "SESSION_SECRET"]) {
    if (serverEnv[key] && !process.env[key]) {
      process.env[key] = serverEnv[key];
    }
  }

  return {
    plugins: [react(), netlify()],
    server: {
      host: true,
    },
    build: {
      sourcemap: true,
    },
  };
});

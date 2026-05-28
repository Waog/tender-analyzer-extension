import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    permissions: ["contextMenus", "sidePanel", "downloads"],
    host_permissions: ["<all_urls>"],
  },
});

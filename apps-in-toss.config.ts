import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "pill-check",

  brand: {
    primaryColor: "#6B4FBB",
  },

  // 위치·연락처·카메라 어느 것도 필요 없어요. 개인정보를 아예 안 받습니다.
  permissions: [],

  webBundleDir: "dist",

  navigationBar: {
    withBackButton: true,
    withHomeButton: false,
  },
});

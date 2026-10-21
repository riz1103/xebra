const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// firebase/auth's package exports point at the browser build, which has no
// React Native persistence. The Android bundle needs the RN entry instead.
const authRn = path.resolve(
  __dirname,
  "node_modules/firebase/node_modules/@firebase/auth/dist/rn/index.js"
);
// One copy of @firebase/app. The auth package and firebase/app otherwise load
// separate copies, and Auth then crashes with "Component auth has not been registered yet".
const firebaseApp = path.resolve(__dirname, "node_modules/@firebase/app/dist/index.cjs.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "firebase/auth") {
    return { type: "sourceFile", filePath: authRn };
  }
  if (moduleName === "@firebase/app" || moduleName === "firebase/app") {
    return { type: "sourceFile", filePath: firebaseApp };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

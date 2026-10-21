const deployedApi = "https://xebra-api.netlify.app";

/** Public site. Certificate QR codes open this origin so anyone can confirm a certificate. */
export const SITE_ORIGIN = "https://xevra.concepcion-digital-solutions.com";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || deployedApi;

export const googleWebClientId = "634489382731-h6ld2gsjk3ch518gg4vosg2mebdao5rn.apps.googleusercontent.com";
export const googleAndroidClientId = "634489382731-5q3kbs4853thte9j84bc0lvdcvlmso1p.apps.googleusercontent.com";

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

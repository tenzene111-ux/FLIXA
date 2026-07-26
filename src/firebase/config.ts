import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, type Auth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAFpdbQrf8igzCEcq1MXoKA6Kb91Bzjv0A',
  authDomain: 'flixa-1c37a.firebaseapp.com',
  projectId: 'flixa-1c37a',
  storageBucket: 'flixa-1c37a.firebasestorage.app',
  messagingSenderId: '472899684764',
  appId: '1:472899684764:web:850a14374f1e0f2ef2a059',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;
if (Platform.OS === 'web') {
  // Web already persists to localStorage by default; the RN persistence
  // helper below doesn't exist on the browser build of @firebase/auth.
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // initializeAuth throws if it was already called for this app (e.g. Fast Refresh)
    auth = getAuth(app);
  }
}

export { app, auth };

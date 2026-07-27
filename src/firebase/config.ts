import { Platform } from 'react-native';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence, getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
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

const db = getFirestore(app);
const functions = getFunctions(app);
const storage = getStorage(app);

// Opt-in local development against the Firebase Emulator Suite
// (`firebase emulators:start`) instead of the live project. Set
// EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 and, if testing on a physical device
// or simulator, EXPO_PUBLIC_FIREBASE_EMULATOR_HOST to your machine's LAN IP
// (defaults to localhost, which only works for web/same-machine testing).
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1') {
  const host = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? 'localhost';
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
  connectFunctionsEmulator(functions, host, 5001);
  connectStorageEmulator(storage, host, 9199);
}

export { app, auth, db, functions, storage };

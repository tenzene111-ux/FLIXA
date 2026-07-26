import 'firebase/auth';

// The installed `firebase` package's type map for the "./auth" subpath doesn't carry
// a react-native-specific `.d.ts`, even though the runtime module (resolved by Metro
// through @firebase/auth's own conditional exports) does export this at the RN entry
// point. Patch the types back in so `getReactNativePersistence` type-checks.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}

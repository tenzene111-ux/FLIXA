# FLIXA Cloud Functions

Server-authoritative wallet mutations. The client never writes `wallets/*`
directly (see `../firestore.rules`) — every credit or debit goes through one
of these callables, which run with the Admin SDK and can enforce fixed
amounts and receipt validation that a client can't be trusted to self-report.

## Functions

- `claimReward({ reason })` — credits a fixed amount for a known reason
  (`creator_reward`, `referral_bonus`, `refund`).
- `spendCoins({ item })` — debits a fixed cost for a known spend
  (`live_gift`, `video_boost`); fails with `failed-precondition` if the
  balance would go negative.
- `verifyTopupPurchase({ platform, productId, purchaseToken })` — intended to
  credit a wallet after a real App Store / Play Store in-app purchase. **This
  one is a stub** (see below).
- `sendGift({ contextType, contextId, toUid, fromUsername })` — debits the
  sender's coins and credits the recipient's diamonds in one transaction, on
  either a video (`contextType: 'video'`) or a live stream
  (`contextType: 'liveStream'`), and records the gift for that item's
  leaderboard.
- `getLiveKitToken({ roomName, canPublish })` — mints a short-lived LiveKit
  join token for the calling user. **Requires the LiveKit secrets below** —
  see "LiveKit setup".

## Setup

```bash
cd functions
npm install
firebase login
firebase deploy --only functions,firestore:rules
```

## LiveKit setup

`getLiveKitToken` needs three secrets before live streaming will work at
all — without them it throws instead of silently returning a broken token:

1. Create a project at https://cloud.livekit.io (or self-host) and copy its
   API Key, API Secret, and WebSocket URL (looks like
   `wss://your-project.livekit.cloud`).
2. Store them as function secrets (never commit them):
   ```bash
   firebase functions:secrets:set LIVEKIT_API_KEY
   firebase functions:secrets:set LIVEKIT_API_SECRET
   firebase functions:secrets:set LIVEKIT_URL
   ```
3. Deploy: `firebase deploy --only functions`.

The client never sees the API key/secret — only the per-user join token
`getLiveKitToken` returns, and the server URL (not sensitive, just where to
connect).

## Finishing `verifyTopupPurchase`

This function currently throws `unimplemented`. To make real in-app purchases
work, you (the project owner) need to:

1. **Create the products.** In App Store Connect and the Google Play
   Console, create consumable in-app purchase products with IDs matching
   `TOPUP_PRODUCTS` in `src/index.ts` (or edit that map to match the IDs you
   choose).
2. **Get server credentials:**
   - Apple: an App Store Server API key (`.p8` file, Key ID, Issuer ID) from
     App Store Connect → Users and Access → Integrations.
   - Google: a service account with the "Pub/Sub Editor" / Play Developer
     API access, downloaded as a JSON key, with the Google Play Developer
     API enabled in Google Cloud Console.
3. **Store them as function secrets** (never commit them):
   ```bash
   firebase functions:secrets:set APPLE_ISSUER_ID
   firebase functions:secrets:set APPLE_KEY_ID
   firebase functions:secrets:set APPLE_PRIVATE_KEY
   firebase functions:secrets:set GOOGLE_SERVICE_ACCOUNT_JSON
   ```
4. **Implement verification** in `verifyTopupPurchase`: call Apple's
   [In-App Purchase API](https://developer.apple.com/documentation/appstoreserverapi)
   or Google's
   [Play Developer API `purchases.products.get`](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products/get)
   with the receipt/token, confirm it's valid and unconsumed, then call
   `applyWalletDelta` and mark the purchase token as processed (both already
   scaffolded in the function body).
5. On the client, wire the real purchase flow with `react-native-iap`'s
   `requestPurchase`, and call `verifyTopupPurchase` from the
   `purchaseUpdatedListener` once you have a transaction receipt. See
   `src/screens/WalletScreen.tsx` for where the placeholder currently sits.

Without steps 1-4, `Top Up` in the app will surface the `unimplemented`
error rather than silently pretending to succeed.

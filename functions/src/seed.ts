/**
 * One-off seed script for public, curated content that has no natural
 * producer yet (trending hashtags, featured creators, a demo live stream).
 * Not deployed as a Cloud Function — run it once with the Admin SDK:
 *
 *   npm --prefix functions run build
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json node functions/lib/seed.js
 *
 * (Requires a service account key downloaded from Firebase Console ->
 * Project Settings -> Service Accounts -> Generate new private key.)
 */
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

async function seed() {
  const hashtags = [
    { tag: '#SummerVibes', viewCount: 12500000 },
    { tag: '#GoodEnergy', viewCount: 8200000 },
    { tag: '#DanceChallenge', viewCount: 5600000 },
  ];
  for (const h of hashtags) {
    await db.collection('exploreHashtags').add(h);
  }

  const creators = [
    { handle: '@lunalights', displayName: 'Luna Lights', avatarUrl: 'https://i.pravatar.cc/100?img=45', followerCount: 2400000 },
    { handle: '@kanepixels', displayName: 'Kane Pixels', avatarUrl: 'https://i.pravatar.cc/100?img=15', followerCount: 1800000 },
    { handle: '@taylorreef', displayName: 'Taylor Reef', avatarUrl: 'https://i.pravatar.cc/100?img=32', followerCount: 1200000 },
  ];
  for (const c of creators) {
    await db.collection('exploreCreators').add(c);
  }

  await db.collection('liveStreams').add({
    hostName: 'Diana Live',
    hostAvatar: 'https://i.pravatar.cc/100?img=47',
    title: 'Chatting with viewers',
    viewerCount: 1200,
    isLive: true,
  });

  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

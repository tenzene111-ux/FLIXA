import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type AnalyticsEventType =
  | 'video_view'
  | 'like'
  | 'unlike'
  | 'comment'
  | 'share'
  | 'post_created'
  | 'follow'
  | 'save'
  | 'unsave';

export function logEvent(type: AnalyticsEventType, uid: string, meta: Record<string, unknown> = {}) {
  addDoc(collection(db, 'analytics_events'), {
    type,
    uid,
    ...meta,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

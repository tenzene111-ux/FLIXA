import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type AnalyticsEventType =
  | 'video_view'
  | 'video_watch'
  | 'like'
  | 'unlike'
  | 'comment'
  | 'share'
  | 'post_created'
  | 'follow'
  | 'save'
  | 'unsave'
  | 'gift_sent'
  | 'poll_vote'
  | 'not_interested'
  | 'search'
  | 'profile_visit';

export function logEvent(type: AnalyticsEventType, uid: string, meta: Record<string, unknown> = {}) {
  addDoc(collection(db, 'analytics_events'), {
    type,
    uid,
    ...meta,
    createdAt: serverTimestamp(),
  }).catch(() => {});
}

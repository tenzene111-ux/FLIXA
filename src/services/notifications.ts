import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { NotificationItem } from '../types/models';

const NOTIFICATIONS_LIMIT = 100;

export function subscribeNotifications(uid: string, onChange: (items: NotificationItem[]) => void) {
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(NOTIFICATIONS_LIMIT)
  );
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) })));
  });
}

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type ReportReason = 'spam' | 'inappropriate' | 'other';

export async function reportPost(params: { postId: string; reporterUid: string; reason: ReportReason }) {
  await addDoc(collection(db, 'reports'), {
    postId: params.postId,
    reporterUid: params.reporterUid,
    reason: params.reason,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

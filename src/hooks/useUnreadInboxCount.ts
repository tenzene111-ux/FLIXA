import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotifications } from '../services/notifications';
import { isConversationUnread, subscribeToConversations } from '../services/messages';

// Powers the Inbox tab-bar badge — unread notifications plus conversations
// with an unseen incoming message, kept live via the same listeners the
// Inbox screens themselves use.
export function useUnreadInboxCount(): number {
  const { user } = useAuth();
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      return;
    }
    return subscribeToNotifications(user.uid, (list) => {
      setUnreadNotifications(list.filter((n) => !n.read).length);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadConversations(0);
      return;
    }
    return subscribeToConversations(user.uid, (list) => {
      setUnreadConversations(list.filter((c) => isConversationUnread(c, user.uid)).length);
    });
  }, [user]);

  return unreadNotifications + unreadConversations;
}

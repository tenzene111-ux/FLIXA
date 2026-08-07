import { useEffect, useState } from 'react';
import { subscribeToUserProfile } from '../services/users';
import type { UserProfile } from '../types/userProfile';

export function useUserProfile(uid: string | undefined) {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      return;
    }
    return subscribeToUserProfile(uid, setProfile);
  }, [uid]);

  return profile;
}

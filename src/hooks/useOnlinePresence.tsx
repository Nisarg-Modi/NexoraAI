import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { RealtimeChannel } from "@supabase/supabase-js";
import { formatDistanceToNow } from "date-fns";

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

let globalChannel: RealtimeChannel | null = null;
let onlineUsersState: Set<string> = new Set();
let lastSeenCache: Map<string, Date> = new Map();
let listeners: Set<(users: Set<string>) => void> = new Set();
let lastSeenListeners: Set<(cache: Map<string, Date>) => void> = new Set();

const notifyLastSeenListeners = () => {
  lastSeenListeners.forEach(listener => listener(new Map(lastSeenCache)));
};

// Update last seen in the database
const updateLastSeen = async (userId: string) => {
  try {
    await supabase
      .from('user_last_seen')
      .upsert({ 
        user_id: userId, 
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'user_id' 
      });
  } catch (error) {
    console.error('Error updating last seen:', error);
  }
};

const notifyListeners = () => {
  listeners.forEach(listener => listener(new Set(onlineUsersState)));
};

export const useOnlinePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set(onlineUsersState));
  const [lastSeenMap, setLastSeenMap] = useState<Map<string, Date>>(new Map(lastSeenCache));

  useEffect(() => {
    const listener = (users: Set<string>) => setOnlineUsers(users);
    listeners.add(listener);
    
    const lastSeenListener = (cache: Map<string, Date>) => setLastSeenMap(cache);
    lastSeenListeners.add(lastSeenListener);
    
    return () => {
      listeners.delete(listener);
      lastSeenListeners.delete(lastSeenListener);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // If channel already exists, just track this user
    if (globalChannel) {
      globalChannel.track({
        user_id: user.id,
        online_at: new Date().toISOString(),
      });
      return;
    }

    // Create the presence channel
    globalChannel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    globalChannel
      .on('presence', { event: 'sync' }, () => {
        const state = globalChannel?.presenceState() as PresenceState;
        const users = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.user_id) {
              users.add(presence.user_id);
            }
          });
        });
        
        onlineUsersState = users;
        notifyListeners();
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((presence) => {
          const userId = (presence as Record<string, unknown>).user_id as string | undefined;
          if (userId) {
            onlineUsersState.add(userId);
          }
        });
        notifyListeners();
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((presence) => {
          const userId = (presence as Record<string, unknown>).user_id as string | undefined;
          if (userId) {
            onlineUsersState.delete(userId);
            // Update last seen when user goes offline
            lastSeenCache.set(userId, new Date());
            notifyLastSeenListeners();
            updateLastSeen(userId);
          }
        });
        notifyListeners();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel?.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    // Update own last seen periodically while online
    const interval = setInterval(() => {
      if (user) {
        updateLastSeen(user.id);
      }
    }, 60000); // Every minute

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden && user) {
        updateLastSeen(user.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle page unload
    const handleBeforeUnload = () => {
      if (user) {
        // Use sendBeacon for reliable delivery on page close
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/user_last_seen?on_conflict=user_id`;
        navigator.sendBeacon(url, JSON.stringify({
          user_id: user.id,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  const getLastSeen = useCallback((userId: string): Date | null => {
    return lastSeenMap.get(userId) || null;
  }, [lastSeenMap]);

  // Fetch last seen for specific users
  const fetchLastSeen = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return;
    
    try {
      const { data } = await supabase
        .from('user_last_seen')
        .select('user_id, last_seen_at')
        .in('user_id', userIds);
      
      if (data) {
        data.forEach(row => {
          lastSeenCache.set(row.user_id, new Date(row.last_seen_at));
        });
        notifyLastSeenListeners();
      }
    } catch (error) {
      console.error('Error fetching last seen:', error);
    }
  }, []);

  return { onlineUsers, isUserOnline, getLastSeen, fetchLastSeen, lastSeenMap };
};

// Simple component for showing online status dot
export const OnlineStatusDot = ({ 
  userId, 
  className = "",
  size = "sm"
}: { 
  userId: string; 
  className?: string;
  size?: "sm" | "md" | "lg";
}) => {
  const { isUserOnline } = useOnlinePresence();
  const isOnline = isUserOnline(userId);

  const sizeClasses = {
    sm: "w-2.5 h-2.5",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  if (!isOnline) return null;

  return (
    <span 
      className={`${sizeClasses[size]} bg-green-500 rounded-full border-2 border-background ${className}`}
      title="Online"
    />
  );
};

// Component for showing last seen status
export const LastSeenStatus = ({ 
  userId,
  className = ""
}: { 
  userId: string;
  className?: string;
}) => {
  const { isUserOnline, getLastSeen, fetchLastSeen } = useOnlinePresence();
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const isOnline = isUserOnline(userId);

  useEffect(() => {
    if (!isOnline) {
      const cached = getLastSeen(userId);
      if (cached) {
        setLastSeen(cached);
      } else {
        fetchLastSeen([userId]);
      }
    }
  }, [userId, isOnline, getLastSeen, fetchLastSeen]);

  useEffect(() => {
    const cached = getLastSeen(userId);
    if (cached) {
      setLastSeen(cached);
    }
  }, [userId, getLastSeen]);

  if (isOnline) {
    return (
      <span className={`text-xs text-green-500 ${className}`}>
        Online
      </span>
    );
  }

  if (!lastSeen) {
    return null;
  }

  return (
    <span className={`text-xs text-muted-foreground ${className}`}>
      Last seen {formatDistanceToNow(lastSeen, { addSuffix: true })}
    </span>
  );
};

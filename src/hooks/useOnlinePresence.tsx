import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

let globalChannel: RealtimeChannel | null = null;
let onlineUsersState: Set<string> = new Set();
let listeners: Set<(users: Set<string>) => void> = new Set();

const notifyListeners = () => {
  listeners.forEach(listener => listener(new Set(onlineUsersState)));
};

export const useOnlinePresence = () => {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set(onlineUsersState));

  useEffect(() => {
    const listener = (users: Set<string>) => setOnlineUsers(users);
    listeners.add(listener);
    
    return () => {
      listeners.delete(listener);
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

    return () => {
      // Don't unsubscribe on unmount - keep presence active
    };
  }, [user]);

  const isUserOnline = useCallback((userId: string) => {
    return onlineUsers.has(userId);
  }, [onlineUsers]);

  return { onlineUsers, isUserOnline };
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

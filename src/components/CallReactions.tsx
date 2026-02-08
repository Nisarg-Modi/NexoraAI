import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface CallReactionsProps {
  callId: string;
  userId: string;
}

interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
  timestamp: Date;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '🔥', '💯'];

export const CallReactions = ({ callId, userId }: CallReactionsProps) => {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Listen for reactions via broadcast channel
  useEffect(() => {
    const channel = supabase.channel(`call-reactions:${callId}`);
    
    channel
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        const newReaction: Reaction = {
          id: `${Date.now()}-${payload.userId}`,
          emoji: payload.emoji,
          userId: payload.userId,
          userName: payload.userName,
          timestamp: new Date(),
        };
        
        setReactions(prev => [...prev, newReaction]);
        
        // Auto-remove reaction after 3 seconds
        setTimeout(() => {
          setReactions(prev => prev.filter(r => r.id !== newReaction.id));
        }, 3000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callId]);

  const sendReaction = async (emoji: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', userData.user.id)
      .single();

    await supabase.channel(`call-reactions:${callId}`).send({
      type: 'broadcast',
      event: 'reaction',
      payload: {
        emoji,
        userId: userData.user.id,
        userName: profile?.display_name || 'User',
      },
    });

    setShowPicker(false);
  };

  return (
    <div className="relative">
      {/* Floating reactions display */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 flex flex-col-reverse gap-2 pointer-events-none z-50">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="animate-bounce-in bg-background/90 backdrop-blur px-3 py-1.5 rounded-full shadow-lg flex items-center gap-2"
          >
            <span className="text-2xl">{reaction.emoji}</span>
            <span className="text-sm font-medium">{reaction.userName}</span>
          </div>
        ))}
      </div>

      {/* Reaction picker */}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger asChild>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full w-14 h-14"
            title="Send Reaction"
          >
            <span className="text-xl">😀</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" side="top">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-2xl p-2 hover:bg-accent rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

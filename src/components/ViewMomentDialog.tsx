import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, X, Trash2, Send, Heart, ThumbsUp, Laugh, Frown, Flame, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Moment {
  id: string;
  user_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string;
  created_at: string;
  expires_at: string;
  views_count: number;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface MomentReply {
  id: string;
  moment_id: string;
  user_id: string;
  content: string | null;
  emoji: string | null;
  reply_type: string;
  created_at: string;
  profile?: {
    display_name: string;
    avatar_url: string | null;
  };
}

interface ViewMomentDialogProps {
  moments: Moment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMomentDeleted?: () => void;
}

const REACTION_EMOJIS = [
  { emoji: "❤️", icon: Heart, label: "Love" },
  { emoji: "👍", icon: ThumbsUp, label: "Like" },
  { emoji: "😂", icon: Laugh, label: "Laugh" },
  { emoji: "😢", icon: Frown, label: "Sad" },
  { emoji: "🔥", icon: Flame, label: "Fire" },
];

export const ViewMomentDialog = ({ 
  moments, 
  initialIndex, 
  open, 
  onOpenChange,
  onMomentDeleted 
}: ViewMomentDialogProps) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [replyText, setReplyText] = useState("");
  const [replies, setReplies] = useState<MomentReply[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (open && moments[currentIndex]) {
      recordView(moments[currentIndex].id);
      fetchReplies(moments[currentIndex].id);
    }
  }, [open, currentIndex, moments]);

  const fetchReplies = async (momentId: string) => {
    try {
      const { data, error } = await supabase
        .from('moment_replies')
        .select('*')
        .eq('moment_id', momentId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        // Fetch profiles for reply users
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        const repliesWithProfiles = data.map(r => ({
          ...r,
          profile: profileMap.get(r.user_id)
        }));

        setReplies(repliesWithProfiles);
      } else {
        setReplies([]);
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    }
  };

  const recordView = async (momentId: string) => {
    if (!user) return;
    
    try {
      await supabase
        .from('moment_views')
        .upsert({
          moment_id: momentId,
          viewer_id: user.id,
        }, {
          onConflict: 'moment_id,viewer_id'
        });
    } catch (error) {
      console.error("Error recording view:", error);
    }
  };

  const sendReaction = async (emoji: string) => {
    if (!user || !moments[currentIndex]) return;

    try {
      const { error } = await supabase
        .from('moment_replies')
        .insert({
          moment_id: moments[currentIndex].id,
          user_id: user.id,
          emoji,
          reply_type: 'reaction'
        });

      if (error) throw error;
      
      toast.success("Reaction sent!");
      fetchReplies(moments[currentIndex].id);
    } catch (error: any) {
      console.error("Error sending reaction:", error);
      toast.error("Failed to send reaction");
    }
  };

  const sendTextReply = async () => {
    if (!user || !moments[currentIndex] || !replyText.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('moment_replies')
        .insert({
          moment_id: moments[currentIndex].id,
          user_id: user.id,
          content: replyText.trim(),
          reply_type: 'text'
        });

      if (error) throw error;
      
      toast.success("Reply sent!");
      setReplyText("");
      fetchReplies(moments[currentIndex].id);
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  const goNext = () => {
    if (currentIndex < moments.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowReplies(false);
    } else {
      onOpenChange(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowReplies(false);
    }
  };

  const handleDelete = async () => {
    const moment = moments[currentIndex];
    if (!moment || moment.user_id !== user?.id) return;

    try {
      if (moment.media_url) {
        const urlParts = moment.media_url.split('/');
        const fileName = urlParts.slice(-2).join('/');
        await supabase.storage.from('moments').remove([fileName]);
      }

      const { error } = await supabase
        .from('moments')
        .delete()
        .eq('id', moment.id);

      if (error) throw error;

      toast.success("Moment deleted");
      onOpenChange(false);
      onMomentDeleted?.();
    } catch (error: any) {
      console.error("Error deleting moment:", error);
      toast.error("Failed to delete moment");
    }
  };

  if (!moments.length || !moments[currentIndex]) {
    return null;
  }

  const currentMoment = moments[currentIndex];
  const isOwn = currentMoment.user_id === user?.id;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const reactionCounts = replies
    .filter(r => r.reply_type === 'reaction')
    .reduce((acc, r) => {
      if (r.emoji) {
        acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

  const textReplies = replies.filter(r => r.reply_type === 'text');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden bg-background/95 backdrop-blur max-h-[90vh]">
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
          {moments.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-colors ${
                idx <= currentIndex ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 border-2 border-primary">
              <AvatarImage src={currentMoment.profile?.avatar_url || ""} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                {getInitials(currentMoment.profile?.display_name || "User")}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm text-foreground">
                {currentMoment.profile?.display_name || "User"}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(currentMoment.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwn && replies.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 relative"
                onClick={() => setShowReplies(!showReplies)}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {replies.length}
                </span>
              </Button>
            )}
            {isOwn && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="min-h-[300px] flex items-center justify-center p-4 pt-20 pb-4">
          {currentMoment.media_url && currentMoment.media_type === "image" ? (
            <div className="relative w-full">
              <img
                src={currentMoment.media_url}
                alt="Moment"
                className="w-full max-h-[45vh] object-contain rounded-lg"
                loading="lazy"
                decoding="async"
              />
              {currentMoment.content && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
                  <p className="text-white text-sm">{currentMoment.content}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8 bg-card rounded-xl max-w-sm">
              <p className="text-lg">{currentMoment.content}</p>
            </div>
          )}
        </div>

        {/* Reaction counts */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex gap-2 px-4 pb-2 flex-wrap">
            {Object.entries(reactionCounts).map(([emoji, count]) => (
              <span
                key={emoji}
                className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-full text-sm"
              >
                {emoji} {count}
              </span>
            ))}
          </div>
        )}

        {/* Replies section (for moment owner) */}
        {isOwn && showReplies && replies.length > 0 && (
          <div className="border-t border-border">
            <ScrollArea className="max-h-[150px]">
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Replies ({replies.length})
                </p>
                {replies.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={reply.profile?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">
                        {getInitials(reply.profile?.display_name || "U")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">
                          {reply.profile?.display_name || "User"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {reply.reply_type === 'reaction' ? (
                        <span className="text-lg">{reply.emoji}</span>
                      ) : (
                        <p className="text-sm text-foreground">{reply.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Reply input (for non-owners) */}
        {!isOwn && (
          <div className="border-t border-border p-3 space-y-3">
            {/* Quick reactions */}
            <div className="flex justify-center gap-2">
              {REACTION_EMOJIS.map(({ emoji, label }) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="p-2 hover:bg-muted rounded-full transition-colors text-xl hover:scale-110 active:scale-95"
                  title={label}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Text reply */}
            <div className="flex gap-2">
              <Input
                placeholder="Send a reply..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendTextReply();
                  }
                }}
                className="flex-1"
              />
              <Button
                size="icon"
                onClick={sendTextReply}
                disabled={!replyText.trim() || isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Navigation */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50"
            onClick={goPrev}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {currentIndex < moments.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/50"
            onClick={goNext}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Tap areas for navigation */}
        <div
          className="absolute left-0 top-20 bottom-32 w-1/4 cursor-pointer"
          onClick={goPrev}
        />
        <div
          className="absolute right-0 top-20 bottom-32 w-1/4 cursor-pointer"
          onClick={goNext}
        />
      </DialogContent>
    </Dialog>
  );
};

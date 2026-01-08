import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Star, Volume2, VolumeX, Trash2, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { PublicProfileCard } from "./PublicProfileCard";

interface ContactProfile {
  display_name: string;
  username: string;
  avatar_url?: string | null;
  bio?: string | null;
  status?: string | null;
  location?: string | null;
  twitter_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  website_url?: string | null;
}

interface SwipeableContactItemProps {
  contact: {
    id: string;
    contact_user_id: string;
    contact_name: string | null;
    is_favourite: boolean;
    notification_sound_enabled?: boolean;
    profiles: {
      display_name: string | null;
      status: string | null;
      avatar_url: string | null;
      username?: string | null;
      bio?: string | null;
      location?: string | null;
      twitter_url?: string | null;
      linkedin_url?: string | null;
      instagram_url?: string | null;
      website_url?: string | null;
    };
  };
  displayName: string;
  emoji: string;
  statusMsg: string;
  avatarColor: string;
  unreadCount: number;
  onStartChat: () => void;
  onToggleFavourite: (e: React.MouseEvent) => void;
  onToggleSound: () => void;
  onDelete: () => void;
}

const SWIPE_THRESHOLD = 80;
const MAX_SWIPE = 120;

const SwipeableContactItem = ({
  contact,
  displayName,
  emoji,
  statusMsg,
  avatarColor,
  unreadCount,
  onStartChat,
  onToggleFavourite,
  onToggleSound,
  onDelete,
}: SwipeableContactItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const profileData: ContactProfile = {
    display_name: contact.profiles?.display_name || displayName,
    username: contact.profiles?.username || displayName.toLowerCase().replace(/\s+/g, ''),
    avatar_url: contact.profiles?.avatar_url,
    bio: contact.profiles?.bio,
    status: contact.profiles?.status,
    location: contact.profiles?.location,
    twitter_url: contact.profiles?.twitter_url,
    linkedin_url: contact.profiles?.linkedin_url,
    instagram_url: contact.profiles?.instagram_url,
    website_url: contact.profiles?.website_url,
  };

  const handleAvatarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Math.abs(translateX) < 10) {
      setShowProfileDialog(true);
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    setIsDragging(true);
  }, [translateX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    
    const diff = e.touches[0].clientX - startXRef.current;
    const newTranslate = currentXRef.current + diff;
    
    // Clamp the translation
    const clampedTranslate = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, newTranslate));
    setTranslateX(clampedTranslate);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    
    // Snap to action or reset
    if (translateX < -SWIPE_THRESHOLD) {
      // Swiped left - show delete
      setTranslateX(-MAX_SWIPE);
    } else if (translateX > SWIPE_THRESHOLD) {
      // Swiped right - show archive
      setTranslateX(MAX_SWIPE);
    } else {
      // Reset
      setTranslateX(0);
    }
  }, [translateX]);

  const handleActionClick = (action: 'sound' | 'delete') => {
    if (action === 'sound') {
      setTranslateX(0);
      onToggleSound();
    } else {
      // Show confirmation dialog for delete
      setShowDeleteConfirm(true);
    }
  };

  const soundEnabled = contact.notification_sound_enabled ?? true;

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    setTranslateX(0);
    onDelete();
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setTranslateX(0);
  };

  const handleClick = () => {
    if (Math.abs(translateX) < 10) {
      onStartChat();
    }
  };

  return (
    <>
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">{displayName}</span> from your contacts? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <PublicProfileCard 
            profile={profileData}
            showMessageButton
            onMessageClick={() => {
              setShowProfileDialog(false);
              onStartChat();
            }}
          />
        </DialogContent>
      </Dialog>

      <div 
        ref={containerRef}
        className="relative overflow-hidden border-b border-border/50"
      >
        {/* Left action (Sound Toggle) - shown when swiping right */}
        <div 
          className={cn(
            "absolute inset-y-0 left-0 flex items-center justify-start px-4 transition-opacity",
            soundEnabled ? "bg-amber-500" : "bg-primary",
            translateX > 20 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={() => handleActionClick('sound')}
            className="flex flex-col items-center gap-1 text-white"
          >
            {soundEnabled ? (
              <>
                <VolumeX className="w-6 h-6" />
                <span className="text-xs font-medium">Mute</span>
              </>
            ) : (
              <>
                <Volume2 className="w-6 h-6" />
                <span className="text-xs font-medium">Unmute</span>
              </>
            )}
          </button>
        </div>

        {/* Right action (Delete) - shown when swiping left */}
        <div 
          className={cn(
            "absolute inset-y-0 right-0 flex items-center justify-end px-4 bg-destructive transition-opacity",
            translateX < -20 ? "opacity-100" : "opacity-0"
          )}
          style={{ width: MAX_SWIPE }}
        >
          <button
            onClick={() => handleActionClick('delete')}
            className="flex flex-col items-center gap-1 text-destructive-foreground"
          >
            <Trash2 className="w-6 h-6" />
            <span className="text-xs font-medium">Delete</span>
          </button>
        </div>

        {/* Main content */}
        <div
          className={cn(
            "flex items-center gap-3 px-4 py-3 bg-background cursor-pointer",
            !isDragging && "transition-transform duration-200"
          )}
          style={{ transform: `translateX(${translateX}px)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          {/* Avatar */}
          <Avatar 
            className="w-12 h-12 flex-shrink-0 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
            onClick={handleAvatarClick}
          >
            <AvatarImage src={contact.profiles?.avatar_url || undefined} />
            <AvatarFallback className={`${avatarColor} text-white font-semibold`}>
              {displayName[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-semibold truncate text-foreground">
                  {displayName} {emoji}
                </h3>
                {!soundEnabled && (
                  <BellOff className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <span className="text-xs text-muted-foreground">
                  {new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite(e);
                  }}
                  className="p-1 hover:bg-muted/50 rounded-full transition-colors"
                >
                  <Star 
                    className={cn(
                      "w-4 h-4 transition-colors",
                      contact.is_favourite 
                        ? "fill-yellow-400 text-yellow-400" 
                        : "text-muted-foreground hover:text-yellow-400"
                    )} 
                  />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground truncate flex-1">
                {statusMsg}
              </p>
              {unreadCount > 0 && (
                <Badge className="bg-accent text-accent-foreground rounded-full w-5 h-5 flex items-center justify-center p-0 text-xs ml-2">
                  {unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SwipeableContactItem;

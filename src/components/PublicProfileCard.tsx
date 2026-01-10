import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, MapPin, Twitter, Linkedin, Instagram, Globe, ExternalLink, Share2, Check, QrCode, BadgeCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { OnlineStatusDot, LastSeenStatus } from "@/hooks/useOnlinePresence";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PublicProfileCardProps {
  profile: {
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
    user_id?: string;
    is_verified?: boolean | null;
  };
  showMessageButton?: boolean;
  onMessageClick?: () => void;
}

export const PublicProfileCard = ({ 
  profile, 
  showMessageButton = false,
  onMessageClick 
}: PublicProfileCardProps) => {
  const [copied, setCopied] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const hasSocialLinks = profile.twitter_url || profile.linkedin_url || profile.instagram_url || profile.website_url;
  const profileUrl = `${window.location.origin}/profile/${profile.username}`;

  const handleShare = async () => {
    const shareData = {
      title: `${profile.display_name}'s Profile`,
      text: `Check out ${profile.display_name}'s profile on Nexora`,
      url: profileUrl,
    };

    // Try native share first (mobile devices)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to clipboard
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Profile link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to share profile");
    }
  };

  const socialLinks = [
    {
      url: profile.twitter_url,
      icon: Twitter,
      label: "Twitter",
      color: "hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/10"
    },
    {
      url: profile.linkedin_url,
      icon: Linkedin,
      label: "LinkedIn",
      color: "hover:text-[#0A66C2] hover:bg-[#0A66C2]/10"
    },
    {
      url: profile.instagram_url,
      icon: Instagram,
      label: "Instagram",
      color: "hover:text-[#E4405F] hover:bg-[#E4405F]/10"
    },
    {
      url: profile.website_url,
      icon: Globe,
      label: "Website",
      color: "hover:text-primary hover:bg-primary/10"
    }
  ];

  return (
    <Card className="w-full max-w-md mx-auto overflow-hidden">
      {/* Header with gradient background */}
      <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent relative">
        <div className="absolute top-2 right-2 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowQRDialog(true)}
            className="h-8 w-8 bg-background/80 hover:bg-background"
            title="Show QR code"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="h-8 w-8 bg-background/80 hover:bg-background"
            title="Share profile"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-center">Scan to view profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG 
                value={profileUrl} 
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              @{profile.username}
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(profileUrl);
                toast.success("Link copied!");
              }}
            >
              <Share2 className="w-4 h-4 mr-2" />
              Copy Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      <CardHeader className="relative pt-0 pb-4">
        {/* Avatar overlapping the header */}
        <div className="-mt-12 flex justify-center">
          <div className="relative">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
              <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                {profile.display_name ? profile.display_name[0].toUpperCase() : <User className="w-8 h-8" />}
              </AvatarFallback>
            </Avatar>
            {profile.user_id && (
              <OnlineStatusDot 
                userId={profile.user_id} 
                size="lg"
                className="absolute bottom-1 right-1"
              />
            )}
          </div>
        </div>
        
        {/* Name and username */}
        <div className="text-center mt-3 space-y-1">
          <h2 className="text-xl font-bold flex items-center justify-center gap-1.5">
            {profile.display_name}
            {profile.is_verified && (
              <BadgeCheck className="w-5 h-5 text-primary fill-primary/20" />
            )}
          </h2>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.user_id && (
            <LastSeenStatus userId={profile.user_id} className="block" />
          )}
        </div>

        {/* Status badge */}
        {profile.status && (
          <div className="flex justify-center mt-2">
            <Badge variant="secondary" className="max-w-[200px] truncate">
              {profile.status}
            </Badge>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Bio */}
        {profile.bio && (
          <p className="text-sm text-center text-muted-foreground">{profile.bio}</p>
        )}

        {/* Location */}
        {profile.location && (
          <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span>{profile.location}</span>
          </div>
        )}

        {/* Social Links */}
        {hasSocialLinks && (
          <div className="flex items-center justify-center gap-2 pt-2">
            {socialLinks.map((link) => {
              if (!link.url) return null;
              
              const Icon = link.icon;
              return (
                <a
                  key={link.label}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={link.label}
                  className={`p-2.5 rounded-full bg-muted/50 text-muted-foreground transition-colors ${link.color}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="sr-only">{link.label}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Message Button */}
        {showMessageButton && onMessageClick && (
          <Button onClick={onMessageClick} className="w-full mt-4">
            <ExternalLink className="w-4 h-4 mr-2" />
            Send Message
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

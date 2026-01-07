import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, MapPin, Twitter, Linkedin, Instagram, Globe, ExternalLink } from "lucide-react";

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
  };
  showMessageButton?: boolean;
  onMessageClick?: () => void;
}

export const PublicProfileCard = ({ 
  profile, 
  showMessageButton = false,
  onMessageClick 
}: PublicProfileCardProps) => {
  const hasSocialLinks = profile.twitter_url || profile.linkedin_url || profile.instagram_url || profile.website_url;

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
      <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
      
      <CardHeader className="relative pt-0 pb-4">
        {/* Avatar overlapping the header */}
        <div className="-mt-12 flex justify-center">
          <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
            <AvatarImage src={profile.avatar_url || undefined} alt={profile.display_name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {profile.display_name ? profile.display_name[0].toUpperCase() : <User className="w-8 h-8" />}
            </AvatarFallback>
          </Avatar>
        </div>
        
        {/* Name and username */}
        <div className="text-center mt-3 space-y-1">
          <h2 className="text-xl font-bold">{profile.display_name}</h2>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
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

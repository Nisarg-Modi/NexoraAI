import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PublicProfileCard } from "@/components/PublicProfileCard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserX } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProfileData {
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
  user_id: string;
}

const PublicProfile = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) {
        setError("No username provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("display_name, username, avatar_url, bio, status, location, twitter_url, linkedin_url, instagram_url, website_url, user_id, is_verified")
          .eq("username", username)
          .single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            setError("Profile not found");
          } else {
            setError("Failed to load profile");
          }
        } else {
          setProfile(data);
        }
      } catch (err) {
        setError("An error occurred");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  const handleStartChat = async () => {
    if (!user || !profile) return;
    
    // Navigate to main app - the chat will be started there
    navigate("/", { state: { startChatWith: { userId: profile.user_id, name: profile.display_name } } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
            <UserX className="w-10 h-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{error || "Profile not found"}</h1>
          <p className="text-muted-foreground">
            The profile you're looking for doesn't exist or may have been removed.
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.user_id;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="ml-3 font-semibold">Profile</h1>
        </div>
      </header>

      {/* Profile Content */}
      <main className="container max-w-2xl mx-auto px-4 py-8">
        <PublicProfileCard
          profile={profile}
          showMessageButton={!!user && !isOwnProfile}
          onMessageClick={handleStartChat}
        />
      </main>
    </div>
  );
};

export default PublicProfile;

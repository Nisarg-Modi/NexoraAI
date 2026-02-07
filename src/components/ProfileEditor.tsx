import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, Upload, User, Loader2, MessageSquare, Users, Calendar as CalendarIcon, Sparkles, CheckCircle2, MapPin, Twitter, Linkedin, Instagram, Globe, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Camera as CapacitorCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { NotificationSettings } from "./NotificationSettings";
import { DoNotDisturbSettings } from "./DoNotDisturbSettings";
import { LanguageSettings } from "./LanguageSettings";
import { BadgeRequestForm } from "./BadgeRequestForm";
import { EmojiPickerButton } from "@/components/ui/emoji-picker-button";
import { countries } from "@/data/countries";
import { cn } from "@/lib/utils";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface QuickStats {
  contactsCount: number;
  conversationsCount: number;
  meetingsCount: number;
}

interface UrlErrors {
  twitter_url?: string;
  linkedin_url?: string;
  instagram_url?: string;
  website_url?: string;
}

const validateUrl = (url: string, platform?: string): string | undefined => {
  if (!url.trim()) return undefined;
  
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL must start with http:// or https://';
    }
    
    if (platform === 'twitter' && !parsed.hostname.match(/^(www\.)?(twitter\.com|x\.com)$/)) {
      return 'Please enter a valid Twitter/X URL';
    }
    if (platform === 'linkedin' && !parsed.hostname.match(/^(www\.)?linkedin\.com$/)) {
      return 'Please enter a valid LinkedIn URL';
    }
    if (platform === 'instagram' && !parsed.hostname.match(/^(www\.)?instagram\.com$/)) {
      return 'Please enter a valid Instagram URL';
    }
    
    return undefined;
  } catch {
    return 'Please enter a valid URL';
  }
};

interface ProfileEditorProps {
  onNavigateToContacts?: () => void;
}

export const ProfileEditor = ({ onNavigateToContacts }: ProfileEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [urlErrors, setUrlErrors] = useState<UrlErrors>({});
  const [stats, setStats] = useState<QuickStats>({ contactsCount: 0, conversationsCount: 0, meetingsCount: 0 });
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState("");
  const [profile, setProfile] = useState({
    display_name: "",
    status: "",
    avatar_url: "",
    username: "",
    bio: "",
    gender: "",
    date_of_birth: null as Date | null,
    location: "",
    twitter_url: "",
    linkedin_url: "",
    instagram_url: "",
    website_url: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
    loadStats();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, status, avatar_url, username, bio, gender, date_of_birth, location, twitter_url, linkedin_url, instagram_url, website_url')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          display_name: data.display_name || "",
          status: data.status || "",
          avatar_url: data.avatar_url || "",
          username: data.username || "",
          bio: data.bio || "",
          gender: data.gender || "",
          date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
          location: data.location || "",
          twitter_url: data.twitter_url || "",
          linkedin_url: data.linkedin_url || "",
          instagram_url: data.instagram_url || "",
          website_url: data.website_url || ""
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get contacts count
      const { count: contactsCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get conversations count
      const { count: conversationsCount } = await supabase
        .from('conversation_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      // Get meetings count
      const { count: meetingsCount } = await supabase
        .from('meeting_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        contactsCount: contactsCount || 0,
        conversationsCount: conversationsCount || 0,
        meetingsCount: meetingsCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleImageUpload = async (source: 'camera' | 'gallery') => {
    try {
      setUploading(true);
      
      const image = await CapacitorCamera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        width: 500,
        height: 500
      });

      if (!image.dataUrl) {
        throw new Error('No image data received');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Convert data URL to blob
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      
      const fileName = `${Date.now()}.${image.format}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, {
          contentType: `image/${image.format}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));

      toast({
        title: "Image uploaded",
        description: "Your profile picture has been updated"
      });
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const validateAllUrls = (): boolean => {
    const errors: UrlErrors = {
      twitter_url: validateUrl(profile.twitter_url, 'twitter'),
      linkedin_url: validateUrl(profile.linkedin_url, 'linkedin'),
      instagram_url: validateUrl(profile.instagram_url, 'instagram'),
      website_url: validateUrl(profile.website_url)
    };
    
    setUrlErrors(errors);
    return !Object.values(errors).some(error => error !== undefined);
  };

  const handleUrlChange = (field: keyof UrlErrors, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (urlErrors[field]) {
      setUrlErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleUrlBlur = (field: keyof UrlErrors, platform?: string) => {
    const error = validateUrl(profile[field], platform);
    setUrlErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleSave = async () => {
    if (!validateAllUrls()) {
      toast({
        title: "Validation Error",
        description: "Please fix the invalid URLs before saving.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name.trim(),
          status: profile.status.trim(),
          avatar_url: profile.avatar_url,
          bio: profile.bio.trim(),
          gender: profile.gender || null,
          date_of_birth: profile.date_of_birth ? format(profile.date_of_birth, 'yyyy-MM-dd') : null,
          location: profile.location.trim() || null,
          twitter_url: profile.twitter_url.trim() || null,
          linkedin_url: profile.linkedin_url.trim() || null,
          instagram_url: profile.instagram_url.trim() || null,
          website_url: profile.website_url.trim() || null
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile has been saved successfully"
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getProfileCompletion = () => {
    const fields = [
      { name: "Display Name", filled: !!profile.display_name.trim() },
      { name: "Username", filled: !!profile.username.trim() },
      { name: "Profile Picture", filled: !!profile.avatar_url },
      { name: "Status", filled: !!profile.status.trim() },
      { name: "Bio", filled: !!profile.bio.trim() },
      { name: "Gender", filled: !!profile.gender },
      { name: "Birthday", filled: !!profile.date_of_birth },
      { name: "Location", filled: !!profile.location.trim() }
    ];
    
    const filledCount = fields.filter(f => f.filled).length;
    const percentage = Math.round((filledCount / fields.length) * 100);
    
    return { fields, filledCount, total: fields.length, percentage };
  };

  const completion = getProfileCompletion();

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl p-4 sm:p-6 border border-primary/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">
              {getGreeting()}, {profile.display_name || "there"}! 👋
            </h2>
            <p className="text-sm text-muted-foreground">Welcome back to Nexora</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4">
          <div className="bg-card/50 rounded-lg p-3 text-center border border-border/50 cursor-pointer hover:bg-card/70 transition-colors" onClick={onNavigateToContacts}>
            <div className="flex justify-center mb-1">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <p className="text-lg sm:text-xl font-bold">{stats.contactsCount}</p>
            <p className="text-xs text-muted-foreground">Contacts</p>
          </div>
          <div 
            className="bg-card/50 rounded-lg p-3 text-center border border-border/50 cursor-pointer hover:bg-card/70 transition-colors"
            onClick={onNavigateToContacts}
          >
            <div className="flex justify-center mb-1">
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <p className="text-lg sm:text-xl font-bold">{stats.conversationsCount}</p>
            <p className="text-xs text-muted-foreground">Chats</p>
          </div>
          <div className="bg-card/50 rounded-lg p-3 text-center border border-border/50">
            <div className="flex justify-center mb-1">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
            <p className="text-lg sm:text-xl font-bold">{stats.meetingsCount}</p>
            <p className="text-xs text-muted-foreground">Meetings</p>
          </div>
        </div>
      </div>

      {/* Profile Completion Indicator */}
      <div className="bg-card rounded-xl p-4 sm:p-6 border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className={`w-5 h-5 ${completion.percentage === 100 ? 'text-green-500' : 'text-primary'}`} />
            <h3 className="font-semibold">Profile Completion</h3>
          </div>
          <span className={`text-lg font-bold ${completion.percentage === 100 ? 'text-green-500' : 'text-primary'}`}>
            {completion.percentage}%
          </span>
        </div>
        
        <Progress value={completion.percentage} className="h-2" />
        
        <div className="flex flex-wrap gap-2">
          {completion.fields.map((field) => (
            <div
              key={field.name}
              className={`px-2 py-1 rounded-full text-xs flex items-center gap-1 ${
                field.filled 
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {field.filled && <CheckCircle2 className="w-3 h-3" />}
              {field.name}
            </div>
          ))}
        </div>
        
        {completion.percentage < 100 && (
          <p className="text-xs text-muted-foreground">
            Complete your profile to help others recognize you!
          </p>
        )}
        
        {completion.percentage === 100 && (
          <p className="text-xs text-green-600 dark:text-green-400">
            🎉 Great job! Your profile is complete!
          </p>
        )}
      </div>

      <div className="text-center space-y-2 sm:space-y-4">
        <h2 className="text-xl sm:text-2xl font-bold">Edit Profile</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Update your profile picture and status</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center gap-3 sm:gap-4 p-4 sm:p-6 bg-card rounded-lg border border-border">
        <Avatar className="w-24 h-24 sm:w-32 sm:h-32">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl sm:text-3xl">
            {profile.display_name ? profile.display_name[0].toUpperCase() : <User className="w-8 h-8 sm:w-12 sm:h-12" />}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleImageUpload('camera')}
            disabled={uploading}
            className="text-xs sm:text-sm"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            )}
            Camera
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleImageUpload('gallery')}
            disabled={uploading}
            className="text-xs sm:text-sm"
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Gallery
          </Button>
        </div>
      </div>

      {/* Profile Details */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={profile.username}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">Username cannot be changed</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input
            id="display_name"
            value={profile.display_name}
            onChange={(e) => setProfile(prev => ({ ...prev, display_name: e.target.value }))}
            placeholder="Enter your display name"
            maxLength={50}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={profile.gender}
            onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select your gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non-binary">Non-binary</SelectItem>
              <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date of Birth</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !profile.date_of_birth && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {profile.date_of_birth ? format(profile.date_of_birth, "PPP") : <span>Pick your date of birth</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50 bg-background border border-border shadow-lg" align="start">
              <Calendar
                mode="single"
                selected={profile.date_of_birth || undefined}
                onSelect={(date) => setProfile(prev => ({ ...prev, date_of_birth: date || null }))}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                captionLayout="dropdown"
                fromYear={1920}
                toYear={new Date().getFullYear()}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Popover open={locationOpen} onOpenChange={setLocationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={locationOpen}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !profile.location && "text-muted-foreground"
                )}
              >
                <MapPin className="mr-2 h-4 w-4" />
                {profile.location || "Select your country"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0 z-50 bg-background border border-border shadow-lg" align="start">
              <Command className="bg-background">
                <CommandInput 
                  placeholder="Search country..." 
                  value={locationSearch}
                  onValueChange={setLocationSearch}
                  className="border-0"
                />
                <CommandList className="max-h-60">
                  <CommandEmpty>No country found.</CommandEmpty>
                  <CommandGroup>
                    {countries.map((country) => (
                      <CommandItem
                        key={country.code}
                        value={country.name}
                        onSelect={(value) => {
                          setProfile(prev => ({ ...prev, location: value }));
                          setLocationOpen(false);
                          setLocationSearch("");
                        }}
                        className="cursor-pointer"
                      >
                        <span>{country.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={profile.bio}
            onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
            placeholder="Tell others about yourself..."
            maxLength={300}
            rows={4}
          />
          <p className="text-xs text-muted-foreground">
            {profile.bio.length}/300 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <div className="relative">
            <Textarea
              id="status"
              value={profile.status}
              onChange={(e) => setProfile(prev => ({ ...prev, status: e.target.value }))}
              placeholder="What's on your mind? 😊"
              maxLength={150}
              rows={2}
              className="pr-12"
            />
            <div className="absolute right-2 top-2">
              <EmojiPickerButton
                onEmojiSelect={(emoji) => {
                  if (profile.status.length + emoji.length <= 150) {
                    setProfile(prev => ({ ...prev, status: prev.status + emoji }));
                  }
                }}
                size="sm"
                className="h-8 w-8"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {profile.status.length}/150 characters
          </p>
        </div>

        {/* Social Links Section */}
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Social Links</h3>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="twitter_url">Twitter / X</Label>
            <div className="relative">
              <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="twitter_url"
                value={profile.twitter_url}
                onChange={(e) => handleUrlChange('twitter_url', e.target.value)}
                onBlur={() => handleUrlBlur('twitter_url', 'twitter')}
                placeholder="https://twitter.com/username"
                className={cn("pl-10", urlErrors.twitter_url && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            {urlErrors.twitter_url && (
              <p className="text-xs text-destructive">{urlErrors.twitter_url}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin_url">LinkedIn</Label>
            <div className="relative">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="linkedin_url"
                value={profile.linkedin_url}
                onChange={(e) => handleUrlChange('linkedin_url', e.target.value)}
                onBlur={() => handleUrlBlur('linkedin_url', 'linkedin')}
                placeholder="https://linkedin.com/in/username"
                className={cn("pl-10", urlErrors.linkedin_url && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            {urlErrors.linkedin_url && (
              <p className="text-xs text-destructive">{urlErrors.linkedin_url}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="instagram_url">Instagram</Label>
            <div className="relative">
              <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="instagram_url"
                value={profile.instagram_url}
                onChange={(e) => handleUrlChange('instagram_url', e.target.value)}
                onBlur={() => handleUrlBlur('instagram_url', 'instagram')}
                placeholder="https://instagram.com/username"
                className={cn("pl-10", urlErrors.instagram_url && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            {urlErrors.instagram_url && (
              <p className="text-xs text-destructive">{urlErrors.instagram_url}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="website_url">Website</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="website_url"
                value={profile.website_url}
                onChange={(e) => handleUrlChange('website_url', e.target.value)}
                onBlur={() => handleUrlBlur('website_url')}
                placeholder="https://yourwebsite.com"
                className={cn("pl-10", urlErrors.website_url && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            {urlErrors.website_url && (
              <p className="text-xs text-destructive">{urlErrors.website_url}</p>
            )}
          </div>
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          "Save Profile"
        )}
      </Button>

      {/* Badge Request */}
      <BadgeRequestForm />

      {/* Language Settings */}
      <LanguageSettings />

      {/* Notification Settings */}
      <NotificationSettings />

      {/* Do Not Disturb Settings */}
      <DoNotDisturbSettings />
    </div>
  );
};

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Plus, Sparkles, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import CreateGroupDialog from "./CreateGroupDialog";
import NexoraAIChat from "./NexoraAIChat";
import { cn } from "@/lib/utils";
import { playNotificationSound } from "@/utils/notificationSound";
import SwipeableContactItem from "./SwipeableContactItem";
import SwipeableGroupItem from "./SwipeableGroupItem";

interface Contact {
  id: string;
  contact_user_id: string;
  contact_name: string | null;
  is_favourite: boolean;
  notification_sound_enabled?: boolean;
  profiles: {
    display_name: string | null;
    status: string | null;
    avatar_url: string | null;
    is_verified?: boolean | null;
  };
}

interface GroupConversation {
  id: string;
  group_name: string;
  group_avatar_url: string | null;
  participant_count: number;
  is_muted?: boolean;
}

const avatarColors = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-indigo-500',
  'bg-red-500',
];

const contactEmojis = ['👋', '💬', '🎉', '✨', '🔥', '💡', '🚀', '🌟'];
const statusMessages = [
  'Hey there! 👋',
  'Available to chat 💬',
  'Busy right now ⏰',
  'At work 💼',
  'Sleeping 😴',
  'Online 🟢',
];

interface ContactsListProps {
  onStartChat: (contactUserId: string, contactName: string) => void;
  onStartGroupChat: (conversationId: string, groupName: string) => void;
}

const usernameSchema = z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long").regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

const ContactsList = ({ onStartChat, onStartGroupChat }: ContactsListProps) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [conversationMap, setConversationMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [username, setUsername] = useState("");
  const [contactName, setContactName] = useState("");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'favourites' | 'groups'>('all');
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [globalSoundEnabled, setGlobalSoundEnabled] = useState(true);
  const [dndSettings, setDndSettings] = useState({
    dnd_enabled: false,
    dnd_start_time: "22:00:00",
    dnd_end_time: "07:00:00",
  });
  const { toast } = useToast();

  const currentUserIdRef = useRef<string | null>(null);
  const contactsRef = useRef<Contact[]>([]);
  const groupsRef = useRef<GroupConversation[]>([]);
  const conversationMapRef = useRef<Record<string, string>>({});
  const globalSoundEnabledRef = useRef(true);

  // Keep refs in sync with state
  useEffect(() => {
    contactsRef.current = contacts;
  }, [contacts]);

  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);

  useEffect(() => {
    conversationMapRef.current = conversationMap;
  }, [conversationMap]);

  useEffect(() => {
    globalSoundEnabledRef.current = globalSoundEnabled;
  }, [globalSoundEnabled]);

  // Check if currently in DND period
  const isInDNDPeriod = useCallback((): boolean => {
    if (!dndSettings.dnd_enabled) return false;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = dndSettings.dnd_start_time.split(':').map(Number);
    const [endHour, endMin] = dndSettings.dnd_end_time.split(':').map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    // Handle overnight periods (e.g., 22:00 to 07:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    } else {
      return currentTime >= startTime && currentTime < endTime;
    }
  }, [dndSettings]);

  useEffect(() => {
    const initUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        currentUserIdRef.current = userData.user.id;
        
        // Fetch global sound and DND settings
        const { data: profileData } = await supabase
          .from('profiles')
          .select('notification_sound_enabled, dnd_enabled, dnd_start_time, dnd_end_time')
          .eq('user_id', userData.user.id)
          .single();
        
        setGlobalSoundEnabled(profileData?.notification_sound_enabled ?? true);
        setDndSettings({
          dnd_enabled: profileData?.dnd_enabled ?? false,
          dnd_start_time: profileData?.dnd_start_time ?? "22:00:00",
          dnd_end_time: profileData?.dnd_end_time ?? "07:00:00",
        });
      }
    };
    initUser();
  }, []);

  // Initial data fetch - only run once on mount
  useEffect(() => {
    fetchContacts();
    fetchGroups();
    fetchUnreadCounts();
  }, []);

  // Separate effect for realtime subscription - using refs to avoid re-subscribing
  useEffect(() => {
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          // Refresh unread counts when a new message arrives
          fetchUnreadCounts();
          
          // Play notification sound if message is from someone else and sounds are enabled
          const newMessage = payload.new as { sender_id: string; conversation_id: string };
          
          // Use refs to get current values without triggering re-subscription
          if (newMessage.sender_id !== currentUserIdRef.current && globalSoundEnabledRef.current && !isInDNDPeriod()) {
            // Find the contact to check their sound setting
            const contact = contactsRef.current.find(c => 
              conversationMapRef.current[c.contact_user_id] === newMessage.conversation_id
            );
            
            // Check if this is a group message
            const group = groupsRef.current.find(g => g.id === newMessage.conversation_id);
            
            // For contacts, check per-contact sound setting
            if (contact && contact.notification_sound_enabled !== false) {
              playNotificationSound();
            } 
            // For groups, check muted setting  
            else if (group && !group.is_muted) {
              playNotificationSound();
            }
            // If no contact or group found but not from self, still play
            else if (!contact && !group) {
              playNotificationSound();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refresh when messages are marked as read
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isInDNDPeriod]);

  const fetchUnreadCounts = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase.rpc('get_unread_counts', {
        user_uuid: userData.user.id
      });

      if (error) {
        console.error('Error fetching unread counts:', error);
        return;
      }

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((item: { conversation_id: string; unread_count: number }) => {
          counts[item.conversation_id] = Number(item.unread_count);
        });
        setUnreadCounts(counts);
      }
    } catch (error) {
      console.error('Error in fetchUnreadCounts:', error);
    }
  };

  const fetchContacts = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data, error } = await supabase
      .from('contacts')
      .select('*, notification_sound_enabled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
      return;
    }

    // Fetch profile data and conversation IDs for each contact
    if (data) {
      const convMap: Record<string, string> = {};
      
      const contactsWithProfiles = await Promise.all(
        data.map(async (contact) => {
          // Fetch profile with is_verified field
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, status, avatar_url, username, bio, location, twitter_url, linkedin_url, instagram_url, website_url, is_verified')
            .eq('user_id', contact.contact_user_id)
            .single();

          // Get conversation ID for this contact
          const { data: convData } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userData.user.id);

          if (convData) {
            for (const cp of convData) {
              const { data: otherParticipants } = await supabase
                .from('conversation_participants')
                .select('user_id, conversations!inner(is_group)')
                .eq('conversation_id', cp.conversation_id)
                .eq('conversations.is_group', false);

              const isMatch = otherParticipants?.some(p => p.user_id === contact.contact_user_id);
              if (isMatch && otherParticipants && otherParticipants.length === 2) {
                convMap[contact.contact_user_id] = cp.conversation_id;
                break;
              }
            }
          }

          return {
            ...contact,
            is_favourite: contact.is_favourite || false,
            notification_sound_enabled: contact.notification_sound_enabled ?? true,
            profiles: profile || {
              display_name: null,
              status: null,
              avatar_url: null,
              is_verified: false,
            },
          };
        })
      );
      setContacts(contactsWithProfiles);
      setConversationMap(convMap);
    }
  };

  const addContact = async () => {
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Please enter a username",
        variant: "destructive",
      });
      return;
    }

    try {
      usernameSchema.parse(username);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Invalid username",
          description: error.errors[0].message,
          variant: "destructive",
        });
      }
      return;
    }

    setLoading(true);

    try {
      // Find user by username using secure function
      const { data: profileData, error: profileError } = await supabase
        .rpc('find_user_by_username', { input_username: username.trim() });

      if (profileError || !profileData || profileData.length === 0) {
        toast({
          title: "User not found",
          description: "No Nexora user found with this username",
          variant: "destructive",
        });
        return;
      }

      const userData = profileData[0];

      // Check if trying to add themselves
      const { data: currentUser } = await supabase.auth.getUser();
      if (!currentUser.user) return;

      if (userData.user_id === currentUser.user.id) {
        toast({
          title: "Cannot add yourself",
          description: "You cannot add yourself as a contact",
          variant: "destructive",
        });
        return;
      }

      const { error: contactError } = await supabase
        .from('contacts')
        .insert({
          user_id: currentUser.user.id,
          contact_user_id: userData.user_id,
          contact_name: contactName.trim() || userData.display_name,
        });

      if (contactError) {
        if (contactError.code === '23505') {
          toast({
            title: "Already added",
            description: "This contact is already in your list",
            variant: "destructive",
          });
        } else if (contactError.message?.toLowerCase().includes('rate limit') || 
                   contactError.message?.toLowerCase().includes('check_contact_rate_limit')) {
          toast({
            title: "Rate limit reached",
            description: "You've added 10 contacts in the last hour. Please try again later.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Failed to add contact. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Contact added!",
          description: `${contactName || userData.display_name} has been added to your contacts`,
        });
        setUsername("");
        setContactName("");
        setDialogOpen(false);
        fetchContacts();
      }
    } catch (error) {
      console.error('Error adding contact:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          is_muted,
          conversations!inner (
            id,
            group_name,
            group_avatar_url,
            is_group
          )
        `)
        .eq('user_id', userData.user.id);

      if (error) {
        console.error('Error fetching groups:', error);
        return;
      }

      if (data) {
        // Filter and format group conversations
        const groupConversations = await Promise.all(
          data
            .filter(item => item.conversations?.is_group)
            .map(async (item) => {
              const conv = item.conversations;
              
              // Count participants
              const { count } = await supabase
                .from('conversation_participants')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conv.id);

              return {
                id: conv.id,
                group_name: conv.group_name || 'Unnamed Group',
                group_avatar_url: conv.group_avatar_url,
                participant_count: count || 0,
                is_muted: item.is_muted || false,
              };
            })
        );
        setGroups(groupConversations);
      }
    } catch (error) {
      console.error('Error in fetchGroups:', error);
    }
  };

  const toggleFavourite = async (contactId: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering chat
    
    const { error } = await supabase
      .from('contacts')
      .update({ is_favourite: !currentState })
      .eq('id', contactId);

    if (error) {
      console.error('Error toggling favourite:', error);
      toast({
        title: 'Error',
        description: 'Failed to update favourite status',
        variant: 'destructive',
      });
      return;
    }

    // Update local state
    setContacts(prev => 
      prev.map(c => c.id === contactId ? { ...c, is_favourite: !currentState } : c)
    );
  };

  const deleteContact = async (contactId: string) => {
    // Find the contact before removing it (for undo)
    const contactToDelete = contacts.find(c => c.id === contactId);
    if (!contactToDelete) return;

    // Optimistically remove from UI
    setContacts(prev => prev.filter(c => c.id !== contactId));

    // Show toast with undo action
    toast({
      title: 'Contact deleted',
      description: `${contactToDelete.contact_name || contactToDelete.profiles?.display_name || 'Contact'} has been removed`,
      action: (
        <button
          onClick={async () => {
            // Restore the contact
            const { error } = await supabase
              .from('contacts')
              .insert({
                id: contactToDelete.id,
                user_id: (await supabase.auth.getUser()).data.user?.id,
                contact_user_id: contactToDelete.contact_user_id,
                contact_name: contactToDelete.contact_name,
                is_favourite: contactToDelete.is_favourite,
              });

            if (!error) {
              setContacts(prev => [...prev, contactToDelete]);
              toast({ title: 'Contact restored' });
            }
          }}
          className="px-3 py-1 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Undo
        </button>
      ),
    });

    // Actually delete from database
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (error) {
      console.error('Error deleting contact:', error);
      // Restore on error
      setContacts(prev => [...prev, contactToDelete]);
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
    }
  };

  const toggleContactSound = async (contactId: string, contactUserId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const contact = contacts.find(c => c.id === contactId);
    const newSoundState = !(contact?.notification_sound_enabled ?? true);

    // Optimistically update UI
    setContacts(prev => 
      prev.map(c => c.id === contactId ? { ...c, notification_sound_enabled: newSoundState } : c)
    );

    // Persist to database
    const { error } = await supabase
      .from('contacts')
      .update({ notification_sound_enabled: newSoundState })
      .eq('id', contactId);

    if (error) {
      console.error('Error updating sound setting:', error);
      // Revert on error
      setContacts(prev => 
        prev.map(c => c.id === contactId ? { ...c, notification_sound_enabled: !newSoundState } : c)
      );
      toast({
        title: 'Error',
        description: 'Failed to update notification setting',
        variant: 'destructive',
      });
      return;
    }
    
    toast({
      title: newSoundState ? 'Sound enabled' : 'Sound muted',
      description: newSoundState 
        ? 'You\'ll hear notification sounds from this contact' 
        : 'Notifications from this contact are now muted',
    });
  };

  const leaveGroup = async (groupId: string, groupName: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    // Find the group before removing it (for undo)
    const groupToLeave = groups.find(g => g.id === groupId);
    if (!groupToLeave) return;

    // Optimistically remove from UI
    setGroups(prev => prev.filter(g => g.id !== groupId));

    // Show toast with undo action
    toast({
      title: 'Left group',
      description: `You left ${groupName}`,
      action: (
        <button
          onClick={async () => {
            // Rejoin the group
            const { error } = await supabase
              .from('conversation_participants')
              .insert({
                conversation_id: groupId,
                user_id: userData.user.id,
              });

            if (!error) {
              setGroups(prev => [...prev, groupToLeave]);
              toast({ title: 'Rejoined group' });
            }
          }}
          className="px-3 py-1 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Undo
        </button>
      ),
    });

    // Actually leave the group
    const { error } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', groupId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error leaving group:', error);
      // Restore on error
      setGroups(prev => [...prev, groupToLeave]);
      toast({
        title: 'Error',
        description: 'Failed to leave group',
        variant: 'destructive',
      });
    }
  };

  const toggleMuteGroup = async (groupId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const group = groups.find(g => g.id === groupId);
    const newMuteState = !group?.is_muted;

    // Optimistically update UI
    setGroups(prev => 
      prev.map(g => g.id === groupId ? { ...g, is_muted: newMuteState } : g)
    );

    // Persist to database
    const { error } = await supabase
      .from('conversation_participants')
      .update({ is_muted: newMuteState })
      .eq('conversation_id', groupId)
      .eq('user_id', userData.user.id);

    if (error) {
      console.error('Error updating mute setting:', error);
      // Revert on error
      setGroups(prev => 
        prev.map(g => g.id === groupId ? { ...g, is_muted: !newMuteState } : g)
      );
      toast({
        title: 'Error',
        description: 'Failed to update mute setting',
        variant: 'destructive',
      });
      return;
    }
    
    toast({
      title: newMuteState ? 'Group muted' : 'Group unmuted',
      description: newMuteState 
        ? 'You won\'t receive notifications from this group' 
        : 'You\'ll receive notifications from this group',
    });
  };

  const filteredContacts = contacts.filter(contact => {
    const name = contact.contact_name || contact.profiles?.display_name || '';
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.toLowerCase().includes(query);
    
    // Apply favourites filter
    if (activeFilter === 'favourites') {
      return matchesSearch && contact.is_favourite;
    }
    
    // Apply unread filter
    if (activeFilter === 'unread') {
      const conversationId = conversationMap[contact.contact_user_id];
      const hasUnread = conversationId ? (unreadCounts[conversationId] || 0) > 0 : false;
      return matchesSearch && hasUnread;
    }
    
    return matchesSearch;
  });

  const filteredGroups = groups.filter(group => {
    const query = searchQuery.toLowerCase();
    return group.group_name.toLowerCase().includes(query);
  });

  const getAvatarColor = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return avatarColors[index % avatarColors.length];
  };

  const getRandomEmoji = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return contactEmojis[index % contactEmojis.length];
  };

  const getStatusMessage = (userId: string) => {
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return statusMessages[index % statusMessages.length];
  };

  // Get display items based on active filter
  const getDisplayItems = () => {
    if (activeFilter === 'groups') {
      return { contacts: [], groups: filteredGroups };
    }
    return { contacts: filteredContacts, groups: [] };
  };

  const { contacts: displayContacts, groups: displayGroups } = getDisplayItems();

  const filterButtons = [
    { key: 'all' as const, label: 'All' },
    { key: 'unread' as const, label: 'Unread' },
    { key: 'favourites' as const, label: 'Favourites' },
    { key: 'groups' as const, label: 'Groups' },
  ];

  // Handle AI query submission
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      // Check if it looks like an AI query (starts with question words or contains "?")
      const aiTriggers = ['what', 'how', 'why', 'when', 'where', 'who', 'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does', 'tell', 'explain', 'help'];
      const queryLower = searchQuery.toLowerCase().trim();
      const isAIQuery = queryLower.includes('?') || aiTriggers.some(trigger => queryLower.startsWith(trigger));
      
      if (isAIQuery) {
        setAiQuery(searchQuery);
        setShowAIChat(true);
        setSearchQuery('');
      }
    }
  };

  // Show AI Chat if active
  if (showAIChat) {
    return (
      <NexoraAIChat 
        onClose={() => {
          setShowAIChat(false);
          setAiQuery('');
        }} 
        initialQuery={aiQuery}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Search Bar */}
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Ask Nexora AI or Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-12 pr-12 h-12 bg-muted/30 border-0 rounded-full text-base placeholder:text-muted-foreground"
          />
          {/* AI Button */}
          <button
            onClick={() => {
              if (searchQuery.trim()) {
                setAiQuery(searchQuery);
                setShowAIChat(true);
                setSearchQuery('');
              } else {
                setShowAIChat(true);
              }
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
        {filterButtons.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border",
              activeFilter === filter.key
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-transparent text-foreground border-border hover:bg-muted/50"
            )}
          >
            {filter.label}
          </button>
        ))}
        
        {/* Add Button */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-muted/50 transition-colors flex-shrink-0">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
              <DialogDescription>
                Enter a username to find and add a Nexora user to your contacts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={30}
                />
                <p className="text-xs text-muted-foreground">
                  Enter the Nexora user's username
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Contact Name (optional)</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  maxLength={50}
                />
              </div>
              <Button
                onClick={addContact}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Adding..." : "Add Contact"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Create Group Button (shown only in groups filter) */}
      {activeFilter === 'groups' && (
        <div className="px-4 pb-3">
          <CreateGroupDialog 
            onGroupCreated={(conversationId, groupName) => {
              fetchGroups();
              onStartGroupChat(conversationId, groupName);
            }} 
          />
        </div>
      )}

      {/* Contact/Group List */}
      <div className="flex-1 overflow-y-auto">
        {/* Show Contacts */}
        {activeFilter !== 'groups' && (
          <>
            {displayContacts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-2xl mb-2">🔍</p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No contacts found" : "No contacts yet 📱"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Add contacts by username to start chatting 💬
                  </p>
                )}
              </div>
            ) : (
              displayContacts.map((contact) => {
                const displayName = contact.contact_name || contact.profiles?.display_name || 'Unknown';
                const emoji = getRandomEmoji(contact.contact_user_id);
                const statusMsg = contact.profiles?.status || getStatusMessage(contact.contact_user_id);
                const avatarColor = getAvatarColor(contact.contact_user_id);
                const conversationId = conversationMap[contact.contact_user_id];
                const unreadCount = conversationId ? (unreadCounts[conversationId] || 0) : 0;
                
                return (
                  <SwipeableContactItem
                    key={contact.id}
                    contact={contact}
                    displayName={displayName}
                    emoji={emoji}
                    statusMsg={statusMsg}
                    avatarColor={avatarColor}
                    unreadCount={unreadCount}
                    onStartChat={() => onStartChat(contact.contact_user_id, displayName)}
                    onToggleFavourite={(e) => toggleFavourite(contact.id, contact.is_favourite, e)}
                    onToggleSound={() => toggleContactSound(contact.id, contact.contact_user_id)}
                    onDelete={() => deleteContact(contact.id)}
                  />
                );
              })
            )}
          </>
        )}

        {/* Show Groups */}
        {activeFilter === 'groups' && (
          <>
            {displayGroups.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-2xl mb-2">👥</p>
                <p className="text-muted-foreground mb-4">
                  {searchQuery ? "No groups found" : "No groups yet"}
                </p>
                {!searchQuery && (
                  <p className="text-sm text-muted-foreground">
                    Create a group to chat with multiple contacts
                  </p>
                )}
              </div>
            ) : (
              displayGroups.map((group) => {
                const groupUnreadCount = unreadCounts[group.id] || 0;
                
                return (
                  <SwipeableGroupItem
                    key={group.id}
                    group={group}
                    unreadCount={groupUnreadCount}
                    isMuted={group.is_muted}
                    onStartChat={() => onStartGroupChat(group.id, group.group_name)}
                    onLeave={() => leaveGroup(group.id, group.group_name)}
                    onToggleMute={() => toggleMuteGroup(group.id)}
                  />
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ContactsList;

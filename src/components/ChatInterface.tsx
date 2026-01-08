import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Sparkles, Languages, Smile, Mic, Phone, Video, Shield, Bot, Settings, MoreVertical, LogOut, Trash2, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AISuggestions from "./AISuggestions";
import ChatSummarizer from "./ChatSummarizer";
import VoiceRecorder from "./VoiceRecorder";
import MessageTranslator from "./MessageTranslator";
import MessageReactions from "./MessageReactions";
import TypingIndicator, { useTypingIndicator } from "./TypingIndicator";
import { CallInterface } from "./CallInterface";
import { IncomingCallDialog } from "./IncomingCallDialog";
import { GroupBotSettings } from "./GroupBotSettings";
import { GroupBotInteraction } from "./GroupBotInteraction";
import { ContactLanguagePreferences } from "./ContactLanguagePreferences";
import { PublicProfileCard } from "./PublicProfileCard";
import EmojiPicker, { EmojiClickData, Theme, EmojiStyle } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAutoTranslate } from "@/hooks/useAutoTranslate";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Message {
  id: string;
  text: string;
  translatedText?: string;
  detectedLanguage?: {
    code: string;
    name: string;
  };
  sender: "user" | "ai" | "contact";
  senderId?: string;
  senderName?: string;
  timestamp: Date;
  aiGenerated?: boolean;
  messageType?: 'text' | 'audio' | 'image';
  audioData?: string;
  transcription?: string;
  isEdited?: boolean;
  isTranslating?: boolean;
  isDetecting?: boolean;
}

const ChatInterface = ({ 
  contactUserId, 
  contactName,
  isGroup = false,
  conversationId: providedConversationId,
  onBack 
}: { 
  contactUserId: string;
  contactName: string;
  isGroup?: boolean;
  conversationId?: string;
  onBack: () => void;
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeCall, setActiveCall] = useState<any>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callParticipants, setCallParticipants] = useState<Map<string, string>>(new Map());
  const [profilesCache, setProfilesCache] = useState<Map<string, string>>(new Map());
  const [showBotSettings, setShowBotSettings] = useState(false);
  const [showBotInteraction, setShowBotInteraction] = useState(false);
  const [botSettings, setBotSettings] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showContactLanguagePrefs, setShowContactLanguagePrefs] = useState(false);
  const [outgoingLanguage, setOutgoingLanguage] = useState<{ code: string; name: string } | null>(null);
  const [detectingOutgoing, setDetectingOutgoing] = useState(false);
  const detectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { setTyping } = useTypingIndicator(conversationId, currentUserId);
  const { 
    preferences, 
    contactPreferences,
    fetchPreferences, 
    fetchContactPreferences,
    getEffectivePreferences,
    isAutoTranslateEnabled: checkAutoTranslateEnabled,
    autoTranslateIncoming, 
    detectLanguage, 
    translating 
  } = useAutoTranslate();
  const [localAutoTranslate, setLocalAutoTranslate] = useState<boolean | null>(null);
  
  // Fetch contact-specific preferences when contact changes (for non-group chats)
  useEffect(() => {
    if (!isGroup && contactUserId) {
      fetchContactPreferences(contactUserId);
    }
  }, [isGroup, contactUserId, fetchContactPreferences]);
  
  // Sync local state with effective preferences (contact prefs override global)
  useEffect(() => {
    const effectivePrefs = getEffectivePreferences();
    if (localAutoTranslate === null && effectivePrefs.auto_translate !== undefined) {
      setLocalAutoTranslate(effectivePrefs.auto_translate);
    }
  }, [getEffectivePreferences, localAutoTranslate, contactPreferences]);

  // Reset local state when contact preferences change
  useEffect(() => {
    setLocalAutoTranslate(null);
  }, [contactPreferences]);

  const isAutoTranslateEnabled = localAutoTranslate ?? getEffectivePreferences().auto_translate;

  const toggleAutoTranslate = async () => {
    const newValue = !isAutoTranslateEnabled;
    setLocalAutoTranslate(newValue);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      // If we have contact preferences, update those; otherwise update global
      if (!isGroup && contactPreferences) {
        const { error } = await supabase
          .from('contact_language_preferences')
          .update({ auto_translate: newValue })
          .eq('user_id', userData.user.id)
          .eq('contact_user_id', contactUserId);

        if (error) throw error;
        
        // Refresh contact preferences
        fetchContactPreferences(contactUserId);
        
        toast({
          title: newValue ? "Auto-translate enabled" : "Auto-translate disabled",
          description: `Translation ${newValue ? 'enabled' : 'disabled'} for this contact`,
        });
      } else {
        const { error } = await supabase
          .from('profiles')
          .update({ auto_translate: newValue })
          .eq('user_id', userData.user.id);

        if (error) throw error;

        toast({
          title: newValue ? "Auto-translate enabled" : "Auto-translate disabled",
          description: newValue 
            ? "Incoming messages will be automatically translated" 
            : "Messages will be shown in original language",
        });
      }
    } catch (error) {
      // Revert on error
      setLocalAutoTranslate(!newValue);
      console.error('Error toggling auto-translate:', error);
      toast({
        title: "Error",
        description: "Failed to update translation settings",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const initUser = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        setCurrentUserId(userData.user.id);
        // Fetch language preferences
        fetchPreferences();
      }
    };
    initUser();
  }, [fetchPreferences]);

  useEffect(() => {
    if (isGroup && providedConversationId) {
      setConversationId(providedConversationId);
      setLoading(false);
    } else if (contactUserId) {
      initializeConversation();
    }
  }, [contactUserId, isGroup, providedConversationId]);

  useEffect(() => {
    if (conversationId && currentUserId) {
      fetchMessages();
      loadBotSettings();
      checkIfAdmin();
      markMessagesAsRead();
      const cleanup = subscribeToMessages();
      return cleanup;
    }
  }, [conversationId, currentUserId]);

  const markMessagesAsRead = async () => {
    if (!conversationId || !currentUserId) return;
    
    try {
      await supabase.rpc('mark_messages_read', {
        conv_id: conversationId,
        user_uuid: currentUserId
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const loadBotSettings = async () => {
    if (!conversationId) return;
    
    const { data } = await supabase
      .from('bot_settings')
      .select('*')
      .eq('conversation_id', conversationId)
      .single();
    
    setBotSettings(data);
  };

  const checkIfAdmin = async () => {
    if (!conversationId || !currentUserId) return;
    
    const { data } = await supabase
      .from('conversation_participants')
      .select('is_admin')
      .eq('conversation_id', conversationId)
      .eq('user_id', currentUserId)
      .single();
    
    setIsAdmin(data?.is_admin || false);
  };

  // Subscribe to incoming calls
  useEffect(() => {
    if (!currentUserId || !conversationId) return;

    const channel = supabase
      .channel('calls-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const call = payload.new;
          if (call.caller_id !== currentUserId && call.status === 'ringing') {
            // Get caller info
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', call.caller_id)
              .single();

            setIncomingCall({
              ...call,
              callerName: callerProfile?.display_name || 'Unknown',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, conversationId]);

  const initializeConversation = async () => {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        other_user_id: contactUserId,
      });

      if (error) throw error;
      setConversationId(data);
    } catch (error) {
      console.error('Error initializing conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!conversationId || !currentUserId) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } else if (data) {
      // Get unique sender IDs
      const uniqueSenderIds = [...new Set(data.map(msg => msg.sender_id))];
      
      // Batch fetch all profiles at once
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', uniqueSenderIds);
      
      // Create profiles cache
      const newCache = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
      setProfilesCache(newCache);

      // Map messages with cached profiles
      const messagesWithProfiles: Message[] = data.map((msg) => {
        const senderName = newCache.get(msg.sender_id) || 'Unknown';
        const isFromOther = msg.sender_id !== currentUserId;

        return {
          id: msg.id,
          text: msg.content || msg.transcription || '',
          sender: isFromOther ? 'contact' : 'user',
          senderId: msg.sender_id,
          senderName,
          timestamp: new Date(msg.created_at),
          aiGenerated: msg.ai_generated,
          messageType: (msg.message_type || 'text') as 'text' | 'audio' | 'image',
          audioData: msg.audio_data || undefined,
          transcription: msg.transcription || undefined,
          isEdited: !!(msg as any).updated_at,
        };
      });
      
      setMessages(messagesWithProfiles);

      // Detect language and auto-translate incoming messages
      const incomingMessages = messagesWithProfiles.filter(m => m.sender === 'contact' && m.text);
      
      // Process messages in batches to avoid overwhelming the API
      for (const msg of incomingMessages.slice(-10)) {
        // Detect language for incoming messages
        const langResult = await detectLanguage(msg.text, msg.id);
        if (langResult) {
          setMessages(prev => prev.map(m => 
            m.id === msg.id 
              ? { ...m, detectedLanguage: { code: langResult.languageCode, name: langResult.languageName } }
              : m
          ));
        }

        // Auto-translate if enabled
        if (isAutoTranslateEnabled) {
          const translatedText = await autoTranslateIncoming(msg.text, msg.id);
          if (translatedText) {
            setMessages(prev => prev.map(m => 
              m.id === msg.id ? { ...m, translatedText } : m
            ));
          }
        }
      }
    }
  };

  const subscribeToMessages = () => {
    if (!conversationId || !currentUserId) return () => {};

    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new;
          
          // Use cached profile or fetch if not in cache
          let senderName = profilesCache.get(newMsg.sender_id);
          
          if (!senderName && isGroup && newMsg.sender_id !== currentUserId) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('user_id', newMsg.sender_id)
              .single();
            
            senderName = profile?.display_name || 'Unknown';
            
            // Update cache
            setProfilesCache(prev => new Map(prev).set(newMsg.sender_id, senderName!));
          }

          const messageText = newMsg.content || newMsg.transcription || '';
          const isFromOther = newMsg.sender_id !== currentUserId;

          // Add message first, then translate if needed
          setMessages((prev) => {
            // Avoid duplicate messages
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            
            return [
              ...prev,
              {
                id: newMsg.id,
                text: messageText,
                sender: isFromOther ? 'contact' : 'user',
                senderId: newMsg.sender_id,
                senderName: senderName || 'Unknown',
                timestamp: new Date(newMsg.created_at),
                aiGenerated: newMsg.ai_generated,
                messageType: (newMsg.message_type || 'text') as 'text' | 'audio' | 'image',
                audioData: newMsg.audio_data || undefined,
                transcription: newMsg.transcription || undefined,
                isEdited: !!newMsg.updated_at,
                isTranslating: isFromOther && isAutoTranslateEnabled,
                isDetecting: isFromOther,
              },
            ];
          });

          // Detect language for incoming messages
          if (isFromOther && messageText) {
            const langResult = await detectLanguage(messageText, newMsg.id);
            if (langResult) {
              setMessages(prev => prev.map(m => 
                m.id === newMsg.id 
                  ? { ...m, detectedLanguage: { code: langResult.languageCode, name: langResult.languageName }, isDetecting: false }
                  : m
              ));
            } else {
              setMessages(prev => prev.map(m => 
                m.id === newMsg.id ? { ...m, isDetecting: false } : m
              ));
            }
          }

          // Auto-translate incoming messages if enabled
          if (isFromOther && isAutoTranslateEnabled && messageText) {
            const translatedText = await autoTranslateIncoming(messageText, newMsg.id);
            if (translatedText) {
              setMessages(prev => prev.map(m => 
                m.id === newMsg.id 
                  ? { ...m, translatedText, isTranslating: false }
                  : m
              ));
            } else {
              // Remove translating state if translation failed
              setMessages(prev => prev.map(m => 
                m.id === newMsg.id 
                  ? { ...m, isTranslating: false }
                  : m
              ));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Debounced language detection for outgoing messages
  useEffect(() => {
    if (detectTimeoutRef.current) {
      clearTimeout(detectTimeoutRef.current);
    }

    const text = inputText.trim();
    if (text.length < 5) {
      setOutgoingLanguage(null);
      setDetectingOutgoing(false);
      return;
    }

    setDetectingOutgoing(true);
    detectTimeoutRef.current = setTimeout(async () => {
      const result = await detectLanguage(text, 'outgoing-detect');
      if (result) {
        setOutgoingLanguage({ code: result.languageCode, name: result.languageName });
      } else {
        setOutgoingLanguage(null);
      }
      setDetectingOutgoing(false);
    }, 500);

    return () => {
      if (detectTimeoutRef.current) {
        clearTimeout(detectTimeoutRef.current);
      }
    };
  }, [inputText, detectLanguage]);

  const handleSend = async () => {
    if (!inputText.trim() || !conversationId) return;

    const messageContent = inputText.trim();
    setInputText("");
    setShowAISuggestions(false);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: userData.user.id,
      content: messageContent,
      message_type: 'text',
    });

    if (error) {
      console.error('Error sending message:', error);
      
      const errorMessage = error.message?.toLowerCase().includes('rate limit') || 
                          error.message?.toLowerCase().includes('check_message_rate_limit')
        ? "You've reached the message limit (100 messages per hour in this conversation). Please slow down."
        : "Failed to send message. Please try again.";
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      setInputText(messageContent);
    }
  };

  const handleVoiceRecording = async (transcription: string) => {
    if (!conversationId || !transcription.trim()) return;

    try {
      // Send message with transcription
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { error: insertError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: userData.user.id,
        content: transcription.trim(),
        message_type: 'audio',
        transcription: transcription.trim(),
      });

      if (insertError) throw insertError;

    } catch (error) {
      console.error('Error sending voice message:', error);
      toast({
        title: "Failed to send",
        description: error instanceof Error ? error.message : "Failed to send voice message",
        variant: "destructive",
      });
    }
  };

  const handleAISuggestion = (suggestion: string) => {
    setInputText(suggestion);
    setShowAISuggestions(false);
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setInputText(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const startCall = async (isVideo: boolean) => {
    if (!conversationId || !currentUserId) return;

    try {
      console.log('Starting call for conversation:', conversationId);
      
      // Create call record
      const { data: call, error: callError } = await supabase
        .from('calls')
        .insert({
          conversation_id: conversationId,
          caller_id: currentUserId,
          call_type: isVideo ? 'video' : 'audio',
          status: 'ringing',
        })
        .select()
        .single();

      if (callError) {
        console.error('Error creating call:', callError);
        throw callError;
      }

      console.log('Call created:', call.id);

      // Get all participants
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (participantsError) {
        console.error('Error fetching participants:', participantsError);
        throw participantsError;
      }

      if (!participants || participants.length === 0) {
        throw new Error('No participants found for conversation');
      }

      console.log('Found participants:', participants.map(p => p.user_id));

      // Add all participants to call
      const participantInserts = participants.map(p => ({
        call_id: call.id,
        user_id: p.user_id,
        status: p.user_id === currentUserId ? 'joined' : 'invited',
      }));

      console.log('Inserting call participants:', participantInserts);

      const { error: insertError } = await supabase
        .from('call_participants')
        .insert(participantInserts);

      if (insertError) {
        console.error('Error inserting call participants:', insertError);
        throw insertError;
      }

      console.log('Call participants added successfully');

      // Get participant names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', participants.map(p => p.user_id));

      const namesMap = new Map(
        profiles?.map(p => [p.user_id, p.display_name]) || []
      );
      setCallParticipants(namesMap);

      const participantIds = participants.map(p => p.user_id);
      console.log('Setting active call with participant IDs:', participantIds);

      setActiveCall({
        ...call,
        participantIds,
      });

      toast({
        title: 'Call started',
        description: `${isVideo ? 'Video' : 'Voice'} call initiated`,
      });
    } catch (error) {
      console.error('Error starting call:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to start call',
        variant: 'destructive',
      });
    }
  };

  const acceptCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      // Update call participant status
      await supabase
        .from('call_participants')
        .update({ status: 'joined', joined_at: new Date().toISOString() })
        .eq('call_id', incomingCall.id)
        .eq('user_id', currentUserId);

      // Update call status to active
      await supabase
        .from('calls')
        .update({ status: 'active' })
        .eq('id', incomingCall.id);

      // Get all participants
      const { data: participants } = await supabase
        .from('call_participants')
        .select('user_id')
        .eq('call_id', incomingCall.id);

      // Get participant names
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', participants?.map(p => p.user_id) || []);

      const namesMap = new Map(
        profiles?.map(p => [p.user_id, p.display_name]) || []
      );
      setCallParticipants(namesMap);

      setActiveCall({
        ...incomingCall,
        participantIds: participants?.map(p => p.user_id) || [],
      });
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
      toast({
        title: 'Error',
        description: 'Failed to join call',
        variant: 'destructive',
      });
    }
  };

  const rejectCall = async () => {
    if (!incomingCall || !currentUserId) return;

    try {
      await supabase
        .from('call_participants')
        .update({ status: 'rejected' })
        .eq('call_id', incomingCall.id)
        .eq('user_id', currentUserId);

      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  const endCall = () => {
    setActiveCall(null);
    setCallParticipants(new Map());
  };

  const handleLeaveConversation = async () => {
    if (!conversationId || !currentUserId) return;
    
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({
        title: "Left conversation",
        description: "You have successfully left this group.",
      });
      
      onBack();
    } catch (error) {
      console.error('Error leaving conversation:', error);
      toast({
        title: "Failed to leave",
        description: "Unable to leave the conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConversation = async () => {
    if (!conversationId || !currentUserId) return;
    
    try {
      // First delete the conversation participants
      const { error: participantsError } = await supabase
        .from('conversation_participants')
        .delete()
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      // Then delete the conversation itself
      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (convError) throw convError;

      toast({
        title: "Chat deleted",
        description: "The conversation has been deleted.",
      });
      
      onBack();
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast({
        title: "Failed to delete",
        description: "Unable to delete the conversation. Please try again.",
        variant: "destructive",
      });
    }
  };

const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.filter(m => m.id !== messageId));
      
      toast({
        title: "Message deleted",
        description: "The message has been removed.",
      });
    } catch (error) {
      console.error('Error deleting message:', error);
      toast({
        title: "Failed to delete",
        description: "Unable to delete the message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ content: newContent })
        .eq('id', messageId);

      if (error) throw error;

      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, text: newContent, isEdited: true } : m
      ));
      
      toast({
        title: "Message updated",
        description: "Your message has been edited.",
      });
    } catch (error) {
      console.error('Error editing message:', error);
      toast({
        title: "Failed to edit",
        description: "Unable to edit the message. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="hover:bg-primary/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <span className="font-semibold">{contactName[0].toUpperCase()}</span>
            </div>
            <div>
              <h2 className="font-semibold">{contactName}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-2 h-2 bg-accent rounded-full" />
                {isGroup ? 'Group Chat' : 'Online'} · Encrypted
              </p>
            </div>
          </div>
          
          {/* Auto-translate toggle */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-muted/50">
                  <Languages className={cn("w-4 h-4", isAutoTranslateEnabled ? "text-primary" : "text-muted-foreground")} />
                  <Switch
                    checked={isAutoTranslateEnabled}
                    onCheckedChange={toggleAutoTranslate}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isAutoTranslateEnabled ? 'Disable' : 'Enable'} auto-translation</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          {/* Per-contact language settings */}
          {!isGroup && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowContactLanguagePrefs(true)}
                    className="hover:bg-primary/10"
                  >
                    <Settings className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Language settings for this contact</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startCall(false)}
            className="hover:bg-primary/10"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => startCall(true)}
            className="hover:bg-primary/10"
          >
            <Video className="w-5 h-5" />
          </Button>
          {isGroup && (
            <Sheet open={showBotSettings} onOpenChange={setShowBotSettings}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-primary/10"
                >
                  <Bot className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>GroupBotAI Settings</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  {conversationId && (
                    <GroupBotSettings
                      conversationId={conversationId}
                      isAdmin={isAdmin}
                    />
                  )}
                </div>
              </SheetContent>
            </Sheet>
          )}
          {conversationId && <ChatSummarizer conversationId={conversationId} />}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10"
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isGroup ? (
                <DropdownMenuItem 
                  onClick={() => setShowLeaveDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Conversation
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Chat
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-muted-foreground text-sm">Loading conversation...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble 
              key={message.id} 
              message={message} 
              contactName={contactName}
              isGroup={isGroup}
              onDelete={handleDeleteMessage}
              onEdit={handleEditMessage}
              currentUserId={currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {conversationId && currentUserId && (
        <TypingIndicator 
          conversationId={conversationId} 
          currentUserId={currentUserId}
          profilesCache={profilesCache}
        />
      )}

      {/* AI Suggestions */}
      {showAISuggestions && (
        <AISuggestions
          currentText={inputText}
          conversationContext={messages.map(msg => ({
            sender: msg.sender === 'user' ? 'You' : contactName,
            text: msg.text
          }))}
          onSelectSuggestion={handleAISuggestion}
          onClose={() => setShowAISuggestions(false)}
        />
      )}

      {/* GroupBotAI Interaction */}
      {isGroup && showBotInteraction && conversationId && (
        <div className="bg-card border-t border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">GroupBotAI</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowBotInteraction(false)}
            >
              Close
            </Button>
          </div>
          <GroupBotInteraction
            conversationId={conversationId}
            recentMessages={messages.slice(-20).map(msg => ({
              sender_name: msg.senderName || contactName,
              content: msg.text,
              created_at: msg.timestamp.toISOString(),
            }))}
            botSettings={botSettings}
          />
        </div>
      )}

      {/* Input */}
      <div className="bg-card border-t border-border p-4">
        <div className="flex items-center gap-2">
          <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10 text-muted-foreground transition-transform hover:scale-110"
              >
                <Smile className="w-5 h-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              side="top" 
              align="start" 
              className="w-auto p-0 border-0 shadow-xl"
            >
              <EmojiPicker
                onEmojiClick={handleEmojiClick}
                theme={Theme.AUTO}
                lazyLoadEmojis={true}
                searchPlaceHolder="Search emojis..."
                height={400}
                width={350}
                emojiStyle={EmojiStyle.NATIVE}
                previewConfig={{ showPreview: false }}
              />
            </PopoverContent>
          </Popover>
          <div className="flex-1 relative">
            <Input
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (e.target.value.trim()) {
                  setTyping(true);
                } else {
                  setTyping(false);
                }
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  setTyping(false);
                  handleSend();
                  setOutgoingLanguage(null);
                }
              }}
              onBlur={() => setTyping(false)}
              placeholder="Message with Nexora AI..."
              className="bg-muted border-border pr-24"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-primary/10"
                onClick={() => setShowAISuggestions(!showAISuggestions)}
              >
                <Sparkles className="w-4 h-4 text-primary" />
              </Button>
              {isGroup && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-primary/10"
                  onClick={() => setShowBotInteraction(!showBotInteraction)}
                >
                  <Bot className="w-4 h-4 text-primary" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-secondary/10"
              >
                <Languages className="w-4 h-4 text-secondary" />
              </Button>
            </div>
          </div>
          <VoiceRecorder 
            onRecordingComplete={handleVoiceRecording}
            disabled={!conversationId}
          />
          <Button
            onClick={() => {
              handleSend();
              setOutgoingLanguage(null);
            }}
            disabled={!inputText.trim()}
            className="bg-primary hover:bg-primary-glow"
            size="icon"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        {/* Outgoing language detection indicator */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted-foreground text-center flex-1">
            <Shield className="w-3 h-3 inline mr-1" />
            Encrypted in transit · AI-powered suggestions
          </p>
          {(detectingOutgoing || outgoingLanguage) && (
            <div className="flex items-center gap-1.5 text-xs">
              <Languages className={cn("w-3 h-3", detectingOutgoing && "animate-pulse")} />
              {detectingOutgoing ? (
                <span className="text-muted-foreground">Detecting...</span>
              ) : outgoingLanguage ? (
                <span className="text-primary font-medium">
                  Writing in {outgoingLanguage.name}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Active Call */}
    {activeCall && currentUserId && (
      <CallInterface
        callId={activeCall.id}
        userId={currentUserId}
        participantIds={activeCall.participantIds}
        participantNames={callParticipants}
        isVideo={activeCall.call_type === 'video'}
        onEndCall={endCall}
      />
    )}

    {/* Incoming Call Dialog */}
    {incomingCall && (
      <IncomingCallDialog
        open={!!incomingCall}
        callerName={incomingCall.callerName}
        isVideo={incomingCall.call_type === 'video'}
        onAccept={acceptCall}
        onReject={rejectCall}
      />
    )}

    {/* Contact Language Preferences */}
    {!isGroup && (
      <ContactLanguagePreferences
        open={showContactLanguagePrefs}
        onOpenChange={setShowContactLanguagePrefs}
        contactUserId={contactUserId}
        contactName={contactName}
        conversationId={conversationId || undefined}
      />
    )}

    <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave Conversation?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to leave "{contactName}"? You won't be able to see new messages and will need to be re-added by an admin to rejoin.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLeaveConversation}
            className="bg-destructive hover:bg-destructive/90"
          >
            Leave Conversation
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this conversation with "{contactName}"? All messages will be permanently deleted and cannot be recovered.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConversation}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete Chat
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};

interface MemberProfile {
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

const MessageBubble = ({ 
  message, 
  contactName, 
  isGroup,
  onDelete,
  onEdit,
  currentUserId
}: { 
  message: Message; 
  contactName: string; 
  isGroup?: boolean;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  currentUserId: string | null;
}) => {
  const isUser = message.sender === "user";
  const isAI = message.sender === "ai";
  const isAudio = message.messageType === 'audio';
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [memberProfile, setMemberProfile] = useState<MemberProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const handleAvatarClick = async () => {
    if (!isGroup || !message.senderId || isAI) return;
    
    setShowProfileDialog(true);
    setLoadingProfile(true);
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url, bio, status, location, twitter_url, linkedin_url, instagram_url, website_url')
        .eq('user_id', message.senderId)
        .single();
      
      if (profile) {
        setMemberProfile(profile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(message.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleSaveEdit = () => {
    if (onEdit && editText.trim() && editText !== message.text) {
      onEdit(message.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  const canEdit = isUser && !isAudio && message.messageType === 'text';

  return (
    <>
      <div
        className={cn(
          "flex gap-2 animate-slide-up group",
          isUser ? "justify-end" : "justify-start"
        )}
      >
        {!isUser && (
          <div 
            className={cn(
              "w-8 h-8 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center flex-shrink-0",
              isGroup && !isAI && "cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all"
            )}
            onClick={handleAvatarClick}
          >
            {isAI ? (
              <Sparkles className="w-4 h-4" />
            ) : isGroup ? (
              <span className="text-xs font-semibold">{message.senderName?.[0]?.toUpperCase()}</span>
            ) : (
              <span className="text-xs font-semibold">{contactName[0].toUpperCase()}</span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-2 max-w-[70%]">
          {isGroup && !isUser && (
            <p className="text-xs text-muted-foreground px-1">{message.senderName}</p>
          )}
          <div className="flex items-start gap-1">
            {isUser && !isEditing && (
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity self-center">
                {canEdit && onEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
              </div>
            )}
            <div
              className={cn(
                "rounded-2xl px-4 py-2",
                isUser
                  ? "bg-primary text-primary-foreground"
                  : isAI
                  ? "bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 glow-ai"
                  : "bg-card border border-border"
              )}
            >
              {isAudio && (
                <div className="flex items-center gap-2 mb-1">
                  <Mic className="w-3 h-3 opacity-70" />
                  <span className="text-xs opacity-70">Voice message</span>
                </div>
              )}
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="bg-primary-foreground text-primary min-w-[200px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSaveEdit();
                      } else if (e.key === 'Escape') {
                        handleCancelEdit();
                      }
                    }}
                  />
                  <div className="flex gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-primary-foreground/20 hover:bg-primary-foreground/30"
                      onClick={handleCancelEdit}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-primary-foreground/20 hover:bg-primary-foreground/30"
                      onClick={handleSaveEdit}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {message.isTranslating ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Languages className="w-3 h-3 animate-pulse" />
                      <span className="opacity-70">Translating...</span>
                    </div>
                  ) : message.translatedText ? (
                    <>
                      <p className="text-sm">{message.translatedText}</p>
                      <p className="text-xs opacity-50 italic flex items-center gap-1">
                        <Languages className="w-3 h-3" />
                        Original ({message.detectedLanguage?.name || 'Unknown'}): {message.text}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm">{message.text}</p>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs opacity-70 flex items-center gap-1">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {message.isEdited && <span className="italic">(edited)</span>}
                </p>
                {!isUser && message.detectedLanguage && !message.translatedText && (
                  <span className="text-xs bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-1">
                    <Languages className="w-2.5 h-2.5" />
                    {message.detectedLanguage.name}
                  </span>
                )}
                {!isUser && message.isDetecting && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Languages className="w-2.5 h-2.5 animate-pulse" />
                    Detecting...
                  </span>
                )}
              </div>
            </div>
          </div>
          <MessageReactions messageId={message.id} currentUserId={currentUserId} />
          <MessageTranslator messageId={message.id} messageText={message.text} />
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be permanently deleted and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          {loadingProfile ? (
            <div className="flex items-center justify-center p-8">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : memberProfile ? (
            <PublicProfileCard profile={memberProfile} />
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              Profile not found
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChatInterface;

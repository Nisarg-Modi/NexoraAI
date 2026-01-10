export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_chat_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_rate_limits: {
        Row: {
          created_at: string
          id: string
          request_count: number
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          request_count?: number
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      bot_interactions: {
        Row: {
          command: string | null
          confidence: number | null
          conversation_id: string
          created_at: string | null
          id: string
          mode: string
          response: string | null
          user_id: string
        }
        Insert: {
          command?: string | null
          confidence?: number | null
          conversation_id: string
          created_at?: string | null
          id?: string
          mode: string
          response?: string | null
          user_id: string
        }
        Update: {
          command?: string | null
          confidence?: number | null
          conversation_id?: string
          created_at?: string | null
          id?: string
          mode?: string
          response?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      bot_settings: {
        Row: {
          auto_translate: boolean | null
          conversation_id: string
          created_at: string | null
          default_mode: string | null
          enabled: boolean | null
          id: string
          moderation_enabled: boolean | null
          persona: string | null
          target_language: string | null
          updated_at: string | null
        }
        Insert: {
          auto_translate?: boolean | null
          conversation_id: string
          created_at?: string | null
          default_mode?: string | null
          enabled?: boolean | null
          id?: string
          moderation_enabled?: boolean | null
          persona?: string | null
          target_language?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_translate?: boolean | null
          conversation_id?: string
          created_at?: string | null
          default_mode?: string | null
          enabled?: boolean | null
          id?: string
          moderation_enabled?: boolean | null
          persona?: string | null
          target_language?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      call_participants: {
        Row: {
          call_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          call_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          call_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          call_type: string
          caller_id: string
          conversation_id: string
          created_at: string
          ended_at: string | null
          id: string
          started_at: string
          status: string
        }
        Insert: {
          call_type: string
          caller_id: string
          conversation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Update: {
          call_type?: string
          caller_id?: string
          conversation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "calls_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_public: boolean | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          community_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          community_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_language_preferences: {
        Row: {
          auto_translate: boolean | null
          contact_user_id: string
          conversation_id: string | null
          created_at: string
          id: string
          preferred_language: string | null
          send_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_translate?: boolean | null
          contact_user_id: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          preferred_language?: string | null
          send_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_translate?: boolean | null
          contact_user_id?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          preferred_language?: string | null
          send_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_language_preferences_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_name: string | null
          contact_user_id: string
          created_at: string
          id: string
          is_favourite: boolean | null
          notification_sound_enabled: boolean | null
          user_id: string
        }
        Insert: {
          contact_name?: string | null
          contact_user_id: string
          created_at?: string
          id?: string
          is_favourite?: boolean | null
          notification_sound_enabled?: boolean | null
          user_id: string
        }
        Update: {
          contact_name?: string | null
          contact_user_id?: string
          created_at?: string
          id?: string
          is_favourite?: boolean | null
          notification_sound_enabled?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          is_admin: boolean | null
          is_muted: boolean | null
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_admin?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_admin?: boolean | null
          is_muted?: boolean | null
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string | null
          group_avatar_url: string | null
          group_name: string | null
          id: string
          is_group: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          group_avatar_url?: string | null
          group_name?: string | null
          id?: string
          is_group?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempt_time: string
          id: string
          identifier: string
          success: boolean
        }
        Insert: {
          attempt_time?: string
          id?: string
          identifier: string
          success?: boolean
        }
        Update: {
          attempt_time?: string
          id?: string
          identifier?: string
          success?: boolean
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          created_at: string | null
          id: string
          joined_at: string | null
          left_at: string | null
          meeting_id: string
          response_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id: string
          response_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          joined_at?: string | null
          left_at?: string | null
          meeting_id?: string
          response_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      meeting_transcripts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          meeting_id: string
          speaker_id: string
          timestamp: string
          translated_content: Json | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          meeting_id: string
          speaker_id: string
          timestamp?: string
          translated_content?: Json | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          meeting_id?: string
          speaker_id?: string
          timestamp?: string
          translated_content?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_transcripts_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_video: boolean | null
          meeting_link: string
          scheduled_end: string
          scheduled_start: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_video?: boolean | null
          meeting_link: string
          scheduled_end: string
          scheduled_start: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_video?: boolean | null
          meeting_link?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_embeddings: {
        Row: {
          content_preview: string | null
          conversation_id: string
          created_at: string
          embedding: string
          id: string
          message_id: string
        }
        Insert: {
          content_preview?: string | null
          conversation_id: string
          created_at?: string
          embedding: string
          id?: string
          message_id: string
        }
        Update: {
          content_preview?: string | null
          conversation_id?: string
          created_at?: string
          embedding?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_embeddings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_embeddings_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          original_text: string
          source_language: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          original_text: string
          source_language: string
          target_language: string
          translated_text: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          original_text?: string
          source_language?: string
          target_language?: string
          translated_text?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          ai_generated: boolean | null
          audio_data: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          message_type: string | null
          read_at: string | null
          sender_id: string
          transcription: string | null
          updated_at: string | null
        }
        Insert: {
          ai_generated?: boolean | null
          audio_data?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
          transcription?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_generated?: boolean | null
          audio_data?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
          transcription?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_replies: {
        Row: {
          content: string | null
          created_at: string
          emoji: string | null
          id: string
          moment_id: string
          reply_type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          moment_id: string
          reply_type?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          moment_id?: string
          reply_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_replies_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moments"
            referencedColumns: ["id"]
          },
        ]
      }
      moment_views: {
        Row: {
          id: string
          moment_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          moment_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          moment_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moment_views_moment_id_fkey"
            columns: ["moment_id"]
            isOneToOne: false
            referencedRelation: "moments"
            referencedColumns: ["id"]
          },
        ]
      }
      moments: {
        Row: {
          content: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string | null
          media_url: string | null
          user_id: string
          views_count: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id: string
          views_count?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id?: string
          views_count?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          auto_translate: boolean | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string
          dnd_enabled: boolean | null
          dnd_end_time: string | null
          dnd_start_time: string | null
          gender: string | null
          id: string
          instagram_url: string | null
          linkedin_url: string | null
          location: string | null
          notification_sound_enabled: boolean | null
          preferred_language: string | null
          send_language: string | null
          status: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          username: string
          website_url: string | null
        }
        Insert: {
          auto_translate?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name: string
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          location?: string | null
          notification_sound_enabled?: boolean | null
          preferred_language?: string | null
          send_language?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          username: string
          website_url?: string | null
        }
        Update: {
          auto_translate?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string
          dnd_enabled?: boolean | null
          dnd_end_time?: string | null
          dnd_start_time?: string | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          linkedin_url?: string | null
          location?: string | null
          notification_sound_enabled?: boolean | null
          preferred_language?: string | null
          send_language?: string | null
          status?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          website_url?: string | null
        }
        Relationships: []
      }
      profiles_private: {
        Row: {
          created_at: string
          phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          platform: string
          subscription: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          platform?: string
          subscription: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          platform?: string
          subscription?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      stream_followers: {
        Row: {
          followed_at: string
          id: string
          stream_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          id?: string
          stream_id: string
          user_id: string
        }
        Update: {
          followed_at?: string
          id?: string
          stream_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_followers_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "stream_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      stream_posts: {
        Row: {
          content: string
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          stream_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          stream_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          stream_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stream_posts_stream_id_fkey"
            columns: ["stream_id"]
            isOneToOne: false
            referencedRelation: "streams"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          description: string | null
          follower_count: number | null
          id: string
          is_verified: boolean | null
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          follower_count?: number | null
          id?: string
          is_verified?: boolean | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          created_at: string | null
          document_category: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_emergency_accessible: boolean | null
          notes: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_category: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_emergency_accessible?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_category?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_emergency_accessible?: boolean | null
          notes?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_last_seen: {
        Row: {
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_type: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_group_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      can_view_profile: {
        Args: { profile_user_id: string; viewer_id: string }
        Returns: boolean
      }
      can_view_profile_rate_limited: {
        Args: { profile_user_id: string; viewer_id: string }
        Returns: boolean
      }
      check_ai_chat_rate_limit: {
        Args: {
          p_max_requests?: number
          p_user_id: string
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_in: number
        }[]
      }
      check_contact_rate_limit: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      check_login_rate_limit: {
        Args: { identifier_text: string }
        Returns: boolean
      }
      check_message_rate_limit: {
        Args: { conv_id: string; user_uuid: string }
        Returns: boolean
      }
      cleanup_ai_chat_rate_limits: { Args: never; Returns: undefined }
      create_group_conversation: {
        Args: { p_group_name: string; p_member_ids: string[] }
        Returns: string
      }
      find_user_by_phone: {
        Args: { input_phone: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      find_user_by_username: {
        Args: { input_username: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      get_email_by_username: {
        Args: { input_username: string }
        Returns: string
      }
      get_email_by_username_rate_limited: {
        Args: { input_username: string }
        Returns: string
      }
      get_or_create_conversation: {
        Args: { other_user_id: string }
        Returns: string
      }
      get_own_phone_number: { Args: { user_uuid: string }; Returns: string }
      get_safe_profile: {
        Args: { profile_user_id: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          status: string
          user_id: string
          username: string
        }[]
      }
      get_unread_counts: {
        Args: { user_uuid: string }
        Returns: {
          conversation_id: string
          unread_count: number
        }[]
      }
      get_viewable_profile: {
        Args: { profile_user_id: string; viewer_id: string }
        Returns: {
          auto_translate: boolean
          avatar_url: string
          bio: string
          created_at: string
          display_name: string
          preferred_language: string
          status: string
          updated_at: string
          user_id: string
          username: string
        }[]
      }
      has_premium_access: { Args: { user_uuid: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_identifier: { Args: { identifier_text: string }; Returns: string }
      is_call_participant: {
        Args: { call_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_caller: {
        Args: { call_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conversation_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_meeting_creator: {
        Args: { meeting_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_meeting_participant: {
        Args: { meeting_uuid: string; user_uuid: string }
        Returns: boolean
      }
      is_username_available: {
        Args: { check_username: string }
        Returns: boolean
      }
      mark_messages_read: {
        Args: { conv_id: string; user_uuid: string }
        Returns: undefined
      }
      phone_number_exists: { Args: { input_phone: string }; Returns: boolean }
      record_login_attempt: {
        Args: { identifier_text: string; was_successful: boolean }
        Returns: undefined
      }
      search_users_for_meeting: {
        Args: { search_term: string }
        Returns: {
          display_name: string
          user_id: string
          username: string
        }[]
      }
      semantic_search: {
        Args: {
          conversation_filter?: string
          end_date?: string
          match_count?: number
          match_threshold?: number
          message_type_filter?: string
          query_embedding: string
          sender_filter?: string
          start_date?: string
          user_id: string
        }
        Returns: {
          content: string
          content_preview: string
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          message_type: string
          sender_id: string
          similarity: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

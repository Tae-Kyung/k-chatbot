export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      universities: {
        Row: {
          id: string;
          name: string;
          name_en: string;
          logo_url: string | null;
          primary_color: string;
          secondary_color: string;
          messenger_links: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_en: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          messenger_links?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          name_en?: string;
          logo_url?: string | null;
          primary_color?: string;
          secondary_color?: string;
          messenger_links?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      admin_profiles: {
        Row: {
          id: string;
          user_id: string;
          university_id: string;
          role: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          university_id: string;
          role?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          university_id?: string;
          role?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          university_id: string;
          file_name: string;
          file_type: string;
          storage_path: string | null;
          status: string;
          metadata: Json;
          language: string | null;
          doc_type: string | null;
          chunk_strategy: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          file_name: string;
          file_type: string;
          storage_path?: string | null;
          status?: string;
          metadata?: Json;
          language?: string | null;
          doc_type?: string | null;
          chunk_strategy?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          file_name?: string;
          file_type?: string;
          storage_path?: string | null;
          status?: string;
          metadata?: Json;
          language?: string | null;
          doc_type?: string | null;
          chunk_strategy?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          university_id: string;
          content: string;
          metadata: Json;
          embedding: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          university_id: string;
          content: string;
          metadata?: Json;
          embedding?: string | null;
        };
        Update: {
          id?: string;
          document_id?: string;
          university_id?: string;
          content?: string;
          metadata?: Json;
          embedding?: string | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          university_id: string;
          language: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          language?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          language?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: string;
          content: string;
          sources: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: string;
          content: string;
          sources?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: string;
          content?: string;
          sources?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      feedback: {
        Row: {
          id: string;
          message_id: string;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      telegram_chat_mappings: {
        Row: {
          id: string;
          telegram_chat_id: number;
          bot_id: string;
          university_id: string;
          conversation_id: string;
          language: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          telegram_chat_id: number;
          bot_id: string;
          university_id: string;
          conversation_id: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          telegram_chat_id?: number;
          bot_id?: string;
          university_id?: string;
          conversation_id?: string;
          language?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rag_settings: {
        Row: {
          id: string;
          university_id: string;
          embedding_model: string;
          top_k: number;
          match_threshold: number;
          rerank_enabled: boolean;
          hyde_enabled: boolean;
          suggested_questions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          embedding_model?: string;
          top_k?: number;
          match_threshold?: number;
          rerank_enabled?: boolean;
          hyde_enabled?: boolean;
          suggested_questions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          university_id?: string;
          embedding_model?: string;
          top_k?: number;
          match_threshold?: number;
          rerank_enabled?: boolean;
          hyde_enabled?: boolean;
          suggested_questions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_documents: {
        Args: {
          query_embedding: string;
          match_count: number;
          filter_university_id: string | null;
          match_threshold?: number;
        };
        Returns: {
          id: string;
          content: string;
          metadata: Json;
          similarity: number;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export type University = Database['public']['Tables']['universities']['Row'];
export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentChunk =
  Database['public']['Tables']['document_chunks']['Row'];
export type Conversation =
  Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type Feedback = Database['public']['Tables']['feedback']['Row'];
export type AdminProfile =
  Database['public']['Tables']['admin_profiles']['Row'];
export type TelegramChatMapping =
  Database['public']['Tables']['telegram_chat_mappings']['Row'];
export type RagSettings =
  Database['public']['Tables']['rag_settings']['Row'];

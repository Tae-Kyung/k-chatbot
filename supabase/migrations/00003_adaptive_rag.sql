-- Migration: Adaptive RAG system
-- Adds language/doc_type/chunk_strategy to documents, creates rag_settings table,
-- updates match_documents RPC with threshold parameter

-- 1-A. Add columns to documents table
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS language text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS doc_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chunk_strategy jsonb DEFAULT NULL;

-- 1-B. Create rag_settings table
CREATE TABLE IF NOT EXISTS public.rag_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  embedding_model text NOT NULL DEFAULT 'text-embedding-3-small',
  top_k integer NOT NULL DEFAULT 5 CHECK (top_k >= 1 AND top_k <= 20),
  match_threshold float NOT NULL DEFAULT 0.3 CHECK (match_threshold >= 0.0 AND match_threshold <= 1.0),
  rerank_enabled boolean NOT NULL DEFAULT false,
  hyde_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(university_id)
);

-- 1-C. RLS policies for rag_settings
ALTER TABLE public.rag_settings ENABLE ROW LEVEL SECURITY;

-- Admins can read their own university settings
CREATE POLICY "Admins can read own university rag_settings"
  ON public.rag_settings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid() AND university_id = rag_settings.university_id
    )
  );

-- Admins can insert their own university settings
CREATE POLICY "Admins can insert own university rag_settings"
  ON public.rag_settings FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid() AND university_id = rag_settings.university_id
    )
  );

-- Admins can update their own university settings
CREATE POLICY "Admins can update own university rag_settings"
  ON public.rag_settings FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_profiles
      WHERE user_id = auth.uid() AND university_id = rag_settings.university_id
    )
  );

-- Service role can read all settings (used by chat API)
CREATE POLICY "Service role can read all rag_settings"
  ON public.rag_settings FOR SELECT USING (true);

-- 1-D. Update match_documents RPC with match_threshold parameter
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding extensions.vector(1536),
  match_count int DEFAULT 5,
  filter_university_id uuid DEFAULT NULL,
  match_threshold float DEFAULT 0.0
) RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  WHERE (filter_university_id IS NULL OR dc.university_id = filter_university_id)
    AND (1 - (dc.embedding <=> query_embedding)) >= match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 1-E. Seed default rag_settings for existing universities
INSERT INTO public.rag_settings (university_id, embedding_model, top_k, match_threshold, rerank_enabled, hyde_enabled)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'text-embedding-3-small', 5, 0.3, false, false),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'text-embedding-3-small', 5, 0.3, false, false),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'text-embedding-3-small', 5, 0.3, false, false)
ON CONFLICT (university_id) DO NOTHING;

-- Drop and recreate the semantic_search function with proper schema qualification
DROP FUNCTION IF EXISTS public.semantic_search;

CREATE OR REPLACE FUNCTION public.semantic_search(
  query_embedding text,
  user_id uuid,
  conversation_filter uuid DEFAULT NULL,
  sender_filter uuid DEFAULT NULL,
  start_date timestamptz DEFAULT NULL,
  end_date timestamptz DEFAULT NULL,
  message_type_filter text DEFAULT NULL,
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  message_id uuid,
  conversation_id uuid,
  content_preview text,
  content text,
  created_at timestamptz,
  sender_id uuid,
  message_type text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    me.id,
    me.message_id,
    me.conversation_id,
    me.content_preview,
    m.content,
    me.created_at,
    m.sender_id,
    m.message_type,
    (1 - (me.embedding::extensions.vector <=> query_embedding::extensions.vector))::float as similarity
  FROM message_embeddings me
  JOIN messages m ON me.message_id = m.id
  JOIN conversation_participants cp ON me.conversation_id = cp.conversation_id
  WHERE cp.user_id = semantic_search.user_id
    AND (1 - (me.embedding::extensions.vector <=> query_embedding::extensions.vector)) > match_threshold
    AND (conversation_filter IS NULL OR me.conversation_id = conversation_filter)
    AND (sender_filter IS NULL OR m.sender_id = sender_filter)
    AND (start_date IS NULL OR me.created_at >= start_date)
    AND (end_date IS NULL OR me.created_at <= end_date)
    AND (message_type_filter IS NULL OR m.message_type = message_type_filter)
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
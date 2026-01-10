-- Create a table to track user last seen timestamps
CREATE TABLE public.user_last_seen (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_last_seen ENABLE ROW LEVEL SECURITY;

-- Anyone can read last seen data (for displaying to other users)
CREATE POLICY "Last seen is publicly readable"
ON public.user_last_seen
FOR SELECT
USING (true);

-- Users can only update their own last seen
CREATE POLICY "Users can upsert their own last seen"
ON public.user_last_seen
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own last seen"
ON public.user_last_seen
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_last_seen_user_id ON public.user_last_seen(user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_last_seen;
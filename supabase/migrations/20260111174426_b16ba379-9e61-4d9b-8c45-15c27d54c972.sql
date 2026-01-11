-- Create enum for badge types
CREATE TYPE public.badge_type AS ENUM ('premium', 'staff', 'partner');

-- Create user_badges table
CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge badge_type NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  granted_by UUID,
  UNIQUE (user_id, badge)
);

-- Enable RLS
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can view badges (public display)
CREATE POLICY "Anyone can view user badges"
ON public.user_badges
FOR SELECT
USING (true);

-- Only admins can insert badges
CREATE POLICY "Only admins can insert badges"
ON public.user_badges
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Only admins can delete badges
CREATE POLICY "Only admins can delete badges"
ON public.user_badges
FOR DELETE
USING (has_role(auth.uid(), 'admin'));
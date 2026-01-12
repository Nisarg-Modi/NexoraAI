-- Create badge_requests table for user badge applications
CREATE TABLE public.badge_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge badge_type NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge, status)
);

-- Enable RLS
ALTER TABLE public.badge_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view their own badge requests"
ON public.badge_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create badge requests"
ON public.badge_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Users can delete their pending requests
CREATE POLICY "Users can delete pending requests"
ON public.badge_requests
FOR DELETE
USING (auth.uid() = user_id AND status = 'pending');

-- Admins can view all requests
CREATE POLICY "Admins can view all badge requests"
ON public.badge_requests
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update badge requests"
ON public.badge_requests
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_badge_requests_updated_at
BEFORE UPDATE ON public.badge_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
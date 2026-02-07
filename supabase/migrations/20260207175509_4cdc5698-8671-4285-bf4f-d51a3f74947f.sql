-- Add new badge types to the badge_type enum
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'influencer';
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'doctor';
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'engineer';
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'artist';
ALTER TYPE public.badge_type ADD VALUE IF NOT EXISTS 'educator';
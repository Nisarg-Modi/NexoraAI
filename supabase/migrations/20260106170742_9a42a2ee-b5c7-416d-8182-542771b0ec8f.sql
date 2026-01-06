-- Add social links fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN twitter_url text,
ADD COLUMN linkedin_url text,
ADD COLUMN instagram_url text,
ADD COLUMN website_url text;
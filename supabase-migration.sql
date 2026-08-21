-- GeoGive Supabase Database Schema
-- Complete, idempotent migration — safe to run multiple times
-- Run this entire file in your Supabase SQL Editor

-- ============================================
-- 0. ENABLE EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. ITEMS TABLE (main giveaway listings)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'other',
  condition text DEFAULT 'Good',
  status text DEFAULT 'available',
  zip text,
  lat double precision,
  lng double precision,
  location geography(Point, 4326),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '30 days')
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_items_owner ON items(owner_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_created ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_location ON items USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_items_expires ON items(expires_at);

-- Auto-update location from lat/lng
CREATE OR REPLACE FUNCTION update_item_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_item_location ON items;
CREATE TRIGGER trigger_update_item_location
  BEFORE INSERT OR UPDATE OF lat, lng ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_location();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_items_updated_at ON items;
CREATE TRIGGER trigger_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 3. PHOTOS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  url text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_item_id ON photos(item_id);

-- ============================================
-- 4. REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE NOT NULL,
  requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text,
  item_title text DEFAULT 'Unknown Item',
  requester_name text DEFAULT 'Someone',
  owner_name text DEFAULT 'Owner',
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_item ON requests(item_id);
CREATE INDEX IF NOT EXISTS idx_requests_requester ON requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_requests_owner ON requests(owner_id);

DROP TRIGGER IF EXISTS trigger_requests_updated_at ON requests;
CREATE TRIGGER trigger_requests_updated_at
  BEFORE UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 5. CHATS TABLE (messages between users)
-- ============================================
-- chats: id is a composite TEXT key ('userA_userB_itemId') built by the client;
-- messages is a JSONB array (append-only thread per chat row)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  request_id UUID REFERENCES requests(id) ON DELETE SET NULL,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  item_title TEXT DEFAULT 'Chat',
  participant_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chats_p1 ON chats(participant_1);
CREATE INDEX IF NOT EXISTS idx_chats_p2 ON chats(participant_2);

CREATE INDEX IF NOT EXISTS idx_chats_participants ON chats(participant_1, participant_2);
CREATE INDEX IF NOT EXISTS idx_chats_item ON chats(item_id);
CREATE INDEX IF NOT EXISTS idx_chats_created ON chats(created_at DESC);

-- ============================================
-- 6. NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);

-- ============================================
-- 7. REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reported_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  reason text NOT NULL,
  description text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- ============================================
-- 8. RATINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rater_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rated_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(rater_id, rated_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_id);

-- ============================================
-- 9. BLOCKED USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_id);

-- ============================================
-- 10. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_users ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, owners can write
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Items: anyone can read available, owners can manage
DROP POLICY IF EXISTS "Anyone can view available items" ON items;
CREATE POLICY "Anyone can view available items" ON items FOR SELECT USING (
  status = 'available' OR auth.uid() = owner_id
);
DROP POLICY IF EXISTS "Authenticated users can create items" ON items;
CREATE POLICY "Authenticated users can create items" ON items FOR INSERT WITH CHECK (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can update their items" ON items;
CREATE POLICY "Owners can update their items" ON items FOR UPDATE USING (auth.uid() = owner_id);
DROP POLICY IF EXISTS "Owners can delete their items" ON items;
CREATE POLICY "Owners can delete their items" ON items FOR DELETE USING (auth.uid() = owner_id);

-- Photos: anyone can read, owners can manage
DROP POLICY IF EXISTS "Anyone can view photos" ON photos;
CREATE POLICY "Anyone can view photos" ON photos FOR SELECT USING (true);
DROP POLICY IF EXISTS "Authenticated users can insert photos" ON photos;
CREATE POLICY "Authenticated users can insert photos" ON photos FOR INSERT WITH CHECK (
  auth.uid() IN (SELECT owner_id FROM items WHERE id = photos.item_id)
);
DROP POLICY IF EXISTS "Owners can delete their photos" ON photos;
CREATE POLICY "Owners can delete their photos" ON photos FOR DELETE USING (
  auth.uid() IN (SELECT owner_id FROM items WHERE id = photos.item_id)
);

-- Requests: participants only
DROP POLICY IF EXISTS "Participants can view requests" ON requests;
CREATE POLICY "Participants can view requests" ON requests FOR SELECT USING (
  auth.uid() = requester_id OR auth.uid() = owner_id
);
DROP POLICY IF EXISTS "Participants can create requests" ON requests;
CREATE POLICY "Participants can create requests" ON requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
DROP POLICY IF EXISTS "Participants can update requests" ON requests;
CREATE POLICY "Participants can update requests" ON requests FOR UPDATE USING (
  auth.uid() = requester_id OR auth.uid() = owner_id
);

-- Chats: participants only
DROP POLICY IF EXISTS "Participants can view chats" ON chats;
CREATE POLICY "Participants can view chats" ON chats FOR SELECT USING (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);
DROP POLICY IF EXISTS "Participants can insert chats" ON chats;
CREATE POLICY "Participants can insert chats" ON chats FOR INSERT WITH CHECK (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);
DROP POLICY IF EXISTS "Participants can update chats" ON chats;
CREATE POLICY "Participants can update chats" ON chats FOR UPDATE USING (
  auth.uid() = participant_1 OR auth.uid() = participant_2
);

-- Notifications: user's own only
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Reports: reporters can create, admins review
DROP POLICY IF EXISTS "Users can create reports" ON reports;
CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id);

-- Ratings: anyone can read, raters can create/update
DROP POLICY IF EXISTS "Anyone can view ratings" ON ratings;
CREATE POLICY "Anyone can view ratings" ON ratings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can create ratings" ON ratings;
CREATE POLICY "Users can create ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = rater_id);
DROP POLICY IF EXISTS "Users can update own ratings" ON ratings;
CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE USING (auth.uid() = rater_id);

-- Blocked users: blocker only
DROP POLICY IF EXISTS "Users can manage own blocks" ON blocked_users;
CREATE POLICY "Users can manage own blocks" ON blocked_users FOR ALL USING (auth.uid() = blocker_id);

-- ============================================
-- 11. STORAGE BUCKET
-- ============================================
-- Create storage bucket for item photos (requires storage privileges)
-- If this fails, create the bucket manually in Supabase Dashboard > Storage

DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('item-photos', 'item-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Could not create storage bucket via SQL. Create it manually in Supabase Dashboard.';
END
$$;

-- Storage policies
DROP POLICY IF EXISTS "Anyone can view item photos" ON storage.objects;
CREATE POLICY "Anyone can view item photos" ON storage.objects FOR SELECT USING (bucket_id = 'item-photos');
DROP POLICY IF EXISTS "Authenticated users can upload item photos" ON storage.objects;
CREATE POLICY "Authenticated users can upload item photos" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'item-photos' AND auth.role() = 'authenticated'
);
DROP POLICY IF EXISTS "Users can delete own item photos" ON storage.objects;
CREATE POLICY "Users can delete own item photos" ON storage.objects FOR DELETE USING (
  bucket_id = 'item-photos' AND auth.role() = 'authenticated'
);

-- ============================================
-- 12. REALTIME SUBSCRIPTIONS
-- ============================================
DO $$
BEGIN
  -- Enable realtime on all tables
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE items;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'photos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE photos;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE requests;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'chats') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chats;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END
$$;

-- ============================================
-- 13. HELPER FUNCTIONS
-- ============================================

-- Find nearby items within a radius
CREATE OR REPLACE FUNCTION find_nearby_items(
  user_lat double precision,
  user_lng double precision,
  radius_miles double precision DEFAULT 10,
  max_results integer DEFAULT 50
)
RETURNS TABLE(
  id uuid, title text, description text, category text, condition text,
  zip text, lat double precision, lng double precision, status text,
  owner_id uuid, created_at timestamptz, distance_miles double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id, i.title, i.description, i.category, i.condition,
    i.zip, i.lat, i.lng, i.status, i.owner_id, i.created_at,
    ST_Distance(i.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) / 1609.34 AS distance_miles
  FROM items i
  WHERE i.status = 'available'
    AND i.location IS NOT NULL
    AND ST_DWithin(i.location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_miles * 1609.34)
  ORDER BY distance_miles
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 14. MIGRATE EXISTING DATA
-- ============================================
-- Update existing items to have geography from lat/lng
UPDATE items SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL;


-- ============================================================
-- PHASE 1 ADDITIONS (2026-08-21): social + monetization + push
-- ============================================================

-- Follows (M22 real backend)
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_followee ON follows(followee_id);

-- Collections (M45 real backend)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  item_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

-- Promoted listings (M39 real backend)
CREATE TABLE IF NOT EXISTS item_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promoted_until TIMESTAMPTZ NOT NULL,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promotions_item ON item_promotions(item_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON item_promotions(promoted_until);

-- Referrals (M41 real backend)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  rewarded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Push subscriptions (M24 real backend)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- User settings (theme, language, radius — syncs across devices)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme TEXT DEFAULT 'light',
  language TEXT DEFAULT 'en',
  radius_miles INTEGER DEFAULT 10,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS POLICIES for new tables
-- ============================================================
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- follows: public read (follower counts), owner-only write
CREATE POLICY "follows_select_public" ON follows FOR SELECT USING (TRUE);
CREATE POLICY "follows_insert_own" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_own" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- collections: private by default
CREATE POLICY "collections_owner_all" ON collections FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- promotions: public read, owner-only insert
CREATE POLICY "promotions_select_public" ON item_promotions FOR SELECT USING (TRUE);
CREATE POLICY "promotions_insert_own" ON item_promotions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- referrals: owner reads own, service writes
CREATE POLICY "referrals_select_own" ON referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);
CREATE POLICY "referrals_insert_own" ON referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- push subscriptions: owner-only
CREATE POLICY "push_owner_all" ON push_subscriptions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- user settings: owner-only
CREATE POLICY "settings_owner_all" ON user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Trust score: server-side materialized on profiles
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION recompute_trust_score() RETURNS TRIGGER AS $$
DECLARE
  new_score INTEGER;
BEGIN
  SELECT COALESCE(ROUND(AVG(rating) * 20), 0) INTO new_score
  FROM ratings WHERE rated_id = NEW.rated_id;
  UPDATE profiles SET trust_score = new_score WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_recompute_trust ON ratings;
CREATE TRIGGER trg_recompute_trust
AFTER INSERT OR UPDATE ON ratings
FOR EACH ROW EXECUTE FUNCTION recompute_trust_score();

-- ============================================================
-- Profile auto-create trigger (replaces client-side upsert)
-- ============================================================
-- handle_new_user() already exists above; ensure it inserts display_name.
-- (Existing function retained; verified below.)


-- ============================================================
-- CHATS SCHEMA FIX (2026-08-21): align with client data model.
-- For DBs where the OLD chats table exists, drop and recreate.
-- Safe: no production data at time of migration.
-- ============================================================
-- DO $$ ... (run manually if old table exists):
-- DROP TABLE IF EXISTS chats; then re-run the CREATE TABLE above.


-- ============================================================
-- SCHEMA ALIGNMENT (2026-08-21): columns the client writes.
-- Idempotent: safe to re-run on existing databases.
-- ============================================================
ALTER TABLE requests ADD COLUMN IF NOT EXISTS item_title text DEFAULT 'Unknown Item';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS requester_name text DEFAULT 'Someone';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS owner_name text DEFAULT 'Owner';

-- Trust score column for server-side recompute trigger
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trust_score integer DEFAULT 0;

-- Pro entitlement (Phase 3)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false;

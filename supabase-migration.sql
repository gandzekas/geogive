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
CREATE TABLE IF NOT EXISTS chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  participant_1 uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_2 uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

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
CREATE POLICY "Participants can insert chats" ON chats FOR INSERT WITH CHECK (auth.uid() = sender_id);
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

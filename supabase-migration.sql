-- GeoGive Supabase Migration: Image Storage + Real-time + PostGIS
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. ENABLE POSTGIS (for geo queries)
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 2. PROFILES TABLE (user profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 3. PHOTOS TABLE (replaces base64 in items.photos)
-- ============================================
CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES items(id) ON DELETE CASCADE,
  url text NOT NULL,
  "order" integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_photos_item_id ON photos(item_id);

-- ============================================
-- 3. ADD LAT/LNG COLUMNS TO ITEMS (if not exists)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='lat') THEN
    ALTER TABLE items ADD COLUMN lat double precision;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='lng') THEN
    ALTER TABLE items ADD COLUMN lng double precision;
  END IF;
END
$$;

-- ============================================
-- 4. ADD GEOGRAPHY COLUMN (for PostGIS queries)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='location') THEN
    ALTER TABLE items ADD COLUMN location geography(Point, 4326);
  END IF;
END
$$;

-- Function to auto-update geography from lat/lng
CREATE OR REPLACE FUNCTION update_item_location()
RETURNS trigger AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.location = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update location
DROP TRIGGER IF EXISTS trigger_update_item_location ON items;
CREATE TRIGGER trigger_update_item_location
  BEFORE INSERT OR UPDATE OF lat, lng ON items
  FOR EACH ROW EXECUTE FUNCTION update_item_location();

-- Geography index for fast distance queries
CREATE INDEX IF NOT EXISTS idx_items_location ON items USING GIST(location);

-- ============================================
-- 5. STORAGE BUCKET FOR ITEM PHOTOS
-- ============================================
-- Run this via Supabase Dashboard > Storage > Create Bucket
-- Bucket name: item-photos
-- Public: true
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- Or via SQL (if your Supabase version supports it):
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('item-photos', 'item-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
-- ON CONFLICT (id) DO NOTHING;

-- Storage policy: anyone can read
CREATE POLICY "Anyone can view item photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-photos');

-- Storage policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload item photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'item-photos' AND auth.role() = 'authenticated');

-- Storage policy: only item owners can delete photos from storage
-- Note: Storage RLS can't join to items table, so we use a security definer function
-- For now, the application layer enforces this. The policy below is permissive
-- but the frontend only shows delete buttons to item owners.
-- TODO: Create a security definer function for storage ownership check if needed.
CREATE POLICY "Users can delete item photos" ON storage.objects
  FOR DELETE USING (bucket_id = 'item-photos' AND auth.role() = 'authenticated');

-- ============================================
-- 6. ENABLE REALTIME ON TABLES (idempotent)
-- ============================================
DO $$
BEGIN
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
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
END
$$;

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Items: anyone can read available items
CREATE POLICY "Anyone can view available items" ON items
  FOR SELECT USING (status = 'available');

-- Items: authenticated users can create
CREATE POLICY "Authenticated users can create items" ON items
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Items: owners can update/delete their items
CREATE POLICY "Owners can update their items" ON items
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their items" ON items
  FOR DELETE USING (auth.uid() = owner_id);

-- Photos: anyone can read
CREATE POLICY "Anyone can view photos" ON photos
  FOR SELECT USING (true);

-- Photos: authenticated users can insert
CREATE POLICY "Authenticated users can insert photos" ON photos
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT owner_id FROM items WHERE id = photos.item_id)
  );

-- Photos: owners can delete
CREATE POLICY "Owners can delete their photos" ON photos
  FOR DELETE USING (
    auth.uid() IN (SELECT owner_id FROM items WHERE id = photos.item_id)
  );

-- Requests: participants can read/write
CREATE POLICY "Participants can view requests" ON requests
  FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create requests" ON requests
  FOR INSERT WITH CHECK (auth.uid() = requester_id);

-- Chats: participants can read/write
CREATE POLICY "Participants can view chats" ON chats
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Participants can update chats" ON chats
  FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Profiles: anyone can read, owners can update
CREATE POLICY "Anyone can view profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================
-- 8. HELPER FUNCTION: Find nearby items
-- ============================================
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

-- ============================================
-- 9. MIGRATE EXISTING DATA
-- ============================================
-- Convert existing base64 photos to storage (run once)
-- NOTE: This won't work for base64 data in the DB. You'll need to:
-- 1. Export existing items with photos
-- 2. Upload photos to storage via a script
-- 3. Insert photo records
-- For new items, the frontend handles this automatically.

-- Update existing items to have geography from lat/lng
UPDATE items SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE lat IS NOT NULL AND lng IS NOT NULL AND location IS NULL;

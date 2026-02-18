-- 019: Split full_name into first_name/last_name, add date_of_birth

-- 1. Add new columns
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS first_name TEXT NOT NULL DEFAULT '';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_name TEXT NOT NULL DEFAULT '';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2. Migrate existing full_name data
UPDATE profiles
  SET first_name = split_part(full_name, ' ', 1),
      last_name  = CASE
        WHEN position(' ' IN full_name) > 0
          THEN substring(full_name FROM position(' ' IN full_name) + 1)
        ELSE ''
      END
  WHERE full_name != '' AND first_name = '';

-- 3. Update trigger to populate first_name/last_name from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'last_name', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

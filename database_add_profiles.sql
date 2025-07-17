-- User Profiles System Migration
-- Add user profiles table for DexDirectory feature

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    biography TEXT CHECK (length(biography) <= 500),
    profile_background_id VARCHAR(50) DEFAULT 'sandstone',
    interest_tags TEXT CHECK (length(interest_tags) <= 200),
    privacy_setting VARCHAR(20) DEFAULT 'public' CHECK (privacy_setting IN ('public', 'friends', 'private')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for search performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_privacy ON user_profiles(privacy_setting);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tags ON user_profiles USING gin(to_tsvector('english', interest_tags));
CREATE INDEX IF NOT EXISTS idx_user_profiles_updated ON user_profiles(updated_at);

-- Function to automatically create user profile for new users
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (user_id, biography, interest_tags, privacy_setting) 
    VALUES (NEW.id, '', '', 'public');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update existing trigger to also create user profile
DROP TRIGGER IF EXISTS trigger_create_user_profile ON users;
CREATE TRIGGER trigger_create_user_profile
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Create profiles for existing users who don't have one
INSERT INTO user_profiles (user_id, biography, interest_tags, privacy_setting)
SELECT id, '', '', 'public' 
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_profiles);

-- Function to update profile timestamp
CREATE OR REPLACE FUNCTION update_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update profile timestamp on changes
CREATE TRIGGER trigger_update_profile_timestamp
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_timestamp();

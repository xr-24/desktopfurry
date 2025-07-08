-- Retro Desktop Game Database Schema
-- Run this in PgAdmin Query Tool

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    guest_token VARCHAR(255) UNIQUE,
    user_type VARCHAR(20) DEFAULT 'guest' CHECK (user_type IN ('guest', 'registered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT username_length CHECK (length(username) >= 3),
    CONSTRAINT valid_email CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Dextops table
CREATE TABLE dextops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) DEFAULT 'My Dextop',
    background_id VARCHAR(50) DEFAULT 'sandstone',
    is_public BOOLEAN DEFAULT false,
    allow_visitors BOOLEAN DEFAULT true,
    allow_visitor_interaction BOOLEAN DEFAULT false,
    max_visitors INTEGER DEFAULT 4,
    visit_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT dextop_name_length CHECK (length(name) >= 1)
);

-- Program states table (for persistent window positions/states)
CREATE TABLE program_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dextop_id UUID NOT NULL REFERENCES dextops(id) ON DELETE CASCADE,
    program_type VARCHAR(50) NOT NULL,
    position_x INTEGER NOT NULL DEFAULT 100,
    position_y INTEGER NOT NULL DEFAULT 100,
    width INTEGER NOT NULL DEFAULT 400,
    height INTEGER NOT NULL DEFAULT 300,
    z_index INTEGER NOT NULL DEFAULT 100,
    is_minimized BOOLEAN DEFAULT false,
    program_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_position CHECK (position_x >= 0 AND position_y >= 0),
    CONSTRAINT valid_size CHECK (width > 0 AND height > 0)
);

-- Achievements table
CREATE TABLE achievements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(10),
    unlocks_program VARCHAR(50),
    points INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User achievements junction table
CREATE TABLE user_achievements (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

-- Items table for inventory system
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    asset_path VARCHAR(500),
    cost INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User items junction table
CREATE TABLE IF NOT EXISTS user_items (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, item_id)
);

-- Titles table for user titles
CREATE TABLE IF NOT EXISTS titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    style_config JSONB DEFAULT '{}',
    cost INTEGER DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User titles junction table
CREATE TABLE IF NOT EXISTS user_titles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title_id UUID REFERENCES titles(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, title_id)
);

-- Avatar appearances table
CREATE TABLE avatar_appearances (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    hue INTEGER DEFAULT 0 CHECK (hue >= 0 AND hue <= 360),
    eyes VARCHAR(50) DEFAULT 'none',
    ears VARCHAR(50) DEFAULT 'none',
    fluff VARCHAR(50) DEFAULT 'none',
    tail VARCHAR(50) DEFAULT 'none',
    body VARCHAR(50) DEFAULT 'CustomBase',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shop items table for purchasable content
CREATE TABLE shop_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('cosmetics', 'themes', 'backgrounds', 'games', 'titles', 'misc')),
    item_type VARCHAR(50) NOT NULL, -- 'item', 'title', 'program', 'theme', 'background'
    price INTEGER NOT NULL CHECK (price > 0),
    asset_path VARCHAR(500),
    metadata JSONB DEFAULT '{}', -- Store additional item-specific data like theme colors, program type, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User purchases table to track what users have bought
CREATE TABLE user_purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shop_item_id UUID NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    price_paid INTEGER NOT NULL,
    UNIQUE(user_id, shop_item_id)
);

-- Add money column to users table if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'money') THEN
        ALTER TABLE users ADD COLUMN money INTEGER DEFAULT 1000;
    END IF;
END $$;

-- Dextop visits table (for tracking who visited when)
CREATE TABLE dextop_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dextop_id UUID NOT NULL REFERENCES dextops(id) ON DELETE CASCADE,
    visitor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_minutes INTEGER,
    UNIQUE(dextop_id, visitor_user_id, visited_at)
);

-- Create friendships table
CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (user_id, friend_id)
);

-- Create index for faster friend lookups
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);

-- Indexes for performance
CREATE INDEX idx_users_guest_token ON users(guest_token);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_dextops_user_id ON dextops(user_id);
CREATE INDEX idx_dextops_public ON dextops(is_public) WHERE is_public = true;
CREATE INDEX idx_program_states_dextop ON program_states(dextop_id);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_dextop_visits_dextop ON dextop_visits(dextop_id);
CREATE INDEX idx_users_last_active ON users(last_active);
CREATE INDEX idx_shop_items_category ON shop_items(category);
CREATE INDEX idx_shop_items_active ON shop_items(is_active) WHERE is_active = true;
CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_item ON user_purchases(shop_item_id);
CREATE INDEX idx_items_active ON items(is_active) WHERE is_active = true;
CREATE INDEX idx_user_items_user ON user_items(user_id);
CREATE INDEX idx_titles_active ON titles(is_active) WHERE is_active = true;
CREATE INDEX idx_user_titles_user ON user_titles(user_id);

-- Insert default achievements
INSERT INTO achievements (code, name, description, icon, unlocks_program, points) VALUES
('WELCOME', 'Welcome to the Dextop!', 'Created your first personal dextop', '🎉', NULL, 10),
('FIRST_VISITOR', 'Social Starter', 'Had your first visitor', '👥', NULL, 20),
('SNAKE_BEGINNER', 'Snake Starter', 'Scored 50 points in Snake', '🐍', NULL, 15),
('SNAKE_EXPERT', 'Snake Master', 'Scored 200 points in Snake', '🏆', 'tetris', 50),
('NOTEPAD_WRITER', 'Digital Writer', 'Wrote 500 characters in Notepad', '✍️', NULL, 25),
('NOTEPAD_NOVELIST', 'Prolific Author', 'Wrote 2000 characters in Notepad', '📚', 'wordprocessor', 75),
('CUSTOMIZER', 'Style Maven', 'Changed your avatar appearance', '🎨', NULL, 15),
('BACKGROUND_CHANGER', 'Interior Designer', 'Changed desktop background 5 times', '🖼️', 'wallpaper_editor', 30),
('SOCIAL_BUTTERFLY', 'Popular Host', 'Had 10 different visitors', '🦋', 'guestbook', 100),
('PERSISTENT_USER', 'Account Holder', 'Created a registered account', '👤', 'file_manager', 25);

-- Insert initial shop items
INSERT INTO shop_items (name, description, category, item_type, price, asset_path, metadata) VALUES
-- Cosmetic Items
('Happy Face', 'A cheerful smiley face accessory', 'cosmetics', 'item', 500, '/assets/characters/items/misc/happyface.png', '{}'),
('Cat Head', 'Cute cat head accessory', 'cosmetics', 'item', 500, '/assets/characters/items/misc/cathead.png', '{}'),
('Gold Chain', 'Bling out with a gold chain', 'cosmetics', 'item', 750, '/assets/characters/items/misc/goldchain.png', '{}'),
('Silver Chain', 'Classic silver chain accessory', 'cosmetics', 'item', 600, '/assets/characters/items/misc/silverchain.png', '{}'),
('Black Bow Tie', 'Formal black bow tie', 'cosmetics', 'item', 400, '/assets/characters/items/misc/bowtie-black.png', '{}'),
('Blue Bow Tie', 'Stylish blue bow tie', 'cosmetics', 'item', 400, '/assets/characters/items/misc/bowtie-blue.png', '{}'),
('Green Bow Tie', 'Fresh green bow tie', 'cosmetics', 'item', 400, '/assets/characters/items/misc/bowtie-green.png', '{}'),
('Purple Bow Tie', 'Royal purple bow tie', 'cosmetics', 'item', 400, '/assets/characters/items/misc/bowtie-purple.png', '{}'),
('Red Bow Tie', 'Classic red bow tie', 'cosmetics', 'item', 400, '/assets/characters/items/misc/bowtie-red.png', '{}'),
('Blue Head Bow', 'Cute blue hair bow', 'cosmetics', 'item', 350, '/assets/characters/items/misc/headbow-blue.png', '{}'),
('Green Head Bow', 'Adorable green hair bow', 'cosmetics', 'item', 350, '/assets/characters/items/misc/headbow-green.png', '{}'),
('Pink Head Bow', 'Sweet pink hair bow', 'cosmetics', 'item', 350, '/assets/characters/items/misc/headbow-pink.png', '{}'),
('Purple Head Bow', 'Elegant purple hair bow', 'cosmetics', 'item', 350, '/assets/characters/items/misc/headbow-purple.png', '{}'),
('Lips', 'Stylish lips accessory', 'cosmetics', 'item', 300, '/assets/characters/items/misc/lips.png', '{}'),
('Popsicle', 'Cool popsicle treat', 'cosmetics', 'item', 200, '/assets/characters/items/misc/popscicle.png', '{}'),
('Pretty Bird', 'Beautiful bird companion', 'cosmetics', 'item', 800, '/assets/characters/items/misc/prettybirdie.png', '{}'),
('Handheld Device', 'Retro handheld gaming device', 'cosmetics', 'item', 600, '/assets/characters/items/misc/handheld.png', '{}'),
('UFO Vehicle', 'Hover around in a UFO!', 'cosmetics', 'item', 1500, '/assets/characters/items/vehicles/ufo.png', '{"type": "vehicle"}'),

-- Games (locked programs)
('Tetris', 'Classic block-stacking puzzle game', 'games', 'program', 1000, '', '{"program_type": "tetris"}'),
('Pong Tournament', 'Advanced Pong with tournaments', 'games', 'program', 1000, '', '{"program_type": "pong_tournament"}'),
('Chess', 'Classic strategy board game', 'games', 'program', 1200, '', '{"program_type": "chess"}'),
('File Manager', 'Browse and manage files', 'games', 'program', 800, '', '{"program_type": "file_manager"}'),

-- Themes (placeholder for now)
('Ocean Theme', 'Cool blue ocean-inspired theme', 'themes', 'theme', 1000, '', '{"primary": "#0066cc", "secondary": "#004499", "accent": "#66ccff"}'),
('Forest Theme', 'Natural green forest theme', 'themes', 'theme', 1000, '', '{"primary": "#228B22", "secondary": "#006400", "accent": "#90EE90"}'),
('Sunset Theme', 'Warm orange and pink sunset theme', 'themes', 'theme', 1000, '', '{"primary": "#ff6600", "secondary": "#cc3300", "accent": "#ffcc99"}'),

-- Backgrounds
('Palm Tree Paradise', 'Tropical palm tree background', 'backgrounds', 'background', 250, '', '{"background_id": "palm tree"}'),
('Sunset Vista', 'Beautiful sunset background', 'backgrounds', 'background', 250, '', '{"background_id": "sunset"}'),
('Purple Sponge', 'Unique purple sponge texture', 'backgrounds', 'background', 250, '', '{"background_id": "purple sponge"}'),
('Pink Flower', 'Delicate pink flower pattern', 'backgrounds', 'background', 250, '', '{"background_id": "pink flower"}'),
('Red Tile', 'Classic red tile pattern', 'backgrounds', 'background', 250, '', '{"background_id": "red tile"}'),
('Metal Links', 'Industrial metal chain pattern', 'backgrounds', 'background', 250, '', '{"background_id": "metal links"}'),
-- Titles (each costs 500)
('King', 'Royal title', 'titles', 'title', 500, '', '{"style_config": {"color": "#800080", "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Queen', 'Royal title for queens', 'titles', 'title', 500, '', '{"style_config": {"color": "#800080", "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Smelly', 'Pale green glowing title', 'titles', 'title', 500, '', '{"style_config": {"color": "#98FB98", "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Noob', 'Red glowing title', 'titles', 'title', 500, '', '{"style_config": {"color": "#ff0000", "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Tiny Baby', 'Baby blue glowing title', 'titles', 'title', 500, '', '{"style_config": {"color": "#89CFF0", "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Le Joker', 'Dual colored glowing title', 'titles', 'title', 500, '', '{"style_config": {"gradient": ["#00aa00", "#800080"], "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}'),
('Gaymer', 'Rainbow glowing title', 'titles', 'title', 500, '', '{"style_config": {"rainbow": true, "fontWeight": "bold", "textShadow": "0 0 5px #fff"}}');

-- Ensure corresponding rows exist in titles table
INSERT INTO titles (name, style_config, cost, description) VALUES
('King', '{"color":"#800080", "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Royal title') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Queen', '{"color":"#800080", "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Royal title for queens') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Smelly', '{"color":"#98FB98", "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Pale green glowing title') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Noob', '{"color":"#ff0000", "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Red glowing title') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Tiny Baby', '{"color":"#89CFF0", "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Baby blue glowing title') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Le Joker', '{"gradient":["#00aa00","#800080"], "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Dual colored glowing title') ON CONFLICT (name) DO NOTHING;
INSERT INTO titles (name, style_config, cost, description) VALUES
('Gaymer', '{"rainbow":true, "fontWeight":"bold", "textShadow":"0 0 5px #fff"}', 500, 'Rainbow glowing title') ON CONFLICT (name) DO NOTHING;

-- Function to automatically create dextop for new users
CREATE OR REPLACE FUNCTION create_user_dextop()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO dextops (user_id, name) 
    VALUES (NEW.id, NEW.username || '''s Dextop');
    
    INSERT INTO avatar_appearances (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create dextop on user creation
CREATE TRIGGER trigger_create_user_dextop
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_dextop();

-- Function to update dextop updated_at timestamp
CREATE OR REPLACE FUNCTION update_dextop_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE dextops SET updated_at = NOW() WHERE id = NEW.dextop_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update dextop timestamp when program_states change
CREATE TRIGGER trigger_update_dextop_timestamp
    AFTER INSERT OR UPDATE OR DELETE ON program_states
    FOR EACH ROW
    EXECUTE FUNCTION update_dextop_timestamp(); 
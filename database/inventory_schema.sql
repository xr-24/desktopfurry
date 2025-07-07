-- Add inventory-related columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS money INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS current_title_id UUID,
ADD COLUMN IF NOT EXISTS current_item_ids JSONB DEFAULT '[]'::jsonb;

-- Items table (extensible design for cosmetics)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'misc', 'hat', 'accessory', etc.
    asset_path VARCHAR(255) NOT NULL, -- relative path to asset
    cost INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Titles table (extensible design for user titles)
CREATE TABLE IF NOT EXISTS titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    style_config JSONB NOT NULL DEFAULT '{}', -- JSON for color, font-weight, text-shadow, etc.
    cost INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- User-owned items (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- User-owned titles (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id UUID NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, title_id)
);

-- Add foreign key constraints for current selections
ALTER TABLE users 
ADD CONSTRAINT fk_current_title 
FOREIGN KEY (current_title_id) REFERENCES titles(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_items_user_id ON user_items(user_id);
CREATE INDEX IF NOT EXISTS idx_user_items_item_id ON user_items(item_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_user_id ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_titles_title_id ON user_titles(title_id);
CREATE INDEX IF NOT EXISTS idx_items_type ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_active ON items(is_active);
CREATE INDEX IF NOT EXISTS idx_titles_active ON titles(is_active);

-- Insert default title: "Alpha Tester" (bold green with glow)
INSERT INTO titles (name, style_config, cost, description) 
VALUES (
    'Alpha Tester',
    '{"color": "#00ff00", "fontWeight": "bold", "textShadow": "0 0 4px #00ff00"}',
    0,
    'Awarded to early testers of the platform'
) ON CONFLICT DO NOTHING;

-- Insert default item: "HappyFace"
INSERT INTO items (name, type, asset_path, cost, description)
VALUES (
    'HappyFace',
    'misc',
    '/assets/characters/items/misc/happyface.png',
    0,
    'A cheerful smiley face accessory'
) ON CONFLICT DO NOTHING;

-- Grant default title and item to all existing users
INSERT INTO user_titles (user_id, title_id)
SELECT u.id, t.id 
FROM users u, titles t 
WHERE t.name = 'Alpha Tester'
ON CONFLICT (user_id, title_id) DO NOTHING;

INSERT INTO user_items (user_id, item_id)
SELECT u.id, i.id 
FROM users u, items i 
WHERE i.name = 'HappyFace'
ON CONFLICT (user_id, item_id) DO NOTHING; 
-- Theme System Setup for Retro Desktop Game
-- Run this in your PostgreSQL database

-- Add current_theme column to dextops table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'dextops' AND column_name = 'current_theme') THEN
        ALTER TABLE dextops ADD COLUMN current_theme VARCHAR(50) DEFAULT 'win98-default';
    END IF;
END $$;

-- Create user_themes table to track purchased themes
CREATE TABLE IF NOT EXISTS user_themes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id VARCHAR(50) NOT NULL,
    purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, theme_id)
);

-- Create index for faster theme lookups
CREATE INDEX IF NOT EXISTS idx_user_themes_user ON user_themes(user_id);

-- The themes are already in the shop_items table from the main schema
-- Ocean Theme, Forest Theme, and Sunset Theme should already be visible in the shop

-- Verify themes exist in shop_items
SELECT name, category, item_type, price FROM shop_items WHERE category = 'themes';

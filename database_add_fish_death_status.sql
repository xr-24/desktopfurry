-- Add death status to user_fish table
-- This allows dead fish to persist across sessions

ALTER TABLE user_fish ADD COLUMN IF NOT EXISTS is_dead BOOLEAN DEFAULT FALSE;
ALTER TABLE user_fish ADD COLUMN IF NOT EXISTS death_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_fish ADD COLUMN IF NOT EXISTS death_position_x FLOAT;
ALTER TABLE user_fish ADD COLUMN IF NOT EXISTS death_position_y FLOAT; 
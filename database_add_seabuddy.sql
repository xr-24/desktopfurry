-- SeaBuddy Database Schema
-- Add user fish table for persistent aquarium management

CREATE TABLE user_fish (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    fish_type VARCHAR(50) NOT NULL CHECK (fish_type IN ('fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'fish7', 'fish8')),
    fish_name VARCHAR(100) NOT NULL CHECK (length(fish_name) >= 1 AND length(fish_name) <= 100),
    tank_background VARCHAR(50) NOT NULL CHECK (tank_background IN ('tank-1', 'tank-2', 'tank-3', 'tank-4')),
    fish_x FLOAT DEFAULT 50 CHECK (fish_x >= 0 AND fish_x <= 100),
    fish_y FLOAT DEFAULT 50 CHECK (fish_y >= 0 AND fish_y <= 100),
    hunger_level INTEGER DEFAULT 100 CHECK (hunger_level >= 0 AND hunger_level <= 100),
    tank_cleanliness INTEGER DEFAULT 100 CHECK (tank_cleanliness >= 0 AND tank_cleanliness <= 100),
    last_fed TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_cleaned TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    decorations JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_user_fish_user_id ON user_fish(user_id);
CREATE INDEX idx_user_fish_updated ON user_fish(updated_at);

-- Function to update fish stats over time (decay)
CREATE OR REPLACE FUNCTION decay_fish_stats()
RETURNS void AS $$
BEGIN
    UPDATE user_fish 
    SET 
        hunger_level = GREATEST(0, hunger_level - 
            EXTRACT(EPOCH FROM (NOW() - last_fed)) / (30 * 60)  -- 1 point per 30 minutes
        ),
        tank_cleanliness = GREATEST(0, tank_cleanliness - 
            EXTRACT(EPOCH FROM (NOW() - last_cleaned)) / (45 * 60)  -- 1 point per 45 minutes  
        ),
        updated_at = NOW()
    WHERE updated_at < NOW() - INTERVAL '15 minutes';  -- Only update if haven't updated recently
END;
$$ LANGUAGE plpgsql;

-- You can call this function periodically from your server or set up a cron job
-- Example: SELECT decay_fish_stats(); 
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

-- Dextop visits table (for tracking who visited when)
CREATE TABLE dextop_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dextop_id UUID NOT NULL REFERENCES dextops(id) ON DELETE CASCADE,
    visitor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    visited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    duration_minutes INTEGER,
    UNIQUE(dextop_id, visitor_user_id, visited_at)
);

-- Indexes for performance
CREATE INDEX idx_users_guest_token ON users(guest_token);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_dextops_user_id ON dextops(user_id);
CREATE INDEX idx_dextops_public ON dextops(is_public) WHERE is_public = true;
CREATE INDEX idx_program_states_dextop ON program_states(dextop_id);
CREATE INDEX idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX idx_dextop_visits_dextop ON dextop_visits(dextop_id);
CREATE INDEX idx_users_last_active ON users(last_active);

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
-- Add avatar crop settings to user_profiles table
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS avatar_crop_scale DECIMAL(3,1) DEFAULT 2.2,
ADD COLUMN IF NOT EXISTS avatar_crop_offset_x DECIMAL(3,2) DEFAULT -0.5,
ADD COLUMN IF NOT EXISTS avatar_crop_offset_y DECIMAL(3,2) DEFAULT -0.3;

-- Add constraints to ensure valid values
ALTER TABLE user_profiles 
ADD CONSTRAINT check_avatar_crop_scale CHECK (avatar_crop_scale >= 1.0 AND avatar_crop_scale <= 5.0),
ADD CONSTRAINT check_avatar_crop_offset_x CHECK (avatar_crop_offset_x >= -2.0 AND avatar_crop_offset_x <= 2.0),
ADD CONSTRAINT check_avatar_crop_offset_y CHECK (avatar_crop_offset_y >= -2.0 AND avatar_crop_offset_y <= 2.0);

-- Update existing profiles to have default crop settings
UPDATE user_profiles 
SET 
  avatar_crop_scale = 2.2,
  avatar_crop_offset_x = -0.5,
  avatar_crop_offset_y = -0.3
WHERE 
  avatar_crop_scale IS NULL OR 
  avatar_crop_offset_x IS NULL OR 
  avatar_crop_offset_y IS NULL;

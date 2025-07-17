-- Add theme support to dextops table
ALTER TABLE dextops ADD COLUMN IF NOT EXISTS current_theme VARCHAR(50) DEFAULT 'win98-default';

-- Insert sample theme items into shop_items table
INSERT INTO shop_items (name, description, price, category, item_type, asset_path, metadata, is_active) VALUES
('Ocean Theme', 'A calming blue theme inspired by ocean waters', 500, 'themes', 'theme', '/placeholder-theme.png', 
 '{"colors": {"primary": "#b3d9ff", "secondary": "#e6f3ff", "accent": "#0066cc", "text": "#003366", "textSecondary": "#004499", "border": "#0080ff", "shadow": "#003366", "desktop": "#004080"}}', 
 true),
('Forest Theme', 'A natural green theme inspired by lush forests', 500, 'themes', 'theme', '/placeholder-theme.png',
 '{"colors": {"primary": "#c8e6c8", "secondary": "#e8f5e8", "accent": "#228B22", "text": "#1a4d1a", "textSecondary": "#006400", "border": "#90EE90", "shadow": "#1a4d1a", "desktop": "#2d5a2d"}}',
 true),
('Sunset Theme', 'A warm orange theme inspired by beautiful sunsets', 500, 'themes', 'theme', '/placeholder-theme.png',
 '{"colors": {"primary": "#ffcc99", "secondary": "#ffe6cc", "accent": "#ff6600", "text": "#663300", "textSecondary": "#cc3300", "border": "#ff9966", "shadow": "#663300", "desktop": "#cc4400"}}',
 true)
ON CONFLICT (name) DO NOTHING;

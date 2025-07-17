-- SQL to add the new themes to the shop_items table
-- Run this on your database to add the new themes

INSERT INTO shop_items (name, description, category, item_type, price, asset_path, metadata) VALUES
-- New Themes
('Orchid Theme', 'Elegant purple orchid-inspired theme with rich violet tones', 'themes', 'theme', 1000, '', '{"primary": "#e6d7ff", "secondary": "#f3ebff", "accent": "#8a2be2", "text": "#4d1a66", "textSecondary": "#6a1b9a", "border": "#c299ff", "shadow": "#4d1a66", "desktop": "#5d1a6b"}'),
('Pinkie Theme', 'Sweet pink theme with warm rose and magenta colors', 'themes', 'theme', 1000, '', '{"primary": "#ffd7e6", "secondary": "#ffebf0", "accent": "#e91e63", "text": "#661a33", "textSecondary": "#c2185b", "border": "#ff99cc", "shadow": "#661a33", "desktop": "#8e1538"}'),
('Joker Theme', 'Chaotic green and purple dual-color scheme for the mischievous', 'themes', 'theme', 1000, '', '{"primary": "#d7ffd7", "secondary": "#ebffeb", "accent": "#8a2be2", "text": "#1a4d1a", "textSecondary": "#6a1b9a", "border": "#99ff99", "shadow": "#1a4d1a", "desktop": "#2d5a2d"}'),
('Hotrod Theme', 'Fiery red racing theme with bold crimson and scarlet tones', 'themes', 'theme', 1000, '', '{"primary": "#ffd7d7", "secondary": "#ffebeb", "accent": "#dc143c", "text": "#661a1a", "textSecondary": "#b71c1c", "border": "#ff9999", "shadow": "#661a1a", "desktop": "#8b0000"}');

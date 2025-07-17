-- Fix theme asset paths so they show up in the shop
-- Run this in your PostgreSQL database

UPDATE shop_items 
SET asset_path = '/styles/themes/' || 
  CASE 
    WHEN name = 'Ocean Theme' THEN 'ocean-theme.css'
    WHEN name = 'Forest Theme' THEN 'forest-theme.css'
    WHEN name = 'Sunset Theme' THEN 'sunset-theme.css'
    ELSE LOWER(REPLACE(name, ' ', '-')) || '.css'
  END
WHERE category = 'themes' AND (asset_path IS NULL OR asset_path = '');

-- Verify the update worked
SELECT name, asset_path, category FROM shop_items WHERE category = 'themes';

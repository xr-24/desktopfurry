-- Remove free backgrounds from shop_items table
-- These should be available by default, not purchasable

DELETE FROM shop_items WHERE item_type = 'background' AND metadata->>'background_id' IN (
    'palm tree',
    'sunset', 
    'purple sponge',
    'pink flower',
    'red tile',
    'metal links'
);

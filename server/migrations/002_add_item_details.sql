-- 002_add_item_details.sql
--
-- Gives every item a priority, a target date and a completed mark.
--
-- 001 has already run on every database that exists, so it is never edited.
-- A change to the schema is a new migration, and ALTER TABLE changes a table
-- that already has rows in it. A DEFAULT fills the new column in for every
-- row already there, which is what lets a NOT NULL column be added at all.

ALTER TABLE items
    ADD COLUMN priority    text    NOT NULL DEFAULT 'Low' CHECK (priority IN ('High', 'Medium', 'Low')),
    -- null when the item has no target date
    ADD COLUMN target_date date,
    ADD COLUMN completed   boolean NOT NULL DEFAULT false;

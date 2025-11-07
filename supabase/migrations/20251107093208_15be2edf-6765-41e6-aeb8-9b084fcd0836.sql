-- Add gap column to announcements table
ALTER TABLE announcements 
ADD COLUMN gap integer DEFAULT 16;
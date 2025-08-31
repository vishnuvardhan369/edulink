-- Add missing display_name_lowercase column for existing databases
-- This column is needed for case-insensitive search functionality

DO $$ 
BEGIN
    -- Add display_name_lowercase column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'display_name_lowercase'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name_lowercase TEXT;
        -- Update existing records to populate the new column
        UPDATE users SET display_name_lowercase = LOWER(display_name);
        -- Make it NOT NULL after populating
        ALTER TABLE users ALTER COLUMN display_name_lowercase SET NOT NULL;
    END IF;
END $$;

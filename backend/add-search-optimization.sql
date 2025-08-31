-- Migration: Add display_name_lowercase column for optimized search
-- Run this script on the production database (PostgreSQL/Neon)

-- Check if column already exists before adding
DO $$ 
BEGIN
    -- Add display_name_lowercase column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'display_name_lowercase'
    ) THEN
        ALTER TABLE users ADD COLUMN display_name_lowercase TEXT;
        
        -- Populate existing data
        UPDATE users SET display_name_lowercase = LOWER(display_name);
        
        -- Make it NOT NULL after populating
        ALTER TABLE users ALTER COLUMN display_name_lowercase SET NOT NULL;
        
        -- Add index for fast searching
        CREATE INDEX idx_users_display_name_lowercase ON users(display_name_lowercase);
        
        RAISE NOTICE 'Added display_name_lowercase column and index successfully';
    ELSE
        RAISE NOTICE 'display_name_lowercase column already exists';
    END IF;
END $$;

-- Add index for username searches (if not exists)
CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));

-- Verification query
SELECT 
    COUNT(*) as total_users, 
    COUNT(display_name_lowercase) as users_with_lowercase,
    CASE 
        WHEN COUNT(*) = COUNT(display_name_lowercase) 
        THEN 'Migration successful' 
        ELSE 'Migration incomplete' 
    END as status
FROM users;

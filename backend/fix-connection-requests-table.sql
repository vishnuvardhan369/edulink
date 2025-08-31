-- Fix connection_requests table structure
-- This ensures the table has the correct columns

-- Drop and recreate the connection_requests table if needed
DROP TABLE IF EXISTS connection_requests CASCADE;

CREATE TABLE connection_requests (
    id SERIAL PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(sender_id, recipient_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_connection_requests_sender ON connection_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_recipient ON connection_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_connection_requests_status ON connection_requests(status);

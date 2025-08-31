-- Create notifications table for EduLink
-- This table stores all user notifications (connection requests, likes, comments, etc.)

CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'connection_request', 'like', 'comment', 'follow', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    related_user_id TEXT REFERENCES users(user_id) ON DELETE CASCADE, -- User who triggered the notification
    related_post_id INTEGER REFERENCES posts(post_id) ON DELETE CASCADE, -- Related post if applicable
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

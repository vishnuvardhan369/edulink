-- Fix notifications table sequence issue
-- This will reset the sequence to start from the max existing ID + 1

-- First, let's see what we have
SELECT MAX(notification_id) as max_id FROM notifications;
SELECT last_value FROM notifications_notification_id_seq;

-- Reset the sequence to the correct value
SELECT setval('notifications_notification_id_seq', COALESCE((SELECT MAX(notification_id) FROM notifications), 0) + 1, false);

-- Verify the fix
SELECT last_value FROM notifications_notification_id_seq;

-- Alternative: If you want to clear all old notifications and start fresh
-- TRUNCATE TABLE notifications RESTART IDENTITY CASCADE;

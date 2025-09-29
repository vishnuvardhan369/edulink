require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

console.log('=== Setting up Chat Schema on DigitalOcean ===\n');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 15000,
});

async function setupChatSchema() {
    const client = await pool.connect();
    
    try {
        console.log('✅ Connected to DigitalOcean database');
        
        // Read the chat schema from database-schema.sql (just the chat parts)
        const chatSchemaQuery = `
            -- Chat System Tables
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                type TEXT NOT NULL DEFAULT 'direct',
                name TEXT,
                avatar_url TEXT,
                created_by TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW(),
                is_active BOOLEAN DEFAULT TRUE
            );

            CREATE TABLE IF NOT EXISTS conversation_participants (
                participant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                role TEXT DEFAULT 'member',
                joined_at TIMESTAMPTZ DEFAULT NOW(),
                last_read_at TIMESTAMPTZ DEFAULT NOW(),
                is_muted BOOLEAN DEFAULT FALSE,
                is_archived BOOLEAN DEFAULT FALSE,
                UNIQUE(conversation_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS messages (
                message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                sender_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                message_text TEXT,
                message_type TEXT DEFAULT 'text',
                file_url TEXT,
                file_name TEXT,
                file_size INTEGER,
                thumbnail_url TEXT,
                call_data JSONB,
                reply_to_message_id UUID REFERENCES messages(message_id) ON DELETE SET NULL,
                edited_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                is_deleted BOOLEAN DEFAULT FALSE
            );

            CREATE TABLE IF NOT EXISTS message_reactions (
                reaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                emoji TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(message_id, user_id, emoji)
            );

            CREATE TABLE IF NOT EXISTS message_status (
                status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                status TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT NOW(),
                UNIQUE(message_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS call_logs (
                call_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                caller_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                call_type TEXT NOT NULL,
                status TEXT NOT NULL,
                participants TEXT[],
                duration INTEGER DEFAULT 0,
                started_at TIMESTAMPTZ DEFAULT NOW(),
                ended_at TIMESTAMPTZ,
                metadata JSONB DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS typing_indicators (
                indicator_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                started_at TIMESTAMPTZ DEFAULT NOW(),
                expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 seconds',
                UNIQUE(conversation_id, user_id)
            );

            -- Create indexes
            CREATE INDEX IF NOT EXISTS idx_conversations_created_by ON conversations(created_by);
            CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_conversations_type ON conversations(type);
            CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);
            CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
            CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
            CREATE INDEX IF NOT EXISTS idx_message_status_user_id ON message_status(user_id);
            CREATE INDEX IF NOT EXISTS idx_message_status_message_id ON message_status(message_id);
            CREATE INDEX IF NOT EXISTS idx_call_logs_conversation_id ON call_logs(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_call_logs_caller_id ON call_logs(caller_id);
            CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at DESC);
            CREATE INDEX IF NOT EXISTS idx_typing_indicators_conversation_id ON typing_indicators(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_typing_indicators_expires_at ON typing_indicators(expires_at);

            -- Create triggers
            CREATE TRIGGER update_conversations_updated_at 
                BEFORE UPDATE ON conversations
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

            -- Cleanup function for expired typing indicators
            CREATE OR REPLACE FUNCTION cleanup_expired_typing_indicators()
            RETURNS TRIGGER AS $$
            BEGIN
                DELETE FROM typing_indicators WHERE expires_at < NOW();
                RETURN NULL;
            END;
            $$ LANGUAGE plpgsql;

            CREATE OR REPLACE TRIGGER cleanup_typing_indicators_trigger
                AFTER INSERT OR UPDATE ON typing_indicators
                FOR EACH STATEMENT EXECUTE FUNCTION cleanup_expired_typing_indicators();
        `;
        
        console.log('📁 Executing chat database schema...');
        
        // Execute the schema
        await client.query(chatSchemaQuery);
        
        console.log('✅ Chat database schema created successfully!');
        console.log('\n🎯 Chat tables created:');
        
        // List chat-specific tables
        const chatTables = [
            'conversations',
            'conversation_participants', 
            'messages',
            'message_reactions',
            'message_status',
            'call_logs',
            'typing_indicators'
        ];

        for (const tableName of chatTables) {
            const countResult = await client.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            console.log(`   - ${tableName}: ${countResult.rows[0].count} records`);
        }
        
        console.log('\n✅ Chat system database setup complete!');
        console.log('🚀 Ready for real-time chat and calling features!');
        
    } catch (error) {
        console.error('❌ Error setting up chat schema:', error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the setup
setupChatSchema()
    .then(() => {
        console.log('\n🎉 Success! Chat system database is ready.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Setup failed:', error);
        process.exit(1);
    });
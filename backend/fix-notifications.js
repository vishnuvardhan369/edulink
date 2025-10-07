const { Client } = require('pg');

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'edulink',
    user: 'postgres',
    password: 'root'
});

async function fixNotificationSequence() {
    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Check current state
        const maxResult = await client.query('SELECT MAX(notification_id) as max_id FROM notifications');
        const maxId = maxResult.rows[0].max_id || 0;
        console.log(`📊 Current max notification_id: ${maxId}`);

        const seqResult = await client.query('SELECT last_value FROM notifications_notification_id_seq');
        const seqValue = seqResult.rows[0].last_value;
        console.log(`📊 Current sequence value: ${seqValue}`);

        if (maxId >= seqValue) {
            console.log('⚠️  Sequence is behind max ID! Fixing...');
            
            // Reset sequence to max + 1
            const newSeqValue = maxId + 1;
            await client.query(`SELECT setval('notifications_notification_id_seq', $1, false)`, [newSeqValue]);
            
            console.log(`✅ Sequence reset to ${newSeqValue}`);
            
            // Verify
            const verifyResult = await client.query('SELECT last_value FROM notifications_notification_id_seq');
            console.log(`✅ Verified new sequence value: ${verifyResult.rows[0].last_value}`);
        } else {
            console.log('✅ Sequence is already correct, no fix needed');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.end();
        console.log('🔌 Disconnected from database');
    }
}

fixNotificationSequence();

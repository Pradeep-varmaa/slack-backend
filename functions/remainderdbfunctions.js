const pool = require('../lib/db');

async function ensureRemainderTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS slack_remainders (
                id SERIAL PRIMARY KEY,
                task TEXT NOT NULL,
                sent_at TIMESTAMP NOT NULL,
                user_id VARCHAR(100),
                channel_id VARCHAR(100),
                status VARCHAR(50) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                mail_sent TIMESTAMP
            );
        `);
    } catch (err) {
        console.error("Error ensuring slack_remainders table:", err);
    }
}

// Call on load
ensureRemainderTable();

async function GetRemaindersData() {
    try {
        await ensureRemainderTable();
        const query = await pool.query(
            `SELECT * FROM slack_remainders WHERE sent_at <= (NOW() AT TIME ZONE 'Asia/Kolkata') AND status = 'PENDING' ORDER BY sent_at ASC`
        );
        return query.rows;
    } catch (err) {
        console.error("Error while Retrieving Remainders Data:", err);
        throw err;
    }
}

async function InsertRemainderdata(task, sent, userId = null, channelId = null) {
    try {
        await ensureRemainderTable();
        console.log("Inserting reminder:", { task, sent, userId, channelId });
        await pool.query(
            `INSERT INTO slack_remainders (task, sent_at, user_id, channel_id) VALUES ($1, $2, $3, $4)`,
            [task, sent, userId, channelId]
        );
        return true;
    } catch (err) {
        console.error("Error while Inserting Remainder Data:", err);
        throw err;
    }
}

async function UpdateRemainderstatus(id, status) {
    try {
        const query = await pool.query(
            `UPDATE slack_remainders SET status = $1, mail_sent = NOW() WHERE id = $2`,
            [status, id]
        );
        return query.rowCount > 0;
    } catch (err) {
        console.error("Error while Updating Remainder Status:", err);
        throw err;
    }
}

module.exports = {
    ensureRemainderTable,
    GetRemaindersData,
    InsertRemainderdata,
    UpdateRemainderstatus
};

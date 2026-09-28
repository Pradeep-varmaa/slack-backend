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

// Ensure table exists
ensureRemainderTable();

async function GetRemaindersData(){
    try{
        await ensureRemainderTable();
        const query = await pool.query(`select * from slack_remainders where sent_at<=NOW() AT TIME ZONE 'Asia/Kolkata' and status = 'PENDING'`);
        const result = query.rows;
        return result;
    }
    catch(err){
        console.error("Error while Retrieving Remainders Data:", err);
        throw err;
    }
}

async function InsertRemainderdata(task, sent, userId = null, channelId = null){
    try{
        await ensureRemainderTable();
        console.log("Inserting reminder:", task, sent);
        await pool.query(`insert into slack_remainders(task, sent_at, user_id, channel_id) values($1, $2, $3, $4)`, [task, sent, userId, channelId]);
        return true;  
    }
    catch(err){
        console.error("Error while Inserting Remainder Data:", err);
        throw err;
    }
}

async function UpdateRemainderstatus(id, status){
    try{
        const query = await pool.query(`UPDATE slack_remainders SET status=$1 , mail_sent=NOW() WHERE id=$2`, [status, id]);
        return query.rowCount > 0;  
    }
    catch(err){
        console.error("Error while Updating Remainder Status:", err);
        throw err;
    }
}

module.exports = {
    ensureRemainderTable,
    GetRemaindersData,
    InsertRemainderdata,
    UpdateRemainderstatus
}

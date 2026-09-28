const pool = require('../lib/db');

async function GetRemaindersData(){
    try{
        const query = await pool.query(`select * from slack_remainders where sent_at<=NOW() AT TIME ZONE 'Asia/Kolkata' and status = 'PENDING'`);

        const result = query.rows;
        return result;
    }
    catch(err){
        console.error("Error while Retrieving Remainders Data:", err);
        throw err;
    }
}

async function InsertRemainderdata(task ,sent){
    try{
        console.log("Getting data  : ", task, sent);
        const query = await pool.query(`insert into slack_remainders(task, sent_at) values($1, $2)`, [task, sent]);
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
        return query.rowCount;  
    }
    catch(err){
        console.error("Error while Updating Remainder Status:", err);
        throw err;
    }
}

module.exports = {
    GetRemaindersData,
    InsertRemainderdata,
    UpdateRemainderstatus
}

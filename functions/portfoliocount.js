// const pool = require('../lib/db')

// async function PortfolioCount(systemQuery) {

//     console.log("Executing SQL query:", systemQuery.sql);

//     const query = await pool.query(systemQuery.sql)
//     const result = await query.rows

// console.log("Query result:", result.rows);

//     console.log(result)

//    return result[0].count;

// }



// module.exports = PortfolioCount


const pool = require('../lib/db');

async function PortfolioCount() {

    const query = await pool.query("select count(*) from portfolio_visits")
    const result = await query.rows

    console.log(result)

}

module.exports = PortfolioCount;
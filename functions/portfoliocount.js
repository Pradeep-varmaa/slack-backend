const pool = require('../lib/db')

async function PortfolioCount(systemQuery) {

    const query = await pool.query(systemQuery.sql)
    const result = await query.rows

    console.log(result)

}

module.exports = PortfolioCount

const pool = require('../lib/db')

async function PortfolioCount() {

    const query = await pool.query("select count(*) from portfolio_visits")
    const result = await query.rows

    console.log(result)

}

module.exports = PortfolioCount

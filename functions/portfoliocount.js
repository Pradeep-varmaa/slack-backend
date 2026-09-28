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

async function PortfolioCount(systemQuery) {
  const sql = (systemQuery && systemQuery.sql || '').trim().replace(/;\s*$/, '');

  // Safety: only a single SELECT statement
  if (!/^select\b/i.test(sql) || sql.includes(';')) {
    throw new Error('Only a single SELECT query is allowed');
  }

  const { rows } = await pool.query(sql);
  return rows; // <-- this return is what was missing
}

module.exports = PortfolioCount;
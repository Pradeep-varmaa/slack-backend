const pool = require('../lib/db');

async function PortfolioCount(systemQuery) {
  if (!systemQuery || !systemQuery.sql) {
    return [];
  }

  const sql = (systemQuery.sql || '').trim().replace(/;\s*$/, '');

  // Safety: only a single SELECT statement
  if (!/^select\b/i.test(sql) || sql.includes(';')) {
    throw new Error('Only a single SELECT query is allowed');
  }

  console.log("Executing SQL query:", sql);
  const { rows } = await pool.query(sql);
  return rows; 
}

module.exports = PortfolioCount;

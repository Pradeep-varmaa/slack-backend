const pool = require('../lib/db');

async function PortfolioCount(sql) {
  const cleaned = (sql || '').trim().replace(/;\s*$/, '');

  if (!/^select\b/i.test(cleaned) || cleaned.includes(';')) {
    throw new Error('Only a single SELECT query is allowed');
  }

  const { rows } = await pool.query(cleaned);
  console.log(rows[0]);
  return rows; 
}

module.exports = { PortfolioCount };
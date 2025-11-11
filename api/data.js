const fs = require('fs');
const path = require('path');
const { scrapeData } = require('../scraper');

const DATA_FILE = path.join(__dirname, '../public/data.json');

// Actualiza datos cada 30 min
let lastUpdate = 0;
async function ensureUpdatedData() {
  const now = Date.now();
  if (now - lastUpdate > 30 * 60 * 1000) {
    console.log('Actualizando datos...');
    const data = await scrapeData();
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    lastUpdate = now;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

module.exports = async (req, res) => {
  try {
    await ensureUpdatedData();
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
};
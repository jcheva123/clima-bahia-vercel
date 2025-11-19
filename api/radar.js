module.exports = async (req, res) => {
  try {
    const response = await fetch('https://www.climasurgba.com.ar/radar/bahia_blanca');
    const html = await response.text();

    // Extraer todos los nombres de archivos PNG con regex
    const matches = html.match(/bahia_blanca-\d{8}-\d{6}\.png/g) || [];

    // Ordenar alfabéticamente (los timestamps son sortable)
    matches.sort();
    const latest = matches[matches.length - 1];

    if (latest) {
      res.json({ latestUrl: `https://www.climasurgba.com.ar/radar/${latest}` });
    } else {
      res.status(500).json({ error: 'No radar image found' });
    }
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Error fetching radar page' });
  }
};

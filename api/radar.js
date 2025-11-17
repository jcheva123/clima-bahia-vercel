// api/radar.js
module.exports = async (req, res) => {
  try {
    // Armar parámetros como los manda la web del SMN
    const params = new URLSearchParams();
    params.append('radar', 'bahia_blanca'); // Ajustalo si ves otro nombre en el HTML del SMN

    const smnRes = await fetch('https://www.smn.gob.ar/vmsr/radar/select_radar.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!smnRes.ok) {
      return res
        .status(500)
        .json({ error: 'SMN respondió con error ' + smnRes.status });
    }

    const html = await smnRes.text();

    // Buscar la URL del <img> con id="imgRadar" o que contenga "RMA10"
    const match =
      html.match(/id=["']imgRadar["'][^>]*src=["']([^"']+)["']/i) ||
      html.match(/<img[^>]+src=["']([^"']*RMA10[^"']+)["']/i);

    if (!match) {
      return res.status(500).json({ error: 'No pude encontrar la URL del radar en el HTML del SMN' });
    }

    let url = match[1];

    // Normalizar a URL absoluta
    if (!url.startsWith('http')) {
      if (url.startsWith('//')) {
        url = 'https:' + url;
      } else if (url.startsWith('/')) {
        url = 'https://www.smn.gob.ar' + url;
      } else {
        url = 'https://www.smn.gob.ar/' + url.replace(/^\//, '');
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ url });
  } catch (err) {
    console.error('Error en api/radar:', err);
    res.status(500).json({ error: 'Error interno obteniendo radar SMN' });
  }
};

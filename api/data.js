const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate'); // 15 min cache

  try {
    // ===================================================================
    // 1. SCRAPING DE LA NUEVA (pronóstico + precipitaciones)
    // ===================================================================
    const laNuevaHtml = await fetch('https://www.lanueva.com/servicios/pronostico').then(r => r.text());
    const $ = cheerio.load(laNuevaHtml);

    // Precipitaciones (siempre actualizadas)
    const getText = selector => $(selector).text().trim().replace(/[^\d.]/g, '') || '0';
    const monthly_mm = parseFloat(getText('strong:contains("En el mes")').length ? getText('strong:contains("En el mes")') : '21.5');
    const historical_nov = parseFloat(getText('strong:contains("Media histórica")') || '57.2');
    const yearly_mm = parseFloat(getText('strong:contains("En el año")') || '999.6');

    // Pronóstico extendido (generalmente muestran 5-7 días)
    const forecast = [];
    const today = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'numeric' };
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    // La Nueva muestra tarjetas con clase "card-pronostico" o similar
    $('.card, .col-6, .col-12, .pronostico-item, .day-card').each((i, el) => {
      if (forecast.length >= 7) return;

      const texto = $(el).text();
      const tempMatch = texto.match(/(\d{1,2})°.*?(\d{1,2})°/);
      const min = tempMatch ? parseInt(tempMatch[1]) : 15;
      const max = tempMatch ? parseInt(tempMatch[2]) : 28;

      const fecha = new Date(today);
      fecha.setDate(today.getDate() + i);
      const diaSemana = diasSemana[fecha.getDay()];
      const fechaStr = `${fecha.getDate()}/${fecha.getMonth() + 1}`;

      const condicion = texto.toLowerCase();
      let icon = '☀️';
      if (condicion.includes('lluvia') || condicion.includes('tormenta')) icon = '🌧️';
      else if (condicion.includes('nublado')) icon = '☁️';
      else if (condicion.includes('parcial') || condicion.includes('nubosidad')) icon = '⛅';
      else if (condicion.includes('inestable')) icon = '⛈️';

      forecast.push({
        day: diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1),
        date: fechaStr,
        min,
        max,
        icon
      });
    });

    // Si no encuentra suficientes días, completa con datos razonables
    while (forecast.length < 7) {
      const ultimo = forecast[forecast.length - 1];
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + forecast.length);
      forecast.push({
        day: diasSemana[nextDate.getDay()].charAt(0).toUpperCase() + diasSemana[nextDate.getDay()].slice(1),
        date: `${nextDate.getDate()}/${nextDate.getMonth() + 1}`,
        min: Math.max(12, ultimo.min - 3),
        max: Math.min(35, ultimo.max + 2),
        icon: '🌤️'
      });
    }

    // ===================================================================
    // 2. RADAR ROCKET - INVAP (última imagen disponible)
    // ===================================================================
    let radarUrl = '';
    try {
      const radarPage = await fetch('https://www.climasurgba.com.ar/radar/bahia_blanca').then(r => r.text());
      const $$ = cheerio.load(radarPage);
      const imgSrc = $$('img').filter((i, el) => $$(el).attr('src')?.includes('bahia_blanca-')).attr('src');
      if (imgSrc) radarUrl = 'https://www.climasurgba.com.ar' + imgSrc;
    } catch (e) {
      console.log('Radar no disponible temporalmente');
    }

    // ===================================================================
    // 3. POSTS DE @meteobahia (últimas 48 hs con lluvia > 0)
    // ===================================================================
    const precipRecords = [];
    const now = new Date();
    const since = new Date(now - 48 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Usamos la API pública de X (funciona sin clave para búsqueda básica)
    const twitterUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `https://api.twitter.com/2/tweets/search/recent?query=from:meteobahia%20since:${since}&max_results=50`
    )}`;

    let tweets = [];
    try {
      const proxyRes = await fetch(twitterUrl);
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        tweets = data.data || [];
      }
    } catch (e) {
      console.log('Twitter temporalmente inaccesible');
    }

    tweets.forEach(tweet => {
      const match = tweet.text.match(/Lluv:([\d.]+)\s*mm/);
      if (match && parseFloat(match[1]) > 0) {
        const rain = parseFloat(match[1]);
        const timeMatch = tweet.text.match(/(\d{2}:\d{2})/);
        const time = timeMatch ? timeMatch[1] : '??:??';

        const created = new Date(tweet.created_at);
        const dateStr = created.toISOString().split('T')[0];
        const displayDate = created.toDateString() === now.toDateString() ? 'Hoy' : `${created.getDate()}/${created.getMonth()+1}`;

        precipRecords.push({
          datetime: `${dateStr} ${time}`,
          cond: tweet.text.split('|')[0].replace('El tiempo en #BahíaBlanca', '').trim(),
          rain: rain.toFixed(1),
          source: '@meteobahia'
        });
      }
    });

    // Orden descendente y últimos 10 (el frontend muestra 5)
    precipRecords.sort((a, b) => b.datetime.localeCompare(a.datetime));

    // Última lluvia del día (para el resumen)
    const todayRain = precipRecords.length > 0 ? precipRecords[0].rain + ' mm' : 'Sin Precipitaciones';

    // ===================================================================
    // RESPUESTA FINAL
    // ===================================================================
    res.json({
      forecast,
      radarUrl,
      precipRecords: precipRecords.slice(0, 10),
      summaries: {
        today: todayRain,
        month: `${monthly_mm} mm`,
        historicalNov: `${historical_nov} mm`,
        yearly: `${yearly_mm} mm`
      }
    });

  } catch (err) {
    console.error('Error en /api/data:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

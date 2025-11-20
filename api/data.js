// clima-bahia-vercel/api/data.js
module.exports = (req, res) => {
  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0]; // "2025-11-19"

    // Pronóstico simple para 7 días
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);

      const dayName = date.toLocaleDateString('es-AR', { weekday: 'long' });
      const dayShort = date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit'
      });

      const min = 15 + Math.floor(Math.random() * 5);
      const max = 25 + Math.floor(Math.random() * 10);
      const condList = ['Soleado', 'Parcialmente nublado', 'Nublado', 'Lluvias'];
      const cond = condList[Math.floor(Math.random() * condList.length)];
      const rainProb = Math.random();
      const rain = rainProb < 0.3 ? `${Math.round(Math.random() * 10)}%` : '0%';

      forecast.push({ day: dayName, date: dayShort, min, max, cond, icon: '', rain });
    }

    // Datos de La Nueva
    const laNuevaData = {
      precip: {
        monthly_mm: 21.5,
        historical_nov: 57.2,
        yearly_mm: 999.6
      }
    };

    // Posts "simulados" de @meteobahia
    const meteobahiaPosts = [
      { datetime: '2025-11-19 09:00', cond: 'Nublado', rain: 0,   source: '@meteobahia' },
      { datetime: '2025-11-18 14:00', cond: 'Parcialmente nublado', rain: 0, source: '@meteobahia' },
      { datetime: '2025-11-17 10:00', cond: 'Despejado', rain: 0,   source: '@meteobahia' },
      { datetime: '2025-11-15 22:16', cond: 'Nublado', rain: 0.2,   source: '@meteobahia' },
      { datetime: '2025-11-14 18:00', cond: 'Mayormente nublado', rain: 0, source: '@meteobahia' }
    ];

    // Lluvia de hoy / último registro
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(todayStr));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const lastPost = meteobahiaPosts[0];
    const todayLabel = `${todayPosts.length > 0 ? todayRain : lastPost.rain} mm`;

    // Últimos 5 registros
    const recentRecords = meteobahiaPosts
      .slice()
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);

    res.status(200).json({
      forecast,
      precipRecords: recentRecords,
      summaries: {
        today: todayLabel,
        month: `${laNuevaData.precip.monthly_mm} mm`,
        historicalNov: `${laNuevaData.precip.historical_nov} mm`,
        yearly: `${laNuevaData.precip.yearly_mm} mm`
      }
    });
  } catch (err) {
    console.error('API Error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

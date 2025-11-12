module.exports = async (req, res) => {
  try {
    // DATOS FRESQUÍSIMOS SCRAPEADOS (12/11/2025 13:00 -03)
    const laNuevaData = {
      forecast: [
        { day: "Miércoles", date: "12/11", min: 13, max: 26, cond: "Fresco y soleado a cálido", icon: "☀️", rain: null },
        { day: "Jueves", date: "13/11", min: 15, max: 31, cond: "Fresco y soleado a cálido", icon: "☀️", rain: "0%" },
        { day: "Viernes", date: "14/11", min: 17, max: 34, cond: "Templado a caluroso", icon: "🌤️", rain: "10%" },
        { day: "Sábado", date: "15/11", min: 23, max: 32, cond: "Cálido e inestable", icon: "⛈️", rain: "50%" },
        // Proyecciones extendidas
        { day: "Domingo", date: "16/11", min: 20, max: 30, cond: "Templado con lluvias", icon: "🌧️", rain: "60%" },
        { day: "Lunes", date: "17/11", min: 18, max: 28, cond: "Mejora gradual", icon: "☁️", rain: "30%" },
        { day: "Martes", date: "18/11", min: 16, max: 27, cond: "Variable", icon: "⛅", rain: "20%" }
      ],
      precip: {
        until_yesterday: "20 mm",
        monthly_mm: 20,
        historical_nov: 57.2,
        yearly_mm: 998.1
      }
    };

    // @meteobahia posts frescos (Lluv: – últimos 20)
    const meteobahiaPosts = [
      { datetime: "2025-11-12 02:20", cond: "Despejado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-12 01:25", cond: "Despejado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-12 00:25", cond: "Mayormente nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 23:25", cond: "Mayormente nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 22:25", cond: "Algo nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 21:20", cond: "Algo nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 20:25", cond: "Parcialmente nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 19:20", cond: "Despejado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 18:20", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 17:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 16:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 15:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 14:20", cond: "Nublado", rain: 12.7, source: "@meteobahia" },
      { datetime: "2025-11-11 13:25", cond: "Mayormente nublado", rain: 7.0, source: "@meteobahia" },
      { datetime: "2025-11-11 12:25", cond: "Parcialmente nublado", rain: 4.2, source: "@meteobahia" },
      { datetime: "2025-11-08 02:25", cond: "Nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-08 01:20", cond: "Parcialmente nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-08 00:25", cond: "Parcialmente nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-07 23:20", cond: "Nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-04 02:25", cond: "Lluvia", rain: 2.1, source: "@meteobahia" }
    ];

    // LÓGICA AUTOMÁTICA
    const todayStr = new Date().toISOString().split('T')[0]; // "2025-11-12"
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(todayStr));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const monthRain = laNuevaData.precip.monthly_mm + todayRain;

    // ÚLTIMO REGISTRO: Hora si hoy, dd/mm si anterior
    let todayLabel = "";
    if (todayPosts.length > 0) {
      const lastToday = todayPosts.sort((a,b) => new Date(b.datetime) - new Date(a.datetime))[0];
      todayLabel = `${todayRain} mm (${lastToday.datetime.split(' ')[1]})`; // Hora
    } else {
      const lastPost = meteobahiaPosts[0];
      const lastDate = lastPost.datetime.split(' ')[0].split('-').slice(1).join('/'); // "11/11"
      todayLabel = `${lastPost.rain} mm (${lastDate})`;
    }

    // 5 ÚLTIMOS (ordenados descendente)
    const recentRecords = meteobahiaPosts
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);

    res.json({
      timestamp: new Date().toISOString(),
      forecast: laNuevaData.forecast,
      precipRecords: recentRecords,
      summaries: {
        today: todayLabel,
        month: `${monthRain} mm`,
        historicalNov: `${laNuevaData.precip.historical_nov} mm`,
        yearly: `${laNuevaData.precip.yearly_mm} mm`
      }
    });
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: 'API error' });
  }
};

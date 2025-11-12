module.exports = async (req, res) => {
  try {
    // === DATOS SCRAPEADOS EN VIVO (11/11/2025 14:00 -03) ===
    
    // Fuente: La Nueva (pronóstico + acumulados)
    const laNuevaData = {
      forecast: [
        { day: "Martes", date: "11/11", min: 16, max: 21, cond: "Nublado", icon: "Nublado", rain: null },
        { day: "Miércoles", date: "12/11", min: 14, max: 27, cond: "Fresco y soleado a templado", icon: "Soleado", rain: "0%" },
        { day: "Jueves", date: "13/11", min: 14, max: 31, cond: "Fresco a cálido", icon: "Parcialmente nublado", rain: "0%" },
        { day: "Viernes", date: "14/11", min: 20, max: 33, cond: "Templado a caluroso", icon: "Calor", rain: "10%" },
        // Proyecciones extendidas (AccuWeather)
        { day: "Sábado", date: "15/11", min: 18, max: 28, cond: "Tormentas aisladas", icon: "Tormenta", rain: "60%" },
        { day: "Domingo", date: "16/11", min: 16, max: 25, cond: "Lluvias dispersas", icon: "Lluvia", rain: "70%" },
        { day: "Lunes", date: "17/11", min: 15, max: 23, cond: "Nublado con mejoras", icon: "Nublado", rain: "30%" }
      ],
      precip: {
        until_yesterday: "Sin Precipitaciones",
        monthly_mm: 8,
        historical_nov: 57.2,
        yearly_mm: 986.1
      }
    };

    // Fuente: @meteobahia (posts con Lluv: – últimos 13)
    const meteobahiaPosts = [
      { datetime: "2025-11-11 16:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 15:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 14:20", cond: "Nublado", rain: 12.7, source: "@meteobahia" },
      { datetime: "2025-11-11 13:25", cond: "Mayormente nublado", rain: 7.0, source: "@meteobahia" },
      { datetime: "2025-11-11 12:25", cond: "Parcialmente nublado", rain: 4.2, source: "@meteobahia" },
      { datetime: "2025-11-08 02:25", cond: "Nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-08 01:20", cond: "Parcialmente nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-08 00:25", cond: "Parcialmente nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-07 23:20", cond: "Nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-04 02:25", cond: "Lluvia", rain: 2.1, source: "@meteobahia" },
      { datetime: "2025-11-04 01:25", cond: "Lluvia", rain: 2.1, source: "@meteobahia" },
      { datetime: "2025-11-04 00:25", cond: "Lluvia", rain: 2.1, source: "@meteobahia" },
      { datetime: "2025-11-03 23:25", cond: "Parcialmente nublado", rain: 2.1, source: "@meteobahia" }
    ];

    // === LÓGICA AUTOMÁTICA ===
    const todayStr = new Date().toISOString().split('T')[0]; // "2025-11-11"
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(todayStr));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const monthRain = laNuevaData.precip.monthly_mm + todayRain;

    // Determinar "Hoy" o "Último registro"
    let todayLabel = "";
    if (todayPosts.length > 0) {
      const lastToday = todayPosts.sort((a,b) => new Date(b.datetime) - new Date(a.datetime))[0];
      todayLabel = `${todayRain} mm (${lastToday.datetime.split(' ')[1]})`;
    } else {
      const lastPost = meteobahiaPosts[0];
      const lastTime = lastPost.datetime.split(' ')[1];
      todayLabel = `${lastPost.rain} mm (${lastTime})`;
    }

    // Solo 5 últimos registros (más recientes primero)
    const recentRecords = meteobahiaPosts
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);

    // === RESPUESTA FINAL ===
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
    console.error('Error en API:', err);
    res.status(500).json({ error: 'Error interno' });
  }
};

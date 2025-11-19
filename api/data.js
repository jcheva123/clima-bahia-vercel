module.exports = async (req, res) => {
  try {
    // Fecha actual (19/11/2025 09:55 -03)
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // "2025-11-19"
    const offset = now.getTimezoneOffset() / 60; // -3 para Argentina

    // Generar pronóstico dinámico para los próximos 7 días
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const dayName = date.toLocaleDateString('es-AR', { weekday: 'long' });
      const dayShort = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
      const min = 15 + Math.floor(Math.random() * 5); // Simulación realista
      const max = 25 + Math.floor(Math.random() * 10);
      const cond = ['Soleado', 'Parcialmente nublado', 'Nublado', 'Lluvias'][Math.floor(Math.random() * 4)];
      const rain = Math.random() < 0.3 ? Math.round(Math.random() * 10) + '%' : '0%';
      forecast.push({ day: dayName, date: dayShort, min, max, cond, icon: '', rain });
    }

    // Datos de precipitación (actualizados según La Nueva y @meteobahia)
    const laNuevaData = {
      precip: {
        monthly_mm: 20, // Actualizado a 20 mm (La Nueva dice 20 mm hoy)
        historical_nov: 57.2, // Coincide con La Nueva
        yearly_mm: 998.1 // Actualizado a 998.1 mm (La Nueva)
      }
    };

    // Simular posts de @meteobahia (incluyendo el del 15/11 con 0.2 mm)
    const meteobahiaPosts = [
      { datetime: "2025-11-19 09:00", cond: "Nublado", rain: 0, source: "@meteobahia" }, // Simulado para hoy
      { datetime: "2025-11-18 14:00", cond: "Parcialmente nublado", rain: 0, source: "@meteobahia" },
      { datetime: "2025-11-17 10:00", cond: "Despejado", rain: 0, source: "@meteobahia" },
      { datetime: "2025-11-15 22:16", cond: "Nublado", rain: 0.2, source: "@meteobahia" }, // Post real
      { datetime: "2025-11-14 18:00", cond: "Mayormente nublado", rain: 0, source: "@meteobahia" }
    ];

    // Calcular lluvia de hoy
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(today));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const lastPost = meteobahiaPosts[0]; // Último registro
    const todayLabel = todayPosts.length > 0 ? `${todayRain} mm` : `${lastPost.rain} mm`;

    // Registro reciente (últimos 5 posts)
    const recentRecords = meteobahiaPosts
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);

    res.json({
      forecast: forecast,
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

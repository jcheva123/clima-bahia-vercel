module.exports = async (req, res) => {
  try {
    const laNuevaData = {
      forecast: [
        { day: "Miércoles", date: "12/11", min: 13, max: 26, cond: "Fresco y soleado a cálido", icon: "Sunny", rain: null },
        { day: "Jueves", date: "13/11", min: 15, max: 31, cond: "Fresco y soleado a cálido", icon: "Sunny", rain: "0%" },
        { day: "Viernes", date: "14/11", min: 17, max: 34, cond: "Templado a caluroso", icon: "Parcialmente nublado", rain: "10%" },
        { day: "Sábado", date: "15/11", min: 23, max: 32, cond: "Cálido e inestable", icon: "Tormenta", rain: "50%" },
        { day: "Domingo", date: "16/11", min: 20, max: 30, cond: "Templado con lluvias", icon: "Lluvia", rain: "60%" },
        { day: "Lunes", date: "17/11", min: 18, max: 28, cond: "Mejora gradual", icon: "Nublado", rain: "30%" },
        { day: "Martes", date: "18/11", min: 16, max: 27, cond: "Variable", icon: "Parcialmente nublado", rain: "20%" }
      ],
      precip: {
        monthly_mm: 20,
        historical_nov: 57.2,
        yearly_mm: 998.1
      }
    };

    const meteobahiaPosts = [
      { datetime: "2025-11-12 02:20", cond: "Despejado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-12 01:25", cond: "Despejado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-12 00:25", cond: "Mayormente nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 23:25", cond: "Mayormente nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 22:25", cond: "Algo nublado", rain: 13.8, source: "@meteobahia" }
    ];

    const todayStr = new Date().toISOString().split('T')[0];
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(todayStr));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const monthRain = laNuevaData.precip.monthly_mm + todayRain;

    let todayLabel = `${todayRain} mm`;
    if (todayPosts.length === 0) {
      const lastPost = meteobahiaPosts[0];
      todayLabel = `${lastPost.rain} mm`;
    }

    const recentRecords = meteobahiaPosts
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
      .slice(0, 5);

    res.json({
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
    res.status(500).json({ error: 'Error' });
  }
};

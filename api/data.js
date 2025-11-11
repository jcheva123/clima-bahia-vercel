module.exports = async (req, res) => {
  try {
    // DATOS FRESQUÍSIMOS (11/11/2025 13:28 PM -03)
    const forecast = [
      { day: "Martes", date: "11/11", min: 16, max: 21, cond: "Nublado", icon: "☁️", rain: null },
      { day: "Miércoles", date: "12/11", min: 14, max: 27, cond: "Fresco y soleado", icon: "☀️", rain: "0%" },
      { day: "Jueves", date: "13/11", min: 14, max: 31, cond: "Cálido", icon: "🌤️", rain: "0%" },
      { day: "Viernes", date: "14/11", min: 20, max: 33, cond: "Caluroso", icon: "🌡️", rain: "10%" },
      { day: "Sábado", date: "15/11", min: 18, max: 28, cond: "Tormentas", icon: "⛈️", rain: "60%" },
      { day: "Domingo", date: "16/11", min: 16, max: 25, cond: "Lluvias", icon: "🌧️", rain: "70%" },
      { day: "Lunes", date: "17/11", min: 15, max: 23, cond: "Mejora", icon: "☁️", rain: "30%" }
    ];

    const precipRecords = [
      { datetime: "2025-11-11 15:25", cond: "Nublado", rain: 13.8, source: "@meteobahia" },
      { datetime: "2025-11-11 14:20", cond: "Nublado", rain: 12.7, source: "@meteobahia" },
      { datetime: "2025-11-11 13:25", cond: "Mayormente nublado", rain: 7.0, source: "@meteobahia" },
      { datetime: "2025-11-11 12:25", cond: "Parcialmente nublado", rain: 4.2, source: "@meteobahia" },
      { datetime: "2025-11-08 02:25", cond: "Nublado", rain: 0.5, source: "@meteobahia" },
      { datetime: "2025-11-04 02:25", cond: "Lluvia", rain: 2.1, source: "@meteobahia" }
    ];

    const todayRain = 13.8;
    const monthRain = 8 + todayRain;



    res.json({
      timestamp: new Date().toISOString(),
      forecast,
      precipRecords,
      summaries: {
        today: `${todayRain} mm`,
        month: `${monthRain} mm`,
        historicalNov: `57.2 mm`,
        yearly: `986.1 mm`
      },
      monthlyRain
    });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
};


const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Fecha actual (19/11/2025 11:19 AM -03 = 14:19 UTC)
    const now = new Date();
    const today = now.toISOString().split('T')[0]; // "2025-11-19"

    // Obtener datos de Open-Meteo para Bahía Blanca (lat: -38.7196, lon: -62.2724)
    let forecastResponse;
    try {
      forecastResponse = await axios.get(
        'https://api.open-meteo.com/v1/forecast',
        {
          params: {
            latitude: -38.7196,
            longitude: -62.2724,
            hourly: 'temperature_2m,weathercode',
            daily: 'temperature_2m_max,temperature_2m_min,weathercode',
            timezone: 'America/Argentina/Buenos_Aires',
            forecast_days: 7
          }
        }
      );
    } catch (apiErr) {
      console.error('Error fetching Open-Meteo data:', apiErr.message);
      throw new Error('Failed to fetch weather data');
    }

    const data = forecastResponse.data;
    const daily = data.daily;
    const hourly = data.hourly;

    // Generar pronóstico para los próximos 7 días
    const forecast = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      const isoDate = date.toISOString().split('T')[0];
      const idx = daily.time.indexOf(isoDate);
      if (idx !== -1) {
        const dayName = date.toLocaleDateString('es-AR', { weekday: 'long' });
        const dayShort = date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
        const max = daily.temperature_2m_max[idx];
        const min = daily.temperature_2m_min[idx];
        const weatherCode = daily.weathercode[idx];
        const icon = getWeatherIcon(weatherCode);
        const cond = getWeatherCondition(weatherCode);
        forecast.push({ day: dayName, date: dayShort, min, max, cond, icon });
      }
    }

    // Datos de precipitación actualizados según La Nueva (19/11/2025)
    const laNuevaData = {
      precip: {
        monthly_mm: 21.5,
        historical_nov: 57.2,
        yearly_mm: 999.6
      }
    };

    // Simular posts de @meteobahia
    const meteobahiaPosts = [
      { datetime: "2025-11-19 11:00", cond: getWeatherCondition(getCurrentWeatherCode(hourly)), rain: 0, source: "@meteobahia" },
      { datetime: "2025-11-18 14:00", cond: "Parcialmente nublado", rain: 0, source: "@meteobahia" },
      { datetime: "2025-11-17 10:00", cond: "Despejado", rain: 0, source: "@meteobahia" },
      { datetime: "2025-11-15 22:16", cond: "Nublado", rain: 0.2, source: "@meteobahia" },
      { datetime: "2025-11-14 18:00", cond: "Mayormente nublado", rain: 0, source: "@meteobahia" }
    ];

    // Calcular lluvia de hoy
    const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(today));
    const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
    const lastPost = meteobahiaPosts[0];
    const todayLabel = todayPosts.length > 0 ? `${todayRain} mm` : `${lastPost.rain} mm`;

    // Registro reciente
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
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Error interno al procesar los datos meteorológicos' });
  }
};

// Funciones auxiliares para traducir códigos de clima
function getWeatherCondition(weatherCode) {
  const conditions = {
    0: 'Despejado',
    1: 'Mayormente despejado',
    2: 'Parcialmente nublado',
    3: 'Nublado',
    45: 'Niebla',
    51: 'Llovizna ligera',
    53: 'Llovizna moderada',
    55: 'Llovizna densa',
    61: 'Lluvia ligera',
    63: 'Lluvia moderada',
    65: 'Lluvia fuerte',
    80: 'Chubascos ligeros',
    81: 'Chubascos moderados',
    82: 'Chubascos fuertes',
    95: 'Tormenta eléctrica',
    96: 'Tormenta con granizo ligero',
    99: 'Tormenta con granizo fuerte'
  };
  return conditions[weatherCode] || 'Desconocido';
}

function getWeatherIcon(weatherCode) {
  const icons = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    51: '🌧️',
    53: '🌧️',
    55: '🌧️',
    61: '🌦️',
    63: '🌧️',
    65: '⛈️',
    80: '🌦️',
    81: '🌧️',
    82: '⛈️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️'
  };
  return icons[weatherCode] || '☁️';
}

function getCurrentWeatherCode(hourly) {
  const now = new Date();
  const utcHour = now.getUTCHours() + (now.getUTCMinutes() / 60);
  const idx = Math.floor(utcHour);
  return hourly.weathercode[idx] || 3; // Default a nublado si no hay dato
}

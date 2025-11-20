const LAT = -38.72;
const LON = -62.27;
const TIMEZONE = "America/Argentina/Buenos_Aires";

// Mapea el weathercode de Open-Meteo a texto + emoji
function describeWeather(code) {
  const c = Number(code);
  if (c === 0) return { text: "Despejado", icon: "☀️" };
  if (c === 1) return { text: "Mayormente despejado", icon: "🌤️" };
  if (c === 2) return { text: "Parcialmente nublado", icon: "⛅" };
  if (c === 3) return { text: "Nublado", icon: "☁️" };
  if (c === 45 || c === 48) return { text: "Niebla", icon: "🌫️" };
  if ([51, 53, 55, 56, 57].includes(c)) return { text: "Llovizna", icon: "🌦️" };
  if ([61, 63, 65, 80, 81, 82].includes(c)) return { text: "Lluvia", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(c)) return { text: "Nieve", icon: "🌨️" };
  if ([95, 96, 99].includes(c)) return { text: "Tormenta", icon: "⛈️" };
  return { text: "Variable", icon: "🌡️" };
}

module.exports = async (req, res) => {
  try {
    // Llamada a Open-Meteo con daily + hourly + current
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${LAT}&longitude=${LON}` +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode" +
      "&hourly=precipitation,weathercode" +
      "&current_weather=true" +
      "&past_days=1" +
      `&timezone=${encodeURIComponent(TIMEZONE)}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo error: ${response.status} ${response.statusText}`);
    }

    const meteo = await response.json();
    const daily = meteo.daily;
    const hourly = meteo.hourly;
    const currentWeather = meteo.current_weather;

    if (!daily || !hourly || !currentWeather) {
      throw new Error("Respuesta incompleta de Open-Meteo");
    }

    // ---- PRONÓSTICO 7 DÍAS (hoy + 6) ----
    const forecast = daily.time.map((dateStr, idx) => {
      const d = new Date(dateStr + "T00:00:00");
      const dayName = d.toLocaleDateString("es-AR", { weekday: "long" });
      const dateShort = d.toLocaleDateString("es-AR", {
        day: "2-digit",
        month: "2-digit",
      });

      const min = Math.round(daily.temperature_2m_min[idx]);
      const max = Math.round(daily.temperature_2m_max[idx]);
      const { text, icon } = describeWeather(daily.weathercode[idx]);
      const rainMm =
        typeof daily.precipitation_sum[idx] === "number"
          ? daily.precipitation_sum[idx]
          : 0;

      return {
        day: dayName,       // ej: "miércoles"
        date: dateShort,    // ej: "20/11"
        min,                // °C
        max,                // °C
        cond: text,         // ej: "Parcialmente nublado"
        icon,               // emoji que ya usás en el front
        rain: `${rainMm.toFixed(1)} mm`,
      };
    });

    // ---- REGISTROS RECIENTES DE LLUVIA (tabla) ----
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const hourlyRecords = (hourly.time || []).map((t, idx) => ({
      iso: t, // "2025-11-19T12:00"
      rain: hourly.precipitation[idx],
      code: hourly.weathercode[idx],
    }));

    let recent = hourlyRecords
      .filter((r) => {
        const dt = new Date(r.iso);
        return dt >= oneDayAgo && dt <= now;
      })
      .sort((a, b) => new Date(b.iso) - new Date(a.iso))
      .slice(0, 5);

    // Si por alguna razón no hay datos en las últimas 24h,
    // usamos los últimos 5 registros de la serie.
    if (recent.length === 0 && hourlyRecords.length > 0) {
      recent = hourlyRecords.slice(-5).reverse();
    }

    const precipRecords = recent.map((r) => {
      const dt = new Date(r.iso);
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const dd = String(dt.getDate()).padStart(2, "0");
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      const { text } = describeWeather(r.code);

      return {
        datetime: `${yyyy}-${mm}-${dd} ${hh}:${mi}`, // lo que ya usa tu tabla
        cond: text,
        rain: typeof r.rain === "number" ? Number(r.rain.toFixed(1)) : 0,
        source: "Open-Meteo",
      };
    });

    // ---- RESÚMENES ----
    // Lluvia de hoy, en mm (diaria de Open-Meteo)
    const todayRainMm =
      daily.precipitation_sum && typeof daily.precipitation_sum[0] === "number"
        ? daily.precipitation_sum[0]
        : 0;
    const todayLabel = `${todayRainMm.toFixed(1)} mm`;

    // Datos de La Nueva: siguen fijos por ahora, igual que antes
    const laNuevaData = {
      precip: {
        monthly_mm: 21.5,      // Actualizado a mano
        historical_nov: 57.2,  // Media histórica
        yearly_mm: 999.6,      // Acumulado anual 2025
      },
    };

    res.json({
      forecast,
      precipRecords,
      summaries: {
        today: todayLabel,                                   // "Último registro (Meteo)" → ahora mm reales del día
        month: `${laNuevaData.precip.monthly_mm} mm`,        // Mes (La Nueva)
        historicalNov: `${laNuevaData.precip.historical_nov} mm`,
        yearly: `${laNuevaData.precip.yearly_mm} mm`,
      },
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error interno" });
  }
};

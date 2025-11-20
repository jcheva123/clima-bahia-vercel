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

// Devuelve "YYYY-MM-DD" para HOY en la zona horaria de Bahía Blanca
function getTodayLocalISO() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = fmt.formatToParts(now);
  const obj = {};
  for (const p of parts) {
    if (p.type === "year" || p.type === "month" || p.type === "day") {
      obj[p.type] = p.value;
    }
  }
  // en-CA → "YYYY-MM-DD"
  return `${obj.year}-${obj.month}-${obj.day}`;
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

    // ---- LOCALIZAR HOY EN daily.time ----
    const todayLocalStr = getTodayLocalISO(); // ej: "2025-11-20"
    let idxToday = daily.time.findIndex((t) => t === todayLocalStr);
    if (idxToday === -1) {
      // fallback por si algo raro pasa → usamos el índice 0
      idxToday = 0;
    }

    // ---- PRONÓSTICO: desde HOY (idxToday) los próximos 7 días ----
    const startIndex = idxToday;
    const endIndex = Math.min(startIndex + 7, daily.time.length);
    const forecast = [];

    for (let idx = startIndex; idx < endIndex; idx++) {
      const dateStr = daily.time[idx]; // "YYYY-MM-DD"
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

      forecast.push({
        day: dayName,      // ej: "jueves"
        date: dateShort,   // ej: "20/11"
        min,               // °C
        max,               // °C
        cond: text,        // ej: "Parcialmente nublado"
        icon,              // emoji
        rain: `${rainMm.toFixed(1)} mm`,
      });
    }

    // ---- REGISTROS RECIENTES (últimos 5 horarios) ----
    const hourlyRecords = (hourly.time || []).map((t, idx) => ({
      iso: t, // "2025-11-20T12:00"
      rain: hourly.precipitation[idx],
      code: hourly.weathercode[idx],
    }));

    // Tomamos SIEMPRE los últimos 5 registros horarios disponibles
    const last5 = hourlyRecords.slice(-5).reverse();

    const precipRecords = last5.map((r) => {
      // r.iso viene ya en hora local de Bahía Blanca gracias a timezone=...
      const [datePart, timePart] = r.iso.split("T"); // "YYYY-MM-DD", "HH:MM"
      const [year, month, day] = datePart.split("-");
      const hhmm = timePart.slice(0, 5);
      const { text } = describeWeather(r.code);

      return {
        datetime: `${year}-${month}-${day} ${hhmm}`, // lo que ya espera tu tabla
        cond: text,
        rain: typeof r.rain === "number" ? Number(r.rain.toFixed(1)) : 0,
        source: "Open-Meteo",
      };
    });

    // ---- RESÚMENES ----
    const todayRainMm =
      daily.precipitation_sum &&
      typeof daily.precipitation_sum[idxToday] === "number"
        ? daily.precipitation_sum[idxToday]
        : 0;
    const todayLabel = `${todayRainMm.toFixed(1)} mm`;

    // Datos de La Nueva: siguen fijos por ahora
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
        today: todayLabel,                                   // "Último registro (Meteo)" → lluvia de hoy
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

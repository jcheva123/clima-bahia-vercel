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
  if ([45, 48].includes(c)) return { text: "Niebla", icon: "🌫️" };
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
  return `${obj.year}-${obj.month}-${obj.day}`;
}

// Lee precipitaciones mensuales/anuales desde La Nueva (con fallback)
async function fetchLaNuevaPrecip() {
  const fallback = {
    monthly_mm: 21.5,
    historical_nov: 57.2,
    yearly_mm: 999.6,
  };

  try {
    const res = await fetch("https://www.lanueva.com/servicios/pronostico");
    if (!res.ok) {
      console.error("La Nueva HTTP error:", res.status, res.statusText);
      return fallback;
    }
    const html = await res.text();

    const monthMatch = html.match(/En el mes\s*([\d.,]+)\s*mm/i);
    const histMatch  = html.match(/Media hist[óo]rica\s*([\d.,]+)\s*mm/i);
    const yearMatch  = html.match(/En el a[ñn]o\s*([\d.,]+)\s*mm/i);

    const parseNum = (str) => {
      if (!str) return null;
      const cleaned = str.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(cleaned);
      return isNaN(n) ? null : n;
    };

    const monthly_mm     = parseNum(monthMatch && monthMatch[1]) ?? fallback.monthly_mm;
    const historical_nov = parseNum(histMatch && histMatch[1])  ?? fallback.historical_nov;
    const yearly_mm      = parseNum(yearMatch && yearMatch[1])  ?? fallback.yearly_mm;

    return { monthly_mm, historical_nov, yearly_mm };
  } catch (err) {
    console.error("Error leyendo La Nueva:", err);
    return fallback;
  }
}

// Actualizada: Usa endpoint de syndication más confiable y parsea JSON para extraer Lluv del post más reciente
async function fetchMeteobahiaLluv() {
  const regex = /Lluv:\s*([\d.,]+)\s*mm/i;

  const url = "https://syndication.twitter.com/srv/timeline-profile/screen-name/meteobahia";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ClimaBahiaBot/1.0; +https://clima-bahia-vercel.vercel.app)",
      },
    });

    if (!res.ok) {
      console.error("Syndication HTTP error:", res.status, res.statusText);
      return null;
    }

    let text = await res.text();

    // El response es JSONP-like, envuelto en paréntesis o similar; extraemos el JSON puro
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}') + 1;
    if (start === -1 || end === -1) {
      console.error("No JSON válido en syndication response");
      return null;
    }

    const jsonStr = text.substring(start, end);
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Error parseando JSON de syndication:", parseErr);
      return null;
    }

    // Estructura típica: data.props.pageProps.timeline.entries (array de posts, el [0] es el más reciente)
    const entries = data?.props?.pageProps?.timeline?.entries || [];

    if (entries.length === 0) {
      console.error("No entries en timeline");
      return null;
    }

    // Itera de más reciente a más antiguo hasta encontrar el valor
    for (const entry of entries) {
      const fullText = entry?.content?.tweet?.full_text || entry?.content?.itemContent?.tweet_results?.result?.legacy?.full_text || '';
      const match = regex.exec(fullText);
      if (match && match[1]) {
        const num = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(num)) {
          console.log("Lluv desde Meteobahia (syndication):", num, "mm");
          return num;
        }
      }
    }

    console.error("No Lluv encontrado en los posts recientes");
    return null;
  } catch (err) {
    console.error("Error en fetch syndication:", err);
    return null;
  }
}

module.exports = async (req, res) => {
  try {
    // Llamada a Open-Meteo
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
      console.error("Open-Meteo HTTP error:", response.status, response.statusText);
      throw new Error("Open-Meteo error");
    }

    const meteo = await response.json();
    if (!meteo.daily || !meteo.hourly || !meteo.current_weather) {
      throw new Error("Respuesta incompleta de Open-Meteo");
    }

    const daily = meteo.daily;
    const hourly = meteo.hourly;

    // ---- LOCALIZAR HOY EN daily.time ----
    const todayLocalStr = getTodayLocalISO();
    let idxToday = daily.time.findIndex((t) => t === todayLocalStr);
    if (idxToday === -1) idxToday = 0;

    // ---- PRONÓSTICO: desde HOY los próximos 7 días ----
    const startIndex = idxToday;
    const endIndex = Math.min(startIndex + 7, daily.time.length);
    const forecast = [];

    for (let idx = startIndex; idx < endIndex; idx++) {
      const dateStr = daily.time[idx];
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
        day: dayName,
        date: dateShort,
        min,
        max,
        cond: text,
        icon,
        rain: `${rainMm.toFixed(1)} mm`,
      });
    }

    // ---- REGISTROS RECIENTES (últimos 5 horarios) ----
    const hourlyRecords = (hourly.time || []).map((t, idx) => ({
      iso: t,
      rain: hourly.precipitation[idx],
      code: hourly.weathercode[idx],
    }));

    const last5 = hourlyRecords.slice(-5).reverse();

    const precipRecords = last5.map((r) => {
      const [datePart, timePart] = r.iso.split("T");
      const [year, month, day] = datePart.split("-");
      const hhmm = timePart.slice(0, 5);
      const { text } = describeWeather(r.code);

      return {
        datetime: `${year}-${month}-${day} ${hhmm}`,
        cond: text,
        rain: typeof r.rain === "number" ? Number(r.rain.toFixed(1)) : 0,
        source: "Open-Meteo",
      };
    });

    // ---- LLUVIA DE HOY (Open-Meteo) ----
    const todayRainMm =
      daily.precipitation_sum &&
      typeof daily.precipitation_sum[idxToday] === "number"
        ? daily.precipitation_sum[idxToday]
        : 0;

    // ---- La Nueva + Meteobahia EN PARALELO ----
    const [laNuevaData, meteobahiaLluv] = await Promise.all([
      fetchLaNuevaPrecip(),
      fetchMeteobahiaLluv(),
    ]);

    console.log("meteobahiaLluv:", meteobahiaLluv);

    const todaySource = meteobahiaLluv != null ? "meteobahia" : "open-meteo";
    const todayValue = meteobahiaLluv != null ? meteobahiaLluv : todayRainMm;
    const todayLabel = `${todayValue.toFixed(1)} mm`;

    res.status(200).json({
      forecast,
      precipRecords,
      summaries: {
        today: todayLabel,                          // lo que ve tu tarjeta
        todaySource,                                // "meteobahia" o "open-meteo"
        month: `${laNuevaData.monthly_mm} mm`,
        historicalNov: `${laNuevaData.historical_nov} mm`,
        yearly: `${laNuevaData.yearly_mm} mm`,
      },
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error interno" });
  }
};

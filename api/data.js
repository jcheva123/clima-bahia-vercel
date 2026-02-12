const zlib = require("node:zlib");

const LAT = -38.72;
const LON = -62.27;
const TIMEZONE = "America/Argentina/Buenos_Aires";

// Meteostat: estación (según meteostat.net/es/station/87750)
const METEOSTAT_STATION_ID = "87750";

// BCP (Bolsa de Cereales Bahía Blanca) – Estaciones
const BCP_STATIONS = [
  {
    id: 29,
    short: "Centro",
    label: "Estación 29 - Bahía Blanca - Centro (B. Bca.)",
    link: "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=29",
    urls: [
      "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=29",
      "https://info.bcp.org.ar/Estaciones/MapaG.asp?Estacion=29",
    ],
  },
  {
    id: 1,
    short: "Grünbein",
    label: "Estación 1 - Grünbein (B. Bca.)",
    link: "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=1",
    urls: [
      "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=1",
      "https://info.bcp.org.ar/Estaciones/MapaG.asp?Estacion=1",
    ],
  },
  {
    id: 3,
    short: "La Vitícola",
    label: "Estación 3 - La Vitícola (B. Bca.)",
    link: "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=3",
    urls: [
      "https://info.bcp.org.ar/Estaciones/Mapa.asp?Estacion=3",
      "https://info.bcp.org.ar/Estaciones/MapaG.asp?Estacion=3",
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

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

// Devuelve "YYYY-MM-DD" para una fecha relativa en la zona horaria indicada
function getLocalISOForOffsetDays(offsetDays) {
  const d = new Date(Date.now() - offsetDays * 24 * 60 * 60 * 1000);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const obj = {};
  for (const p of parts) {
    if (p.type === "year" || p.type === "month" || p.type === "day") obj[p.type] = p.value;
  }
  return `${obj.year}-${obj.month}-${obj.day}`;
}

function parseMaybeNumber(v) {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (!s) return null;
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Descarga HTML en bytes y decodifica con latin1 (BCP suele venir en ISO-8859-1)
async function fetchHtmlLatin1(url, timeoutMs = 6500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        // algunos sitios responden mejor con UA explícito
        "User-Agent": "Mozilla/5.0 (compatible; ClimaBahia/1.0; +https://vercel.com)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const ab = await r.arrayBuffer();
    const decoder = new TextDecoder("latin1");
    return decoder.decode(ab);
  } finally {
    clearTimeout(t);
  }
}

// ─────────────────────────────────────────────────────────────
// La Nueva (mes / media hist / año)
// ─────────────────────────────────────────────────────────────
async function fetchLaNuevaPrecip() {
  const fallback = {
    monthly_mm: 0,
    historical_month_mm: 0,
    yearly_mm: 0,
  };

  try {
    const res = await fetch("https://www.lanueva.com/servicios/pronostico");
    if (!res.ok) return fallback;
    const html = await res.text();

    const monthMatch = html.match(/En el mes\s*([\d.,]+)\s*mm/i);
    const histMatch = html.match(/Media hist[óo]rica\s*([\d.,]+)\s*mm/i);
    const yearMatch = html.match(/En el a[ñn]o\s*([\d.,]+)\s*mm/i);

    // La Nueva puede publicar con punto decimal (66.2) o con formato ES (1.234,5).
    // No podemos borrar puntos indiscriminadamente.
    const parseNum = (str) => {
      if (!str) return null;
      let s = String(str).trim();
      // mantener solo dígitos, coma, punto y signo
      s = s.replace(/[^0-9,.-]/g, "");
      const hasComma = s.includes(",");
      const hasDot = s.includes(".");

      if (hasComma && hasDot) {
        // caso típico ES: 1.234,5
        s = s.replace(/\./g, "").replace(",", ".");
      } else if (hasComma && !hasDot) {
        // decimal con coma: 66,2
        s = s.replace(",", ".");
      } else if (hasDot && !hasComma) {
        // si parece separador de miles (1.234) y no decimal
        const m = s.match(/^(-?\d{1,3})\.(\d{3})$/);
        if (m) s = `${m[1]}${m[2]}`;
      }

      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    };

    const monthly_mm = parseNum(monthMatch && monthMatch[1]) ?? fallback.monthly_mm;
    const historical_month_mm = parseNum(histMatch && histMatch[1]) ?? fallback.historical_month_mm;
    const yearly_mm = parseNum(yearMatch && yearMatch[1]) ?? fallback.yearly_mm;

    return { monthly_mm, historical_month_mm, yearly_mm };
  } catch (err) {
    console.error("Error leyendo La Nueva:", err);
    return fallback;
  }
}

// ─────────────────────────────────────────────────────────────
// Meteostat (Bulk) – Daily CSV (prcp)
// https://data.meteostat.net/daily/{year}/{station}.csv.gz
// ─────────────────────────────────────────────────────────────

// cache en memoria (vive mientras el lambda quede caliente)
const meteostatCache = globalThis.__METEOSTAT_CACHE__ || (globalThis.__METEOSTAT_CACHE__ = new Map());
const METEOSTAT_TTL_MS = 6 * 60 * 60 * 1000; // 6h

async function loadMeteostatDailyYear(stationId, year) {
  const key = `${stationId}:${year}`;
  const cached = meteostatCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < METEOSTAT_TTL_MS) return cached.data;

  const url = `https://data.meteostat.net/daily/${year}/${stationId}.csv.gz`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Meteostat bulk HTTP ${resp.status} (${url})`);

  const gz = Buffer.from(await resp.arrayBuffer());
  const csvBuf = zlib.gunzipSync(gz);
  const csv = csvBuf.toString("utf8");

  const lines = csv.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("Meteostat CSV vacío");

  const header = lines[0].split(",");
  const idxDate = header.indexOf("date");
  const idxPrcp = header.indexOf("prcp");
  const idxPrcpSource = header.indexOf("prcp_source");

  if (idxDate === -1 || idxPrcp === -1) {
    throw new Error(`Meteostat CSV sin columnas esperadas (date/prcp). Header: ${header.join(",")}`);
  }

  const map = new Map(); // date -> { prcp, sourceIds? }
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",");
    const date = row[idxDate];
    const prcp = parseMaybeNumber(row[idxPrcp]);
    const src = idxPrcpSource !== -1 ? row[idxPrcpSource] : "";
    if (date) map.set(date, { prcp, src });
  }

  meteostatCache.set(key, { fetchedAt: Date.now(), data: map });
  return map;
}

async function getLast7DaysPrecipFromMeteostat(stationId) {
  const dates = [];
  for (let i = 0; i < 7; i++) dates.push(getLocalISOForOffsetDays(i)); // hoy, ayer, ...
  const yearsNeeded = [...new Set(dates.map((d) => d.slice(0, 4)))];

  const yearMaps = {};
  for (const y of yearsNeeded) {
    yearMaps[y] = await loadMeteostatDailyYear(stationId, y);
  }

  // Devuelve en orden: más reciente primero
  return dates.map((dateISO) => {
    const year = dateISO.slice(0, 4);
    const rec = yearMaps[year]?.get(dateISO);
    return {
      dateISO,
      prcp: rec ? rec.prcp : null,
      src: rec ? rec.src : "",
      source: "Meteostat",
    };
  });
}

// ─────────────────────────────────────────────────────────────
// BCP Estación 29 (fallback) – "Precipitaciones del día"
// ─────────────────────────────────────────────────────────────
function parseBcpPrecipTodayMm(html) {
  // Ejemplos vistos en snippets:
  // "Precipitaciones del día, 0 mm"
  // "Precipitaciones del día</td><td>0 mm"
  const rx = /Precipitaciones\s+del\s+d[ií]a[^0-9]*([\d.,]+)\s*mm/i;
  const m = html.match(rx);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function getLocalMonth2Digits() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, month: "2-digit" });
  return fmt.format(new Date());
}

function parseBcpMonthAccum(html, currentMonth2) {
  // Filas típicas:
  // "Precip. 01/02 al 11/02" 19.3 mm
  const rx = /Precip\.?\s*(\d{2}\/\d{2})\s*al\s*(\d{2}\/\d{2})[^0-9N]*([\d.,]+)\s*mm/gi;
  const matches = [];
  let m;
  while ((m = rx.exec(html)) !== null) {
    const start = m[1];
    const end = m[2];
    const mm = parseMaybeNumber(m[3]);
    if (mm == null) continue;
    matches.push({
      start,
      end,
      mm,
      label: `Precip. ${start} al ${end}`,
    });
  }

  if (matches.length === 0) return { label: null, mm: null };

  // Preferimos el acumulado del mes actual: empieza en 01/MM
  const targetStart = `01/${currentMonth2}`;
  const monthMatches = matches.filter((x) => x.start === targetStart);
  const pick = (monthMatches.length ? monthMatches : matches).at(-1);
  return { label: pick.label, mm: pick.mm };
}

async function fetchBcpStationSnapshot(station, currentMonth2) {
  let lastErr = null;

  for (const url of station.urls) {
    try {
      const html = await fetchHtmlLatin1(url);
      const today_mm = parseBcpPrecipTodayMm(html);
      const month = parseBcpMonthAccum(html, currentMonth2);

      // Si al menos algo aparece, devolvemos
      if (today_mm != null || month.mm != null) {
        return {
          id: station.id,
          short: station.short,
          label: station.label,
          link: station.link,
          today_mm: today_mm != null ? Number(today_mm) : null,
          month_mm: month.mm != null ? Number(month.mm) : null,
          month_label: month.label,
        };
      }
    } catch (e) {
      lastErr = e;
      console.warn("BCP fetch/parse error:", url, e?.message || e);
    }
  }

  return {
    id: station.id,
    short: station.short,
    label: station.label,
    link: station.link,
    today_mm: null,
    month_mm: null,
    month_label: null,
    error: lastErr ? (lastErr.message || String(lastErr)) : undefined,
  };
}

async function fetchBcpStations() {
  const currentMonth2 = getLocalMonth2Digits();
  return Promise.all(BCP_STATIONS.map((s) => fetchBcpStationSnapshot(s, currentMonth2)));
}

// ─────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────
module.exports = async (req, res) => {
  // Cache de CDN moderado: actualiza rápido pero evita martillar APIs
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  try {
    // 1) Open-Meteo: current + daily (min/max + precip forecast)
    const openMeteoUrl =
      "https://api.open-meteo.com/v1/forecast" +
      `?latitude=${LAT}&longitude=${LON}` +
      "&current_weather=true" +
      "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode" +
      "&past_days=7&forecast_days=7" +
      `&timezone=${encodeURIComponent(TIMEZONE)}`;

    const response = await fetch(openMeteoUrl);
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

    const meteo = await response.json();
    if (!meteo.daily || !meteo.current_weather) throw new Error("Respuesta incompleta de Open-Meteo");

    const daily = meteo.daily;

    // encontrar HOY dentro de daily.time
    const todayLocalStr = getLocalISOForOffsetDays(0);
    let idxToday = daily.time.findIndex((t) => t === todayLocalStr);
    if (idxToday === -1) idxToday = Math.max(0, daily.time.length - 1);

    // 2) Pronóstico: desde HOY próximos 7 días
    const forecast = [];
    const endIndex = Math.min(idxToday + 7, daily.time.length);

    for (let idx = idxToday; idx < endIndex; idx++) {
      const dateStr = daily.time[idx];
      const d = new Date(dateStr + "T00:00:00");
      const dayName = d.toLocaleDateString("es-AR", { weekday: "long" });
      const dateShort = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

      const min = Math.round(daily.temperature_2m_min[idx]);
      const max = Math.round(daily.temperature_2m_max[idx]);
      const { text, icon } = describeWeather(daily.weathercode[idx]);
      const rainMm = parseMaybeNumber(daily.precipitation_sum[idx]) ?? 0;

      forecast.push({
        day: dayName,
        date: dateShort,
        min,
        max,
        cond: text,
        icon,
        rainMm: Number(rainMm.toFixed(1)),
      });
    }

    // 3) Temperatura actual (para tarjeta HOY)
    const current = {
      temp: Math.round(meteo.current_weather.temperature),
      time: meteo.current_weather.time,
      ...describeWeather(meteo.current_weather.weathercode),
    };

    // 4) Registro de precipitaciones: último 7 días (Meteostat) + fallback
    let precipLast7 = [];
    let precipSourceMode = "meteostat";

    try {
      precipLast7 = await getLast7DaysPrecipFromMeteostat(METEOSTAT_STATION_ID);
    } catch (e) {
      console.warn("Meteostat failed, fallback to Open-Meteo/BCP:", e?.message || e);
      precipSourceMode = "fallback";
      precipLast7 = [];
    }

    // Completar nulos con Open-Meteo (si tiene esos días) y, para HOY, con BCP si hace falta
    const openMeteoDailyByISO = new Map();
    for (let i = 0; i < daily.time.length; i++) {
      openMeteoDailyByISO.set(daily.time[i], parseMaybeNumber(daily.precipitation_sum[i]));
    }

    // fallback BCP para HOY si no hay Meteostat (o viene null)
    const bcpStations = await fetchBcpStations();

    const bcpTodayMm = bcpStations.find((s) => s.id === 29)?.today_mm ?? null;

    const precipRecords = [];
    for (let i = 0; i < 7; i++) {
      const dateISO = getLocalISOForOffsetDays(i);
      const d = new Date(dateISO + "T00:00:00");
      const dayName = d.toLocaleDateString("es-AR", { weekday: "long" });
      const dateShort = d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });

      // Meteostat si existe
      const m = precipLast7.find((x) => x.dateISO === dateISO);
      let mm = m?.prcp ?? null;
      let source = m?.source ?? "Meteostat";

      // Si Meteostat no trajo dato: intentar Open-Meteo (model / reanalysis)
      if (mm == null) {
        const om = openMeteoDailyByISO.get(dateISO);
        if (om != null) {
          mm = om;
          source = "Open-Meteo";
        }
      }

      // Si sigue null y es HOY, intentar BCP
      if (mm == null && i === 0 && bcpTodayMm != null) {
        mm = bcpTodayMm;
        source = "BCP (Est. 29 Centro)";
      }

      precipRecords.push({
        day: dayName,
        date: dateShort,
        dateISO,
        rain: mm != null ? Number(mm.toFixed(1)) : null,
        source,
      });
    }

    // Orden: hoy primero (ya lo es)
    // 5) Tarjetas resumen
    // "Último registro (día)" → el primer valor disponible desde HOY hacia atrás
    let lastValue = null;
    for (const r of precipRecords) {
      if (typeof r.rain === "number") {
        lastValue = r.rain;
        break;
      }
    }

    const laNuevaData = await fetchLaNuevaPrecip();

    res.status(200).json({
      current,
      forecast,
      precipRecords, // 7 días: hoy -> atrás
      bcpStations, // Otros registros (BCP)
      summaries: {
        today: lastValue != null ? `${lastValue.toFixed(1)} mm` : "—",
        month: `${Number(laNuevaData.monthly_mm).toFixed(1)} mm`,
        historicalNov: `${Number(laNuevaData.historical_month_mm).toFixed(1)} mm`,
        yearly: `${Number(laNuevaData.yearly_mm).toFixed(1)} mm`,
      },
      meta: {
        precipSourceMode,
      },
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: "Error interno" });
  }
};

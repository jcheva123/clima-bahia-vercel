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

// Actualizada: Usa Puppeteer con stealth para evadir detección
async function fetchMeteobahiaLluv() {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());
  const chromium = require('@sparticuz/chromium');

  const regex = /Lluv:\s*([\d.,]+)\s*mm/i;

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36');

    await page.goto('https://x.com/meteobahia', { waitUntil: 'networkidle2', timeout: 30000 });

    // Espera a que carguen los posts
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });

    // Scroll para cargar más
    await page.evaluate(() => window.scrollBy(0, window.innerHeight));
    await page.waitForTimeout(2000);

    // Extrae texto de posts
    const texts = await page.evaluate(() => {
      const posts = Array.from(document.querySelectorAll('article[data-testid="tweet"] div[data-testid="tweetText"]'));
      return posts.map(post => post.innerText);
    });

    await browser.close();

    // Busca el valor
    for (const text of texts) {
      const match = regex.exec(text);
      if (match && match[1]) {
        const num = parseFloat(match[1].replace(',', '.'));
        if (!isNaN(num)) {
          return num;
        }
      }
    }

    return null;
  } catch (err) {
    console.error('Error en Puppeteer:', err);
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
      throw new Error("Open-Meteo error");
    }

    const meteo = await response.json();
    const daily = meteo.daily;
    const hourly = meteo.hourly;

    const todayLocalStr = getTodayLocalISO();
    let idxToday = daily.time.findIndex((t) => t === todayLocalStr);
    if (idxToday === -1) idxToday = 0;

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
      const rainMm = daily.precipitation_sum[idx] || 0;

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

    const hourlyRecords = hourly.time.map((t, idx) => ({
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
        rain: Number((r.rain || 0).toFixed(1)),
        source: "Open-Meteo",
      };
    });

    const todayRainMm = daily.precipitation_sum[idxToday] || 0;

    const [laNuevaData, meteobahiaLluv] = await Promise.all([
      fetchLaNuevaPrecip(),
      fetchMeteobahiaLluv(),
    ]);

    const todaySource = meteobahiaLluv != null ? "meteobahia" : "open-meteo";
    const todayValue = meteobahiaLluv != null ? meteobahiaLluv : todayRainMm;
    const todayLabel = `${todayValue.toFixed(1)} mm`;

    res.status(200).json({
      forecast,
      precipRecords,
      summaries: {
        today: todayLabel,
        todaySource,
        month: `${laNuevaData.monthly_mm} mm`,
        historicalNov: `${laNuevaData.historical_nov} mm`,
        yearly: `${laNuevaData.yearly_mm} mm`,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Error interno" });
  }
};

module.exports = async (req, res) => {
  try {
    const laNuevaData = {
      forecast: [
        { day: "Lunes", date: "17/11", min: 11, max: 31, cond: "Despejado (basado en datos actuales)", icon: "", rain: null },
        { day: "Martes", date: "18/11", min: 13, max: 26, cond: "Fresco a cálido", icon: "", rain: "0%" },
        { day: "Miércoles", date: "19/11", min: 11, max: 26, cond: "Fresco a cálido", icon: "", rain: "0%" },
        { day: "Jueves", date: "20/11", min: 13, max: 27, cond: "Fresco a cálido", icon: "", rain: "0%" },
        { day: "Viernes", date: "21/11", min: 14, max: 28, cond: "Variable", icon: "", rain: "10%" },
        { day: "Sábado", date: "22/11", min: 15, max: 30, cond: "Cálido", icon: "", rain: "0%" },
        { day: "Domingo", date: "23/11", min: 16, max: 29, cond: "Variable", icon: "", rain: "20%" }
      ],
      precip: {
        monthly_mm: 21.5,
        historical_nov: 57.2,
        yearly_mm: 999.6
      }
    };const meteobahiaPosts = [
  { datetime: "2025-11-17 10:16", cond: "Despejado", rain: 0, source: "@meteobahia" },
  { datetime: "2025-11-17 09:16", cond: "Despejado. Ventoso", rain: 0, source: "@meteobahia" },
  { datetime: "2025-11-17 08:16", cond: "Despejado. Ventoso", rain: 0, source: "@meteobahia" },
  { datetime: "2025-11-17 07:16", cond: "Mayormente nublado", rain: 0, source: "@meteobahia" },
  { datetime: "2025-11-17 06:16", cond: "Despejado. Ventoso", rain: 0, source: "@meteobahia" }
];

const todayStr = new Date().toISOString().split('T')[0];
const todayPosts = meteobahiaPosts.filter(p => p.datetime.startsWith(todayStr));
const todayRain = todayPosts.length > 0 ? Math.max(...todayPosts.map(p => p.rain)) : 0;
const monthRain = laNuevaData.precip.monthly_mm; // Solo La Nueva, sin sumar todayRain

let todayLabel = `${todayRain} mm`;
if (todayPosts.length === 0) {
  const lastPost = meteobahiaPosts[0];
  todayLabel = `${lastPost.rain} mm`;
}

const recentRecords = meteobahiaPosts
  .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
  .slice(0, 5);

// Sugerencia para hacer el radar dinámico (descomentar si quieres usarlo)
// async function getRadarUrl() {
//   const radarRes = await fetch('https://www.climasurgba.com.ar/radar/bahia_blanca');
//   const html = await radarRes.text();
//   const match = html.match(/src="\/radar\/bahia_blanca-\d{8}-\d{6}\.png"/);
//   if (match) {
//     const src = match[0].slice(5, -1);
//     return 'https://www.climasurgba.com.ar' + src;
//   }
//   return 'https://www.climasurgba.com.ar/radar/bahia_blanca-20251117-110256.png'; // fallback


  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
};



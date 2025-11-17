// api/radar.js
module.exports = async (req, res) => {
  try {
    // Por ahora: URL fija (podés pegar la última que veas en la web del SMN)
    const url = 'https://estaticos.smn.gob.ar/vmsr/radar/RMA10_240_ZH_CMAX_20251114_130223Z.png';

    // Cabecera opcional, pero no molesta
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.status(200).json({ url });
  } catch (err) {
    console.error('Error en api/radar:', err);
    res.status(500).json({ error: 'Error interno obteniendo radar SMN' });
  }
};

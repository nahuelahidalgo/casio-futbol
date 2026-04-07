// Proxy for Open-Meteo — bypasses iOS 9 TLS issues
module.exports = async function handler(req, res) {
  var lat = req.query.lat || '-34.6037';
  var lon = req.query.lon || '-58.3816';

  var url =
    'https://api.open-meteo.com/v1/forecast?latitude=' + lat +
    '&longitude=' + lon +
    '&current_weather=true&timezone=auto';

  try {
    var response = await fetch(url);
    var data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Weather fetch failed', detail: err.message });
  }
};

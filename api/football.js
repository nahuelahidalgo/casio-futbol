module.exports = async function handler(req, res) {
  var apiKey = process.env.FOOTBALL_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'FOOTBALL_API_KEY not set' }); return; }

  var teamsParam = req.query.teams || '';
  var teamIds = teamsParam.split(',').filter(function(id) { return id.trim() !== ''; });
  if (teamIds.length === 0) { res.status(400).json({ error: 'No team IDs provided' }); return; }

  var BASE = 'https://v3.football.api-sports.io';
  var headers = { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': 'v3.football.api-sports.io' };

  var now = new Date();
  var past = new Date(now); past.setDate(past.getDate() - 30);
  var future = new Date(now); future.setDate(future.getDate() + 30);
  var fromDate = fmtDate(past);
  var toDate = fmtDate(future);
  var result = {};

  var promises = teamIds.map(function(teamId) {
    var url = BASE + '/fixtures?team=' + teamId.trim() + '&from=' + fromDate + '&to=' + toDate + '&timezone=America/Argentina/Buenos_Aires';
    return fetch(url, { headers: headers }).then(function(r) { return r.json(); })
      .then(function(data) { return { teamId: teamId.trim(), data: data }; })
      .catch(function() { return { teamId: teamId.trim(), data: { response: [] } }; });
  });

  try {
    var results = await Promise.all(promises);
    for (var i = 0; i < results.length; i++) {
      var tId = results[i].teamId;
      var fixtures = results[i].data.response || [];
      var last = [], next = [];
      for (var j = 0; j < fixtures.length; j++) {
        var f = fixtures[j];
        var m = parseFix(f);
        if (isDone(f.fixture.status.short)) last.push(m); else next.push(m);
      }
      last.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
      next.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });
      result[tId] = { last: last.slice(0, 5), next: next.slice(0, 5) };
    }
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=120');
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch football data', detail: err.message });
  }
};
function parseFix(f) {
  return {
    date: f.fixture.date, status: f.fixture.status.short, elapsed: f.fixture.status.elapsed,
    competition: f.league.name, home: shortName(f.teams.home.name), homeId: f.teams.home.id,
    away: shortName(f.teams.away.name), awayId: f.teams.away.id,
    homeGoals: f.goals.home, awayGoals: f.goals.away
  };
}

function isDone(s) { return ['FT','AET','PEN','WO','AWD'].indexOf(s) !== -1; }

function shortName(name) {
  if (!name) return '';
  var map = {
    'River Plate': 'River', 'CA River Plate': 'River', 'Boca Juniors': 'Boca',
    'FC Barcelona': 'Barcelona', 'Real Madrid': 'R. Madrid',
    'Atletico Madrid': 'Atl. Madrid', 'Club Atletico de Madrid': 'Atl. Madrid',
    'Manchester United': 'Man Utd', 'Manchester City': 'Man City',
    'Inter Miami CF': 'Inter Miami', 'Inter Miami': 'Inter Miami',
    'FC Internazionale Milano': 'Inter', 'Inter Milan': 'Inter', 'Internazionale': 'Inter',
    'Paris Saint Germain': 'PSG', 'Paris Saint-Germain': 'PSG',
    'Borussia Dortmund': 'Dortmund', 'Bayern Munich': 'Bayern',
    'Tottenham Hotspur': 'Tottenham', 'Brighton and Hove Albion': 'Brighton',
    'Wolverhampton Wanderers': 'Wolves', 'Nottingham Forest': 'Nott. Forest',
    'Crystal Palace': 'C. Palace', 'West Ham United': 'West Ham',
    'Newcastle United': 'Newcastle', 'Argentina': 'Argentina',
    'Brazil': 'Brasil', 'Uruguay': 'Uruguay', 'Colombia': 'Colombia'
  };
  if (map[name]) return map[name];
  var c = name.replace(/^FC |^CF |^CA |^CD |^RC /,'').replace(/^Real /,'R. ').replace(/^Atletico /,'Atl. ');
  return c.length > 14 ? c.substring(0,13)+'.' : c;
}

function fmtDate(d) {
  var y = d.getFullYear();
  var m = ('0'+(d.getMonth()+1)).slice(-2);
  var day = ('0'+d.getDate()).slice(-2);
  return y+'-'+m+'-'+day;
}

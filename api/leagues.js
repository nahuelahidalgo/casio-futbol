// Serverless function to fetch league fixtures from API-Football (api-sports.io)
// Takes league IDs and returns recent + upcoming fixtures per league

module.exports = async function handler(req, res) {
  var apiKey = process.env.FOOTBALL_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'FOOTBALL_API_KEY not set' });
    return;
  }

  var leaguesParam = req.query.ids || '';
  var leagueIds = leaguesParam.split(',').filter(function(id) { return id.trim() !== ''; });

  if (leagueIds.length === 0) {
    res.status(400).json({ error: 'No league IDs provided' });
    return;
  }

  var BASE = 'https://v3.football.api-sports.io';
  var headers = {
    'x-rapidapi-key': apiKey,
    'x-rapidapi-host': 'v3.football.api-sports.io'
  };

  // Date range: 5 days back, 10 days forward
  var now = new Date();
  var past = new Date(now);
  past.setDate(past.getDate() - 5);
  var future = new Date(now);
  future.setDate(future.getDate() + 10);

  var fromDate = formatDate(past);
  var toDate = formatDate(future);

  // Determine season per league
  var year = now.getFullYear();
  var month = now.getMonth(); // 0-indexed
  // European leagues: season = year-1 if we're in Jan-Jul (season started previous Aug)
  var euroLeagues = ['2', '3', '39', '61', '135', '140', '78', '848'];
  // Americas leagues: season = current year
  var americasLeagues = ['253', '262'];

  var result = {};

  var promises = leagueIds.map(function(leagueId) {
    var lid = leagueId.trim();
    var season = year;
    if (euroLeagues.indexOf(lid) !== -1 && month < 7) {
      season = year - 1;
    }

    var url = BASE + '/fixtures?league=' + lid + '&season=' + season +
      '&from=' + fromDate + '&to=' + toDate +
      '&timezone=America/Argentina/Buenos_Aires';

    return fetch(url, { headers: headers })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        return { leagueId: lid, data: data };
      })
      .catch(function(err) {
        return { leagueId: lid, data: { response: [] } };
      });
  });

  try {
    var results = await Promise.all(promises);

    for (var i = 0; i < results.length; i++) {
      var lid = results[i].leagueId;
      var fixtures = results[i].data.response || [];

      var matches = [];
      for (var j = 0; j < fixtures.length; j++) {
        matches.push(parseFixture(fixtures[j]));
      }

      // Sort by date
      matches.sort(function(a, b) { return new Date(a.date) - new Date(b.date); });

      result[lid] = matches;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch league data', detail: err.message });
  }
};

function parseFixture(f) {
  return {
    date: f.fixture.date,
    status: f.fixture.status.short,
    elapsed: f.fixture.status.elapsed,
    competition: f.league.name,
    round: f.league.round || '',
    home: shortName(f.teams.home.name),
    homeId: f.teams.home.id,
    away: shortName(f.teams.away.name),
    awayId: f.teams.away.id,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away
  };
}

function isFinished(status) {
  return ['FT', 'AET', 'PEN', 'WO', 'AWD'].indexOf(status) !== -1;
}

function shortName(name) {
  if (!name) return '';
  var map = {
    'River Plate': 'River', 'CA River Plate': 'River',
    'Boca Juniors': 'Boca', 'CA Boca Juniors': 'Boca',
    'Racing Club': 'Racing',
    'FC Barcelona': 'Barcelona', 'Real Madrid': 'R. Madrid',
    'Atletico Madrid': 'Atl. Madrid', 'Club Atletico de Madrid': 'Atl. Madrid',
    'Manchester United': 'Man Utd', 'Manchester City': 'Man City',
    'Inter Miami CF': 'Inter Miami', 'Inter Miami': 'Inter Miami',
    'FC Internazionale Milano': 'Inter', 'Inter Milan': 'Inter', 'Internazionale': 'Inter',
    'Paris Saint Germain': 'PSG', 'Paris Saint-Germain': 'PSG',
    'Borussia Dortmund': 'Dortmund',
    'Bayern Munich': 'Bayern', 'FC Bayern Munchen': 'Bayern',
    'AC Milan': 'Milan', 'SSC Napoli': 'Napoli',
    'Tottenham Hotspur': 'Tottenham',
    'Wolverhampton Wanderers': 'Wolves',
    'Brighton and Hove Albion': 'Brighton',
    'Crystal Palace': 'C. Palace',
    'Nottingham Forest': 'Nott. Forest',
    'West Ham United': 'West Ham',
    'Newcastle United': 'Newcastle',
    'Olympique Marseille': 'Marseille', 'Olympique de Marseille': 'Marseille',
    'Olympique Lyonnais': 'Lyon', 'Olympique Lyon': 'Lyon',
    'AS Monaco': 'Monaco', 'Stade Rennais': 'Rennes',
    'LOSC Lille': 'Lille', 'RC Lens': 'Lens',
    'OGC Nice': 'Nice', 'RC Strasbourg': 'Strasbourg',
    'Stade Brestois 29': 'Brest',
    'Deportivo Guadalajara': 'Chivas', 'Club America': 'America',
    'CF Monterrey': 'Monterrey', 'Cruz Azul': 'Cruz Azul',
    'Tigres UANL': 'Tigres', 'Club Universidad Nacional': 'Pumas',
    'Santos Laguna': 'Santos', 'Toluca': 'Toluca',
    'LA Galaxy': 'LA Galaxy', 'LAFC': 'LAFC',
    'New York Red Bulls': 'NY Red Bulls', 'New York City FC': 'NYCFC',
    'Atlanta United FC': 'Atlanta Utd', 'Seattle Sounders': 'Seattle',
    'Columbus Crew': 'Columbus', 'CF Montreal': 'Montreal',
    'Philadelphia Union': 'Philadelphia', 'Orlando City SC': 'Orlando City',
    'Nashville SC': 'Nashville', 'FC Cincinnati': 'Cincinnati',
    'Charlotte FC': 'Charlotte', 'Chicago Fire FC': 'Chicago Fire',
    'Austin FC': 'Austin FC', 'St. Louis City SC': 'St. Louis',
    'Real Salt Lake': 'RSL', 'Sporting Kansas City': 'Sp. Kansas',
    'Houston Dynamo FC': 'Houston', 'Portland Timbers': 'Portland',
    'Minnesota United FC': 'Minnesota', 'FC Dallas': 'FC Dallas',
    'Colorado Rapids': 'Colorado', 'Vancouver Whitecaps': 'Vancouver',
    'San Jose Earthquakes': 'San Jose', 'D.C. United': 'DC United',
    'Toronto FC': 'Toronto FC', 'New England Revolution': 'New England'
  };

  if (map[name]) return map[name];

  var clean = name
    .replace(/^FC /, '')
    .replace(/^CF /, '')
    .replace(/^CA /, '')
    .replace(/^CD /, '')
    .replace(/^RC /, '')
    .replace(/^Real /, 'R. ')
    .replace(/^Atletico /, 'Atl. ');

  if (clean.length > 14) {
    clean = clean.substring(0, 13) + '.';
  }

  return clean;
}

function formatDate(d) {
  var y = d.getFullYear();
  var m = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return y + '-' + m + '-' + day;
}

// Warren Engine - API-Football Integration
// Gère toutes les interactions avec API-Football

const API_BASE = 'https://v3.football.api-sports.io';

class ApiFootballService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async request(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'x-apisports-key': this.apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.response;
  }

  async findTeamId(teamName) {
    const teams = await this.request(`/teams?name=${encodeURIComponent(teamName)}`);
    
    if (!teams || teams.length === 0) {
      throw new Error(`Équipe "${teamName}" non trouvée`);
    }
    
    return {
      id: teams[0].team.id,
      name: teams[0].team.name
    };
  }

  async getLastMatches(teamId, count = 7) {
    const fixtures = await this.request(`/fixtures?team=${teamId}&last=${count}`);
    return fixtures || [];
  }

  async getMatchEvents(fixtureId) {
    const events = await this.request(`/fixtures/events?fixture=${fixtureId}`);
    return events || [];
  }

  async getTeamData(teamName) {
  console.log('[API] getTeamData START:', teamName);
  
  // 1. Trouver l'ID de l'équipe
  const team = await this.findTeamId(teamName);
  console.log('[API] Team found:', team.id, team.name);
  
  // 2. Récupérer les 7 derniers matchs
  console.log('[API] Fetching last 7 matches for team ID:', team.id);
  const fixtures = await this.getLastMatches(team.id, 7);
  console.log('[API] Fixtures received:', fixtures.length);
  
  // 3. Pour chaque match, récupérer les événements
  console.log('[API] Fetching events for each match...');
  const matchesWithEvents = await Promise.all(
    
      fixtures.map(async (fixture) => {
        const events = await this.getMatchEvents(fixture.fixture.id);
        
        const isHome = fixture.teams.home.id === team.id;
        const opponent = isHome ? fixture.teams.away.name : fixture.teams.home.name;
        const opponentId = isHome ? fixture.teams.away.id : fixture.teams.home.id;
        
        return {
          date: fixture.fixture.date,
          location: isHome ? 'Domicile' : 'Extérieur',
          opponent: opponent,
          opponentId: opponentId,
          score: {
            team: isHome ? fixture.goals.home : fixture.goals.away,
            opponent: isHome ? fixture.goals.away : fixture.goals.home
          },
          result: this.getResult(fixture, isHome),
          events: this.parseEvents(events, team.name, opponent)
        };
      })
    );
    
    return {
      teamId: team.id,
      teamName: team.name,
      matches: matchesWithEvents
    };
  }

  getResult(fixture, isHome) {
    const teamGoals = isHome ? fixture.goals.home : fixture.goals.away;
    const oppGoals = isHome ? fixture.goals.away : fixture.goals.home;
    
    if (teamGoals > oppGoals) return 'victoire';
    if (teamGoals < oppGoals) return 'defaite';
    return 'nul';
  }

  parseEvents(events, teamName, opponentName) {
    const parsed = {
      redCards: [],
      penalties: [],
      goals90Plus: [],
      allGoals: []
    };
    
    events.forEach(event => {
      // Cartons rouges
      if (event.type === 'Card' && event.detail === 'Red Card') {
        parsed.redCards.push({
          team: event.team.name,
          isTeam: event.team.name === teamName,
          minute: event.time.elapsed,
          player: event.player?.name
        });
      }
      
      // Penalties
      if (event.type === 'Goal' && event.detail && event.detail.includes('Penalty')) {
        parsed.penalties.push({
          team: event.team.name,
          isTeam: event.team.name === teamName,
          minute: event.time.elapsed,
          player: event.player?.name
        });
      }
      
      // Buts 90'+
      if (event.type === 'Goal' && event.time.elapsed >= 90) {
        parsed.goals90Plus.push({
          team: event.team.name,
          isTeam: event.team.name === teamName,
          minute: event.time.elapsed,
          detail: event.detail
        });
      }
      
      // Tous les buts
      if (event.type === 'Goal') {
        parsed.allGoals.push({
          team: event.team.name,
          isTeam: event.team.name === teamName,
          minute: event.time.elapsed,
          detail: event.detail
        });
      }
    });
    
    return parsed;
  }
}

export default ApiFootballService;

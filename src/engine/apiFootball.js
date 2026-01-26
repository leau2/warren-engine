// Warren Engine - API-Football Integration
// Gère toutes les interactions avec API-Football

const API_BASE = 'https://v3.football.api-sports.io';

class ApiFootballService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }
  
  async request(endpoint, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[API] Request ${endpoint} (attempt ${attempt}/${retries})`);
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
          headers: {
            'x-apisports-key': this.apiKey
          }
        });
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`[API] Success: ${endpoint} → ${data.response?.length || 0} items`);
        return data.response;
        
      } catch (error) {
        console.error(`[API] Attempt ${attempt}/${retries} failed:`, error.message);
        
        if (attempt === retries) {
          throw error;
        }
        
        // Attendre 1 seconde avant de réessayer
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
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

  async getLastMatches(teamId, count = 7, beforeDate = null) {
    if (beforeDate) {
      // Calculer fenêtre de 180 jours AVANT la date cible
      const targetDate = new Date(beforeDate);
      const fromDate = new Date(targetDate);
      fromDate.setDate(targetDate.getDate() - 180);
      
      const toDateStr = targetDate.toISOString().split('T')[0];
      const fromDateStr = fromDate.toISOString().split('T')[0];
      
      // Déterminer la saison (année de la date cible)
      const season = targetDate.getFullYear();
      
      console.log(`[API] Fetching matches from ${fromDateStr} to ${toDateStr} for team ${teamId} (season ${season})`);
      
      const fixtures = await this.request(`/fixtures?team=${teamId}&season=${season}&from=${fromDateStr}&to=${toDateStr}`);
      
      if (!fixtures || fixtures.length === 0) {
        console.warn('[API] No fixtures found in date range');
        return [];
      }
      
      // Trier par date décroissante (plus récent d'abord)
      const sorted = fixtures.sort((a, b) => {
        return new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime();
      });
      
      console.log(`[API] Found ${sorted.length} matches, taking first ${count}`);
      
      // Prendre les N plus récents
      return sorted.slice(0, count);
    } else {
      // Mode normal : derniers matchs
      const fixtures = await this.request(`/fixtures?team=${teamId}&last=${count}`);
      return fixtures || [];
    }
  }

  async getMatchEvents(fixtureId) {
    try {
      const events = await this.request(`/fixtures/events?fixture=${fixtureId}`);
      
      if (!events || events.length === 0) {
        console.warn(`[API] No events for fixture ${fixtureId}`);
      } else {
        console.log(`[API] Fixture ${fixtureId}: ${events.length} events`);
      }
      
      return events || [];
    } catch (error) {
      console.error(`[API] Failed to get events for fixture ${fixtureId}:`, error.message);
      return [];
    }
  }

  async getTeamData(teamName, matchDate = null) {
    console.log('[API] getTeamData START:', teamName, 'matchDate:', matchDate);
    
    // 1. Trouver l'ID de l'équipe
    const team = await this.findTeamId(teamName);
    console.log('[API] Team found:', team.id, team.name);
    
    // 2. Récupérer les 7 derniers matchs (avec filtre date si fourni)
    console.log('[API] Fetching last 7 matches for team ID:', team.id);
    const fixtures = await this.getLastMatches(team.id, 7, matchDate);
    console.log('[API] Fixtures received:', fixtures.length);
    
    // 3. Pour chaque match, récupérer les événements
    console.log('[API] Fetching events for each match...');
    const matchesWithEvents = await Promise.all(
      fixtures.map(async (fixture) => {
        let events = [];
        try {
          events = await this.getMatchEvents(fixture.fixture.id);
        } catch (error) {
          console.error(`[API] Failed events for fixture ${fixture.fixture.id}, using empty`);
          events = [];
        }
        
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
    
    console.log('[API] getTeamData COMPLETE:', teamName);
    
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
      allGoals: [],
      disallowedGoals: []
    };
    
    if (!events || events.length === 0) {
      return parsed;
    }
    
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
      
      // BUTS REFUSÉS (VAR / Hors-jeu)
      if (event.type === 'VAR' && event.detail && 
          (event.detail.includes('Goal cancelled') || 
           event.detail.includes('Goal disallowed'))) {
        parsed.disallowedGoals.push({
          team: event.team.name,
          isTeam: event.team.name === teamName,
          minute: event.time.elapsed,
          reason: event.detail,
          player: event.player?.name
        });
      }
    });
    
    return parsed;
  }
}

export default ApiFootballService;

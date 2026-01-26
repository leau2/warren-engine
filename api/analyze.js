export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Allow GET for testing
  if (req.method === 'GET') {
    return res.status(200).json({ 
      status: 'API Warren Engine OK',
      version: '2.0.0-h2h',
      endpoints: { analyze: 'POST /api/analyze' },
      features: ['H2H automatic when fuzzy']
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { match, matchDate } = req.body;
    
    // Clé API depuis variable d'environnement Vercel
    const apiKey = process.env.API_FOOTBALL_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'API_FOOTBALL_KEY non configurée sur Vercel' 
      });
    }
    
    console.log('Received:', { match, matchDate });
    
    if (!match) {
      return res.status(400).json({ 
        error: 'Match requis',
        format: 'Équipe1 vs Équipe2'
      });
    }
    
    // Parse match
    const teams = match.split(/\s+vs\s+|\s+-\s+/i);
    if (teams.length !== 2) {
      return res.status(400).json({ 
        error: 'Format invalide. Utilisez "Équipe1 vs Équipe2"' 
      });
    }
    
    // Import dynamique
    const { default: normalizeTeamName } = await import('../src/engine/teamNames.js');
    const { default: ApiFootballService } = await import('../src/engine/apiFootball.js');
    const { default: WarrenAnalyzer } = await import('../src/engine/analyzer.js');
    
    // Normaliser les noms d'équipes
    const [team1Name, team2Name] = teams.map(t => normalizeTeamName(t));
    
    console.log('Teams normalized:', team1Name, 'vs', team2Name);
    
    // Fetch data
    const apiService = new ApiFootballService(apiKey);
    
    console.log('Fetching team data...');
    const [team1Data, team2Data] = await Promise.all([
      apiService.getTeamData(team1Name, matchDate).catch(err => {
        console.error('Error team1:', err.message);
        return { teamName: team1Name, teamId: 0, matches: [] };
      }),
      apiService.getTeamData(team2Name, matchDate).catch(err => {
        console.error('Error team2:', err.message);
        return { teamName: team2Name, teamId: 0, matches: [] };
      })
    ]);
    
    console.log('Data fetched:', {
      team1: team1Data.teamName,
      team1Matches: team1Data.matches?.length || 0,
      team2: team2Data.teamName,
      team2Matches: team2Data.matches?.length || 0
    });
    
    // Analyze
    const analyzer = new WarrenAnalyzer();
    let analysis = analyzer.analyze(team1Data, team2Data);
    
    console.log('Analysis complete');
    
    // ============================================================================
    // NOUVELLE LOGIQUE H2H : Si match FLOU, récupérer H2H automatiquement
    // ============================================================================
    
    // Vérifier si le match est flou (score qualité proche)
    const isFuzzy = checkIfFuzzy(analysis);
    
    if (isFuzzy && team1Data.teamId && team2Data.teamId) {
      console.log('⚠️ Match FLOU détecté, récupération H2H...');
      
      try {
        // Récupérer H2H depuis API-Football
        const h2hData = await fetchH2H(apiKey, team1Data.teamId, team2Data.teamId);
        
        if (h2hData && h2hData.length > 0) {
          console.log(`✅ H2H récupéré: ${h2hData.length} matchs`);
          
          // Analyser H2H
          const h2hAnalysis = analyzeH2H(h2hData, team1Name, team2Name);
          
          // Ajuster le verdict avec H2H
          analysis.verdict = adjustVerdictWithH2H(
            analysis.verdict, 
            h2hAnalysis, 
            team1Name, 
            team2Name,
            analysis.stats
          );
          
          // Ajouter info H2H dans la réponse
          analysis.h2h = h2hAnalysis;
          analysis.fuzzyResolved = true;
        } else {
          console.log('⚠️ Pas de données H2H disponibles');
          analysis.h2h = { available: false };
        }
      } catch (h2hError) {
        console.error('Erreur H2H:', h2hError.message);
        analysis.h2h = { error: h2hError.message };
      }
    }
    
    return res.status(200).json({
      success: true,
      data: analysis,
      meta: {
        team1Matches: team1Data.matches?.length || 0,
        team2Matches: team2Data.matches?.length || 0,
        matchDate: matchDate || 'current',
        fuzzy: isFuzzy,
        h2hUsed: isFuzzy && analysis.h2h?.available !== false,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ============================================================================
// FONCTIONS H2H
// ============================================================================

/**
 * Vérifier si le match est flou (écart de qualité < 2)
 */
function checkIfFuzzy(analysis) {
  const team1 = analysis.team1;
  const team2 = analysis.team2;
  
  // Compter bonnes performances
  const team1GoodPerfs = team1.matches?.filter(m => 
    m.performance?.stars?.includes('⭐⭐⭐') || m.performance?.stars?.includes('⭐⭐')
  ).length || 0;
  
  const team2GoodPerfs = team2.matches?.filter(m => 
    m.performance?.stars?.includes('⭐⭐⭐') || m.performance?.stars?.includes('⭐⭐')
  ).length || 0;
  
  // Compter mauvaises performances
  const team1BadPerfs = team1.matches?.filter(m => 
    m.performance?.stars?.includes('☆☆☆')
  ).length || 0;
  
  const team2BadPerfs = team2.matches?.filter(m => 
    m.performance?.stars?.includes('☆☆☆')
  ).length || 0;
  
  // Score de qualité
  const team1QualityScore = team1GoodPerfs - team1BadPerfs + (team1.record?.total?.v || 0);
  const team2QualityScore = team2GoodPerfs - team2BadPerfs + (team2.record?.total?.v || 0);
  
  // Si écart < 2 → FLOU
  return Math.abs(team1QualityScore - team2QualityScore) < 2;
}

/**
 * Récupérer H2H depuis API-Football (3 dernières années)
 */
async function fetchH2H(apiKey, team1Id, team2Id) {
  // Calculer date de début (3 ans en arrière)
  const today = new Date();
  const threeYearsAgo = new Date(today);
  threeYearsAgo.setFullYear(today.getFullYear() - 3);
  
  const fromDate = threeYearsAgo.toISOString().split('T')[0]; // Format YYYY-MM-DD
  const toDate = today.toISOString().split('T')[0];
  
  const url = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${team1Id}-${team2Id}&from=${fromDate}&to=${toDate}`;
  
  const response = await fetch(url, {
    headers: { 'x-apisports-key': apiKey }
  });
  
  if (!response.ok) {
    throw new Error(`API-Football H2H error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.response || [];
}

/**
 * Analyser les résultats H2H
 */
function analyzeH2H(h2hMatches, team1Name, team2Name) {
  let team1Wins = 0, team2Wins = 0, draws = 0;
  let team1GoalsScored = 0, team2GoalsScored = 0;
  
  h2hMatches.forEach(match => {
    const team1IsHome = match.teams.home.name.toLowerCase().includes(team1Name.toLowerCase()) ||
                        team1Name.toLowerCase().includes(match.teams.home.name.toLowerCase());
    
    const homeGoals = match.goals.home || 0;
    const awayGoals = match.goals.away || 0;
    
    if (team1IsHome) {
      team1GoalsScored += homeGoals;
      team2GoalsScored += awayGoals;
      
      if (homeGoals > awayGoals) team1Wins++;
      else if (homeGoals < awayGoals) team2Wins++;
      else draws++;
    } else {
      team1GoalsScored += awayGoals;
      team2GoalsScored += homeGoals;
      
      if (awayGoals > homeGoals) team1Wins++;
      else if (awayGoals < homeGoals) team2Wins++;
      else draws++;
    }
  });
  
  return { 
    team1Wins, 
    team2Wins, 
    draws, 
    total: h2hMatches.length,
    team1GoalsScored,
    team2GoalsScored,
    available: true
  };
}

/**
 * Ajuster le verdict avec les données H2H
 */
function adjustVerdictWithH2H(verdict, h2h, team1Name, team2Name, stats) {
  // Calculer le % de victoires
  const team1WinRate = h2h.team1Wins / h2h.total;
  const team2WinRate = h2h.team2Wins / h2h.total;
  
  const bttsYes = stats.btts.tendency === 'Oui';
  const overYes = stats.over25.tendency === 'Over 2.5';
  
  // Team1 domine en H2H (>60% de victoires OU 3+ victoires d'écart)
  if (team1WinRate >= 0.6 || (h2h.team1Wins - h2h.team2Wins >= 3)) {
    verdict['1x2'] = '1X';
    verdict.confidence_1x2 = 7;
    
    if (bttsYes && overYes) verdict.score_attendu = '2-1';
    else if (bttsYes && !overYes) verdict.score_attendu = '1-1';
    else verdict.score_attendu = '1-0';
    
    verdict.raisons = [
      `${team1Name} domine en H2H (${h2h.team1Wins}W-${h2h.team2Wins}L sur ${h2h.total} sur 3 ans)`,
      `Taux de victoire: ${(team1WinRate * 100).toFixed(0)}%`,
      `Moyenne buts: ${(h2h.team1GoalsScored / h2h.total).toFixed(1)} - ${(h2h.team2GoalsScored / h2h.total).toFixed(1)}`,
      'Avantage psychologique fort'
    ];
  }
  // Team2 domine en H2H
  else if (team2WinRate >= 0.6 || (h2h.team2Wins - h2h.team1Wins >= 3)) {
    verdict['1x2'] = 'X2';
    verdict.confidence_1x2 = 7;
    
    if (bttsYes && overYes) verdict.score_attendu = '1-2';
    else if (bttsYes && !overYes) verdict.score_attendu = '1-1';
    else verdict.score_attendu = '0-1';
    
    verdict.raisons = [
      `${team2Name} domine en H2H (${h2h.team2Wins}W-${h2h.team1Wins}L sur ${h2h.total} sur 3 ans)`,
      `Taux de victoire: ${(team2WinRate * 100).toFixed(0)}%`,
      `Moyenne buts: ${(h2h.team2GoalsScored / h2h.total).toFixed(1)} - ${(h2h.team1GoalsScored / h2h.total).toFixed(1)}`,
      'Avantage psychologique fort'
    ];
  }
  // Team1 léger avantage (50-60% victoires)
  else if (team1WinRate >= 0.5 && team1WinRate < 0.6) {
    verdict['1x2'] = '1X';
    verdict.confidence_1x2 = 6;
    verdict.raisons = [
      `${team1Name} légèrement meilleur en H2H (${h2h.team1Wins}W-${h2h.team2Wins}L sur ${h2h.total})`,
      `Historique favorable mais pas décisif`,
      'Sécurité avec double chance'
    ];
  }
  // Team2 léger avantage
  else if (team2WinRate >= 0.5 && team2WinRate < 0.6) {
    verdict['1x2'] = 'X2';
    verdict.confidence_1x2 = 6;
    verdict.raisons = [
      `${team2Name} légèrement meilleur en H2H (${h2h.team2Wins}W-${h2h.team1Wins}L sur ${h2h.total})`,
      `Historique favorable mais pas décisif`,
      'Sécurité avec double chance'
    ];
  }
  // H2H vraiment équilibré (<50% chacun = beaucoup de nuls)
  else {
    verdict.raisons = [
      `H2H équilibré sur 3 ans (${h2h.team1Wins}W-${h2h.draws}N-${h2h.team2Wins}L)`,
      `${h2h.total} confrontations, aucune domination claire`,
      'Historique ne tranche pas'
    ];
  }
  
  return verdict;
}

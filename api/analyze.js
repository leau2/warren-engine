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
      version: '1.0.0',
      endpoints: { analyze: 'POST /api/analyze' }
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
    const analysis = analyzer.analyze(team1Data, team2Data);
    
    console.log('Analysis complete');
    
    return res.status(200).json({
      success: true,
      data: analysis,
      meta: {
        team1Matches: team1Data.matches?.length || 0,
        team2Matches: team2Data.matches?.length || 0,
        matchDate: matchDate || 'current',
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('ERROR:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// Vercel Serverless Function - Warren API Endpoint
import ApiFootballService from '../src/engine/apiFootball.js';
import WarrenAnalyzer from '../src/engine/analyzer.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { match, eloData, apiKey } = req.body;
    
    if (!match || !eloData || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: match, eloData, apiKey' 
      });
    }
    
    // Parse le match (ex: "Angers vs Marseille")
    const teams = match.split(/\s+vs\s+|\s+-\s+/i);
    
    if (teams.length !== 2) {
      return res.status(400).json({ 
        error: 'Format match invalide. Utilisez "Équipe1 vs Équipe2"' 
      });
    }
    
    const [team1Name, team2Name] = teams.map(t => t.trim());
    
    console.log(`Analysing: ${team1Name} vs ${team2Name}`);
    
    // Initialiser API Football
    const apiService = new ApiFootballService(apiKey);
    
    // Récupérer données des deux équipes en parallèle
    const [team1Data, team2Data] = await Promise.all([
      apiService.getTeamData(team1Name),
      apiService.getTeamData(team2Name)
    ]);
    
    console.log(`Data fetched for both teams`);
    
    // Analyser avec Warren Engine
    const analyzer = new WarrenAnalyzer();
    const analysis = analyzer.analyze(team1Data, team2Data, eloData);
    
    console.log(`Analysis complete`);
    
    return res.status(200).json({
      success: true,
      data: analysis,
      meta: {
        match: match,
        timestamp: new Date().toISOString(),
        apiRequestsUsed: 28 // Approximatif: 2 teams + 7 matches x 2 + 14 events
      }
    });
    
  } catch (error) {
    console.error('Warren Engine Error:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

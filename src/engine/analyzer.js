// Warren Engine - Main Analyzer
// Coordonne toute l'analyse et applique la logique Warren

import EloEngine from './eloEngine.js';
import BiasDetector from './biasDetector.js';
import eloData from './elo.json' assert { type: 'json' };

class WarrenAnalyzer {
  constructor() {
    this.eloEngine = new EloEngine();
    this.biasDetector = new BiasDetector();
  }

  analyze(team1Data, team2Data) {
    // Analyser chaque équipe
    const team1Analysis = this.analyzeTeam(team1Data);
    const team2Analysis = this.analyzeTeam(team2Data);
    
    // Stats BTTS/Over
    const stats = this.calculateStats(team1Analysis, team2Analysis);
    
    // Générer verdict
    const verdict = this.generateVerdict(team1Analysis, team2Analysis, stats);
    
    return {
      team1: team1Analysis,
      team2: team2Analysis,
      stats: stats,
      verdict: verdict,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
  }

  analyzeTeam(teamData) {
    const teamElo = this.findElo(teamData.teamName);
    const matches = [];
    
    let victories = 0;
    let draws = 0;
    let defeats = 0;
    let homeRecord = { v: 0, d: 0, n: 0 };
    let awayRecord = { v: 0, d: 0, n: 0 };
    
    // Analyser chaque match
    teamData.matches.forEach(match => {
      const opponentElo = this.findElo(match.opponent);
      const eloGap = this.eloEngine.calculateGap(teamElo, opponentElo);
      
      // Détecter biais
      const penaltyBias = match.events.penalties.length > 0 
        ? this.biasDetector.analyzePenalty(match, match.events.penalties[0])
        : null;
      
      const redCardBias = match.events.redCards.length > 0
        ? this.biasDetector.analyzeRedCard(match, match.events.redCards[0])
        : null;
      
      const goal90Bias = match.events.goals90Plus.length > 0
        ? this.biasDetector.analyzeGoal90Plus(match, match.events.goals90Plus[0], eloGap)
        : null;
      
      // Qualifier performance
      const performance = this.eloEngine.qualifyPerformance(
        match.result,
        teamElo,
        opponentElo,
        match.score.team,
        match.score.opponent
      );
      
      const opponentRating = this.eloEngine.qualifyTeam(opponentElo);
      
      matches.push({
        date: match.date,
        location: match.location,
        opponent: match.opponent,
        opponentElo: opponentElo,
        opponentRating: opponentRating,
        eloGap: eloGap,
        score: match.score,
        result: match.result,
        performance: performance,
        biases: {
          penalty: penaltyBias,
          redCard: redCardBias,
          goal90: goal90Bias
        },
        events: match.events
      });
      
      // Compter résultats
      if (match.result === 'victoire') victories++;
      if (match.result === 'nul') draws++;
      if (match.result === 'defaite') defeats++;
      
      if (match.location === 'Domicile') {
        if (match.result === 'victoire') homeRecord.v++;
        if (match.result === 'nul') homeRecord.n++;
        if (match.result === 'defaite') homeRecord.d++;
      } else {
        if (match.result === 'victoire') awayRecord.v++;
        if (match.result === 'nul') awayRecord.n++;
        if (match.result === 'defaite') awayRecord.d++;
      }
    });
    
    // Détecter fatigue
    const fatigue = this.biasDetector.detectFatigue(teamData.matches);
    
    return {
      teamName: teamData.teamName,
      elo: teamElo,
      rating: this.eloEngine.qualifyTeam(teamElo),
      record: {
        total: { v: victories, n: draws, d: defeats },
        home: homeRecord,
        away: awayRecord
      },
      matches: matches,
      fatigue: fatigue,
      formeSummary: this.summarizeForm(matches, fatigue)
    };
  }

  summarizeForm(matches, fatigue) {
    const recentMatches = matches.slice(0, 5);
    const goodPerformances = recentMatches.filter(m => 
      m.performance.stars.includes('⭐⭐⭐') || m.performance.stars.includes('⭐⭐')
    ).length;
    
    const biasedResults = recentMatches.filter(m =>
      m.biases.penalty?.severity.includes('NEGATIF') ||
      m.biases.redCard?.severity.includes('NEGATIF')
    ).length;
    
    let formQuality = 'Moyenne';
    if (goodPerformances >= 3) formQuality = 'Bonne';
    if (goodPerformances >= 4) formQuality = 'Excellente';
    if (goodPerformances <= 1) formQuality = 'Faible';
    
    return {
      quality: formQuality,
      biasCount: biasedResults,
      fatigue: fatigue ? 'Oui' : 'Non',
      note: fatigue ? 'Performance réduite attendue' : ''
    };
  }

  calculateStats(team1, team2) {
    // Over 2.5
    const team1Over = team1.matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
    const team2Over = team2.matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
    // BTTS
    const team1Btts = team1.matches.filter(m => 
      m.score.team > 0 && m.score.opponent > 0
    ).length;
    
    const team2Btts = team2.matches.filter(m => 
      m.score.team > 0 && m.score.opponent > 0
    ).length;
    
    return {
      over25: {
        team1: { count: team1Over, total: team1.matches.length, percentage: Math.round(team1Over / team1.matches.length * 100) },
        team2: { count: team2Over, total: team2.matches.length, percentage: Math.round(team2Over / team2.matches.length * 100) },
        tendency: (team1Over + team2Over) >= 8 ? 'Over 2.5' : 'Under 2.5'
      },
      btts: {
        team1: { count: team1Btts, total: team1.matches.length, percentage: Math.round(team1Btts / team1.matches.length * 100) },
        team2: { count: team2Btts, total: team2.matches.length, percentage: Math.round(team2Btts / team2.matches.length * 100) },
        tendency: (team1Btts + team2Btts) >= 8 ? 'Oui' : 'Non'
      }
    };
  }

  generateVerdict(team1, team2, stats) {
    const eloGap = this.eloEngine.calculateGap(team1.elo, team2.elo);
    const isFavorite = team1.elo > team2.elo;
    const favorite = isFavorite ? team1 : team2;
    const outsider = isFavorite ? team2 : team1;
    
    // Règle fatigue
    if (favorite.fatigue && !outsider.fatigue) {
      return {
        '1x2': eloGap > 200 ? (isFavorite ? '1X' : 'X2') : 'X',
        confidence_1x2: 7,
        btts: stats.btts.tendency,
        confidence_btts: (stats.btts.team1.percentage + stats.btts.team2.percentage) / 20,
        over: stats.over25.tendency,
        confidence_over: (stats.over25.team1.percentage + stats.over25.team2.percentage) / 20,
        score_attendu: '1-1',
        scores_alternatifs: ['2-1', '1-2', '0-0'],
        raisons: [
          `${favorite.teamName} fatigué (${favorite.fatigue.matchCount} matchs en ${favorite.fatigue.period})`,
          `${outsider.teamName} frais, peut résister`,
          `Tendance ${stats.over25.tendency} (${stats.over25.team1.percentage}% / ${stats.over25.team2.percentage}%)`
        ],
        risques: [
          `${favorite.teamName} reste supérieur (+${eloGap} ELO)`,
          `${outsider.teamName} peut s'effondrer si ${favorite.teamName} attaque`
        ]
      };
    }
    
    // Logique normale
    let prono1x2 = 'X';
    let confidence = 6;
    
    if (eloGap > 250) {
      prono1x2 = isFavorite ? '1' : '2';
      confidence = 8;
    } else if (eloGap > 150) {
      prono1x2 = isFavorite ? '1X' : 'X2';
      confidence = 7;
    }
    
    return {
      '1x2': prono1x2,
      confidence_1x2: confidence,
      btts: stats.btts.tendency,
      confidence_btts: Math.min(9, Math.round((stats.btts.team1.percentage + stats.btts.team2.percentage) / 20)),
      over: stats.over25.tendency,
      confidence_over: Math.min(9, Math.round((stats.over25.team1.percentage + stats.over25.team2.percentage) / 20)),
      score_attendu: this.estimateScore(team1, team2, stats),
      scores_alternatifs: this.alternativeScores(team1, team2),
      raisons: this.generateReasons(team1, team2, stats, eloGap),
      risques: this.generateRisks(team1, team2, eloGap)
    };
  }

  estimateScore(team1, team2, stats) {
    const avgGoals1 = team1.matches.reduce((sum, m) => sum + m.score.team, 0) / team1.matches.length;
    const avgGoals2 = team2.matches.reduce((sum, m) => sum + m.score.team, 0) / team2.matches.length;
    
    return `${Math.round(avgGoals1)}-${Math.round(avgGoals2)}`;
  }

  alternativeScores(team1, team2) {
    return ['1-1', '2-1', '1-2', '2-2'].slice(0, 3);
  }

  generateReasons(team1, team2, stats, eloGap) {
    const reasons = [];
    
    if (team1.fatigue) reasons.push(`${team1.teamName} fatigué`);
    if (team2.fatigue) reasons.push(`${team2.teamName} fatigué`);
    
    if (team1.formeSummary.quality === 'Excellente') {
      reasons.push(`${team1.teamName} en excellente forme`);
    }
    if (team2.formeSummary.quality === 'Excellente') {
      reasons.push(`${team2.teamName} en excellente forme`);
    }
    
    if (stats.over25.tendency === 'Over 2.5') {
      reasons.push(`Tendance Over (${stats.over25.team1.percentage}% / ${stats.over25.team2.percentage}%)`);
    }
    
    if (reasons.length < 3) {
      reasons.push(`Écart ELO ${eloGap} points`);
    }
    
    return reasons.slice(0, 3);
  }

  generateRisks(team1, team2, eloGap) {
    return [
      eloGap > 100 ? `Écart qualité (+${eloGap} ELO)` : 'Équipes de niveau proche',
      'Facteur domicile peut influencer'
    ];
  }

  findElo(teamName) {
    // eloData est déjà importé en haut du fichier
    const normalized = teamName.trim();
    
    // Recherche exacte
    if (eloData[normalized]) {
      return eloData[normalized];
    }
    
    // Recherche insensible à la casse
    for (const [team, elo] of Object.entries(eloData)) {
      if (team.toLowerCase() === normalized.toLowerCase()) {
        return elo;
      }
    }
    
    console.warn(`ELO non trouvé pour ${teamName}, utilise 1700 par défaut`);
    return 1700;
  }
}

export default WarrenAnalyzer;

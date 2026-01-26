// Warren Engine - Main Analyzer
// Coordonne toute l'analyse et applique la logique Warren

import EloEngine from './eloEngine.js';
import BiasDetector from './biasDetector.js';
import eloData from './elo.js';

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
    
    // Générer verdict (avec logique Warren en arrière-plan)
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
      
      // Détecter biais (anciennes méthodes de compatibilité)
      const penaltyBias = match.events.penalties && match.events.penalties.length > 0 
        ? this.biasDetector.analyzePenaltyOld(match, match.events.penalties[0])
        : null;
      
      const redCardBias = match.events.redCards && match.events.redCards.length > 0
        ? this.biasDetector.analyzeRedCardOld(match, match.events.redCards[0])
        : null;
      
      const goal90Bias = match.events.goals90Plus && match.events.goals90Plus.length > 0
        ? this.biasDetector.analyzeGoal90PlusOld(match, match.events.goals90Plus[0], eloGap)
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
      m.performance?.stars && (m.performance.stars.includes('⭐⭐⭐') || m.performance.stars.includes('⭐⭐'))
    ).length;
    
    const biasedResults = recentMatches.filter(m =>
      m.biases?.penalty?.severity?.includes('NEGATIF') ||
      m.biases?.redCard?.severity?.includes('NEGATIF')
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
    
    // Calculer tendances BTTS/Over
    const team1Btts = team1.matches?.filter(m => m.score?.team > 0 && m.score?.opponent > 0).length || 0;
    const team2Btts = team2.matches?.filter(m => m.score?.team > 0 && m.score?.opponent > 0).length || 0;
    const bttsYes = (team1Btts + team2Btts) >= 8;
    
    const team1Over = team1.matches?.filter(m => (m.score?.team + m.score?.opponent) > 2.5).length || 0;
    const team2Over = team2.matches?.filter(m => (m.score?.team + m.score?.opponent) > 2.5).length || 0;
    const overYes = (team1Over + team2Over) >= 8;
    
    // ANALYSER LA QUALITÉ DES PERFORMANCES (selon ELO adversaires)
    // Compter les bonnes performances (⭐⭐⭐ et ⭐⭐)
    const team1GoodPerfs = team1.matches?.filter(m => 
      m.performance?.stars?.includes('⭐⭐⭐') || m.performance?.stars?.includes('⭐⭐')
    ).length || 0;
    
    const team2GoodPerfs = team2.matches?.filter(m => 
      m.performance?.stars?.includes('⭐⭐⭐') || m.performance?.stars?.includes('⭐⭐')
    ).length || 0;
    
    // Compter les mauvaises performances (☆☆☆)
    const team1BadPerfs = team1.matches?.filter(m => 
      m.performance?.stars?.includes('☆☆☆')
    ).length || 0;
    
    const team2BadPerfs = team2.matches?.filter(m => 
      m.performance?.stars?.includes('☆☆☆')
    ).length || 0;
    
    // Forme brute (W/D/L)
    const team1Wins = team1.record?.total?.v || 0;
    const team2Wins = team2.record?.total?.v || 0;
    const team1Losses = team1.record?.total?.d || 0;
    const team2Losses = team2.record?.total?.d || 0;
    
    // Score de qualité : bonnes perf - mauvaises perf + victoires
    const team1QualityScore = team1GoodPerfs - team1BadPerfs + team1Wins;
    const team2QualityScore = team2GoodPerfs - team2BadPerfs + team2Wins;
    
    let prono1x2 = 'X';
    let confidence = 5;
    let scoreAttendu = '1-1';
    let raisons = [];
    
    // RÈGLE 1 : FATIGUE (toujours prioritaire)
    if (team1.fatigue && !team2.fatigue) {
      prono1x2 = 'X';
      confidence = 6;
      scoreAttendu = bttsYes ? '1-1' : '0-0';
      raisons = [
        `${team1.teamName} fatigué (${team1.fatigue.matchCount} matchs en ${team1.fatigue.period})`,
        `${team2.teamName} frais, avantage physique`,
        `Forme: ${team1Wins}W vs ${team2Wins}W`
      ];
    }
    else if (team2.fatigue && !team1.fatigue) {
      prono1x2 = 'X';
      confidence = 6;
      scoreAttendu = bttsYes ? '1-1' : '0-0';
      raisons = [
        `${team2.teamName} fatigué (${team2.fatigue.matchCount} matchs en ${team2.fatigue.period})`,
        `${team1.teamName} frais, avantage physique`,
        `Forme: ${team1Wins}W vs ${team2Wins}W`
      ];
    }
    // RÈGLE 2 : DIFFÉRENCE DE QUALITÉ FORTE (écart >= 4)
    else if (team1QualityScore - team2QualityScore >= 4) {
      prono1x2 = '1';
      confidence = 7;
      
      if (bttsYes && overYes) scoreAttendu = '3-1';
      else if (bttsYes && !overYes) scoreAttendu = '2-1';
      else if (!bttsYes && overYes) scoreAttendu = '3-0';
      else scoreAttendu = '2-0';
      
      raisons = [
        `${team1.teamName} forme nettement supérieure`,
        `Qualité: ${team1GoodPerfs} bonnes perf vs ${team2BadPerfs} mauvaises perf (adv)`,
        `Bilan: ${team1Wins}W-${team1Losses}L vs ${team2Wins}W-${team2Losses}L`
      ];
    }
    else if (team2QualityScore - team1QualityScore >= 4) {
      prono1x2 = '2';
      confidence = 7;
      
      if (bttsYes && overYes) scoreAttendu = '1-3';
      else if (bttsYes && !overYes) scoreAttendu = '1-2';
      else if (!bttsYes && overYes) scoreAttendu = '0-3';
      else scoreAttendu = '0-2';
      
      raisons = [
        `${team2.teamName} forme nettement supérieure`,
        `Qualité: ${team2GoodPerfs} bonnes perf vs ${team1BadPerfs} mauvaises perf (adv)`,
        `Bilan: ${team2Wins}W-${team2Losses}L vs ${team1Wins}W-${team1Losses}L`
      ];
    }
    // RÈGLE 3 : DIFFÉRENCE MOYENNE (écart 2-3)
    else if (team1QualityScore - team2QualityScore >= 2) {
      prono1x2 = '1X';
      confidence = 6;
      
      if (bttsYes && overYes) scoreAttendu = '2-1';
      else if (bttsYes && !overYes) scoreAttendu = '1-1';
      else scoreAttendu = '1-0';
      
      raisons = [
        `${team1.teamName} légèrement meilleur`,
        `Forme: ${team1Wins}W vs ${team2Wins}W (${team1GoodPerfs} bonnes perf)`,
        `Sécurité avec double chance`
      ];
    }
    else if (team2QualityScore - team1QualityScore >= 2) {
      prono1x2 = 'X2';
      confidence = 6;
      
      if (bttsYes && overYes) scoreAttendu = '1-2';
      else if (bttsYes && !overYes) scoreAttendu = '1-1';
      else scoreAttendu = '0-1';
      
      raisons = [
        `${team2.teamName} légèrement meilleur`,
        `Forme: ${team2Wins}W vs ${team1Wins}W (${team2GoodPerfs} bonnes perf)`,
        `Sécurité avec double chance`
      ];
    }
    // RÈGLE 4 : ÉQUILIBRÉ (écart < 2)
    else {
      prono1x2 = 'X';
      confidence = 5;
      scoreAttendu = bttsYes ? '1-1' : '0-0';
      raisons = [
        `Forme équilibrée (${team1Wins}W vs ${team2Wins}W)`,
        `Qualité similaire (${team1GoodPerfs} vs ${team2GoodPerfs} bonnes perf)`,
        `Match indécis`
      ];
    }
    
    return {
      '1x2': prono1x2,
      confidence_1x2: confidence,
      btts: stats.btts.tendency,
      confidence_btts: Math.min(9, Math.round((stats.btts.team1.percentage + stats.btts.team2.percentage) / 20)),
      over: stats.over25.tendency,
      confidence_over: Math.min(9, Math.round((stats.over25.team1.percentage + stats.over25.team2.percentage) / 20)),
      score_attendu: scoreAttendu,
      scores_alternatifs: this.alternativeScores(team1, team2, prono1x2, bttsYes, overYes),
      raisons: raisons,
      risques: this.generateRisks(team1, team2, eloGap)
    };

  formatEventsForWarren(events) {
    if (!events) return {};
    
    const formatted = {};
    
    if (events.penalties && events.penalties.length > 0) {
      const pen = events.penalties[0];
      formatted.penalty = {
        isTeam: pen.team === 'team' || pen.isTeam === true,
        minute: pen.minute?.toString() || "0"
      };
      formatted.penaltyOnlyGoal = pen.isOnlyGoal || false;
    }
    
    if (events.redCards && events.redCards.length > 0) {
      const red = events.redCards[0];
      formatted.redCard = {
        isTeam: red.team === 'team' || red.isTeam === true,
        minute: parseInt(red.minute) || 0
      };
    }
    
    if (events.goals90Plus && events.goals90Plus.length > 0) {
      const goal90 = events.goals90Plus[0];
      formatted.goal90Plus = {
        isTeam: goal90.team === 'team' || goal90.isTeam === true,
        minute: goal90.minute?.toString() || "90+",
        scoreBefore: goal90.scoreBefore || null
      };
    }
    
    return formatted;
  }

  estimateScore(team1, team2, stats) {
    const avgGoals1 = team1.matches.reduce((sum, m) => sum + m.score.team, 0) / team1.matches.length;
    const avgGoals2 = team2.matches.reduce((sum, m) => sum + m.score.team, 0) / team2.matches.length;
    
    return `${Math.round(avgGoals1)}-${Math.round(avgGoals2)}`;
  }

  alternativeScores(team1, team2, prono1x2, bttsYes, overYes) {
    const eloGap = this.eloEngine.calculateGap(team1.elo, team2.elo);
    const isFavorite = team1.elo > team2.elo;
    
    let alternatives = [];
    
    // Si prono = '1' (Team1 gagne)
    if (prono1x2 === '1') {
      if (bttsYes && overYes) {
        alternatives = ['3-1', '3-2', '4-2'];
      } else if (bttsYes && !overYes) {
        // IMPOSSIBLE de gagner avec BTTS Oui + Under → seul 1-1 existe
        alternatives = ['1-1', '1-0', '2-0']; // Mettre des scores réalistes même si contradiction
      } else if (!bttsYes && overYes) {
        alternatives = ['3-0', '4-0', '5-0'];
      } else {
        alternatives = ['2-0', '1-0', '3-0'];
      }
    }
    // Si prono = '2' (Team2 gagne)
    else if (prono1x2 === '2') {
      if (bttsYes && overYes) {
        alternatives = ['1-3', '2-3', '2-4'];
      } else if (bttsYes && !overYes) {
        // IMPOSSIBLE de gagner avec BTTS Oui + Under → seul 1-1 existe
        alternatives = ['1-1', '0-1', '0-2']; // Mettre des scores réalistes même si contradiction
      } else if (!bttsYes && overYes) {
        alternatives = ['0-3', '0-4', '0-5'];
      } else {
        alternatives = ['0-2', '0-1', '0-3'];
      }
    }
    // Si prono = '1X' (Team1 favori mais peut nul)
    else if (prono1x2 === '1X') {
      if (bttsYes && overYes) {
        alternatives = ['2-1', '1-1', '3-2'];
      } else if (bttsYes && !overYes) {
        // Seul 1-1 est possible avec BTTS Oui + Under
        alternatives = ['1-1', '1-0', '2-1'];
      } else if (!bttsYes && overYes) {
        alternatives = ['3-0', '1-0', '4-0'];
      } else {
        alternatives = ['1-0', '0-0', '2-0'];
      }
    }
    // Si prono = 'X2' (Team2 favori mais peut nul)
    else if (prono1x2 === 'X2') {
      if (bttsYes && overYes) {
        alternatives = ['1-2', '1-1', '2-3'];
      } else if (bttsYes && !overYes) {
        // Seul 1-1 est possible avec BTTS Oui + Under
        alternatives = ['1-1', '0-1', '1-2'];
      } else if (!bttsYes && overYes) {
        alternatives = ['0-3', '0-1', '0-4'];
      } else {
        alternatives = ['0-1', '0-0', '0-2'];
      }
    }
    // Si prono = 'X' (Nul)
    else {
      if (bttsYes && overYes) {
        alternatives = ['2-2', '3-3', '1-1'];
      } else if (bttsYes && !overYes) {
        // Seul 1-1 est possible avec BTTS Oui + Under
        alternatives = ['1-1', '0-0', '2-2'];
      } else if (!bttsYes && overYes) {
        alternatives = ['0-0', '3-3', '2-2'];
      } else {
        alternatives = ['0-0', '1-1', '1-0'];
      }
    }
    
    return alternatives.slice(0, 3);
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

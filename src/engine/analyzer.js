// Warren Engine v2 - Main Analyzer
// Coordonne toute l'analyse avec logique Warren 2.0

import EloEngine from './eloEngine.js';
import BiasDetector from './biasDetector.js';
import eloData from './elo.js';

class WarrenAnalyzer {
  constructor() {
    this.eloEngine = new EloEngine();
    this.biasDetector = new BiasDetector();
  }

  analyze(team1Data, team2Data) {
    // Analyser chaque équipe avec NOUVELLE LOGIQUE
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
        version: '2.0.0'
      }
    };
  }

  analyzeTeam(teamData) {
    const teamElo = this.findElo(teamData.teamName);
    const matches = [];
    
    // Compteurs pour analyse globale
    let scoresForme = [];
    
    // Analyser chaque match avec NOUVELLE LOGIQUE
    teamData.matches.forEach(match => {
      const opponentElo = this.findElo(match.opponent);
      
      // Enrichir les événements du match (gestion sécurisée)
      const enrichedEvents = match.events 
        ? this.biasDetector.enrichMatchEvents(match)
        : {
            redCards: [],
            penalties: [],
            goals90Plus: [],
            goalsAfterRed: 0,
            leadInMatch: false,
            cameBack: false
          };
      
      // NOUVELLE QUALIFICATION avec qualifyMatch()
      const qualification = this.eloEngine.qualifyMatch(
        teamElo,
        opponentElo,
        match.result,
        match.score,
        enrichedEvents
      );
      
      // Ancienne qualification (gardée pour compatibilité affichage)
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
        eloGap: qualification.eloGap,
        score: match.score,
        result: match.result,
        
        // NOUVELLE QUALIFICATION
        qualification: qualification,
        
        // Ancienne perf (compatibilité)
        performance: performance,
        
        events: enrichedEvents
      });
      
      // Collecter scores de forme
      scoresForme.push(this.mapImpactToScore(qualification.impactForme));
    });
    
    // Calculer score de forme global
    const scoreForme = this.calculateFormeScore(scoresForme);
    
    // Détecter fatigue
    const fatigue = this.biasDetector.detectFatigue(teamData.matches);
    
    // Compter résultats bruts (pour stats)
    const record = this.countRecords(matches);
    
    return {
      teamName: teamData.teamName,
      elo: teamElo,
      rating: this.eloEngine.qualifyTeam(teamElo),
      record: record,
      matches: matches,
      fatigue: fatigue,
      scoreForme: scoreForme,
      formeSummary: this.summarizeForm(scoreForme, fatigue)
    };
  }

  mapImpactToScore(impactForme) {
    const mapping = {
      'EXCELLENT': 10,
      'BON': 7,
      'POSITIF': 7,
      'OK': 5,
      'NEUTRE': 4,
      'MOYEN': 3,
      'MAUVAIS': 1,
      'TRÈS MAUVAIS': 0
    };
    
    return mapping[impactForme] || 4;
  }

  calculateFormeScore(scores) {
    if (scores.length === 0) return 5;
    
    const sum = scores.reduce((a, b) => a + b, 0);
    return Math.round((sum / scores.length) * 10) / 10;
  }

  countRecords(matches) {
    let totalV = 0, totalN = 0, totalD = 0;
    let homeV = 0, homeN = 0, homeD = 0;
    let awayV = 0, awayN = 0, awayD = 0;
    
    matches.forEach(m => {
      if (m.result === 'victoire') {
        totalV++;
        if (m.location === 'Domicile') homeV++; else awayV++;
      }
      if (m.result === 'nul') {
        totalN++;
        if (m.location === 'Domicile') homeN++; else awayN++;
      }
      if (m.result === 'defaite') {
        totalD++;
        if (m.location === 'Domicile') homeD++; else awayD++;
      }
    });
    
    return {
      total: { v: totalV, n: totalN, d: totalD },
      home: { v: homeV, n: homeN, d: homeD },
      away: { v: awayV, n: awayN, d: awayD }
    };
  }

  summarizeForm(scoreForme, fatigue) {
    let quality = 'Moyenne';
    
    if (scoreForme >= 7.5) quality = 'Excellente';
    else if (scoreForme >= 6) quality = 'Bonne';
    else if (scoreForme >= 4) quality = 'Moyenne';
    else quality = 'Faible';
    
    return {
      quality: quality,
      score: scoreForme,
      fatigue: fatigue ? 'Oui' : 'Non',
      note: fatigue ? 'Performance réduite attendue' : ''
    };
  }

  calculateStats(team1, team2) {
    const team1Over = team1.matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
    const team2Over = team2.matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
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
    
    const bttsYes = stats.btts.tendency === 'Oui';
    const overYes = stats.over25.tendency === 'Over 2.5';
    
    const formeGap = team1.scoreForme - team2.scoreForme;
    
    let prono1x2 = 'X';
    let confidence = 5;
    let scoreAttendu = '1-1';
    let raisons = [];
    
    // RÈGLE 1 : FATIGUE (toujours prioritaire)
    if (team1.fatigue && !team2.fatigue) {
      prono1x2 = 'X2';
      confidence = 7;
      scoreAttendu = bttsYes ? '1-1' : '0-1';
      raisons = [
        `${team1.teamName} fatigué (${team1.fatigue.matchCount} matchs en ${team1.fatigue.period})`,
        `${team2.teamName} frais, avantage physique décisif`,
        `Forme: ${team1.scoreForme}/10 vs ${team2.scoreForme}/10`
      ];
    }
    else if (team2.fatigue && !team1.fatigue) {
      prono1x2 = '1X';
      confidence = 7;
      scoreAttendu = bttsYes ? '1-1' : '1-0';
      raisons = [
        `${team2.teamName} fatigué (${team2.fatigue.matchCount} matchs en ${team2.fatigue.period})`,
        `${team1.teamName} frais, avantage physique décisif`,
        `Forme: ${team1.scoreForme}/10 vs ${team2.scoreForme}/10`
      ];
    }
    // RÈGLE 2 : ÉCART DE FORME TRÈS IMPORTANT (≥ 3 points)
    else if (formeGap >= 3) {
      prono1x2 = '1';
      confidence = 8;
      
      if (bttsYes && overYes) scoreAttendu = '3-1';
      else if (bttsYes && !overYes) scoreAttendu = '2-1';
      else if (!bttsYes && overYes) scoreAttendu = '3-0';
      else scoreAttendu = '2-0';
      
      raisons = [
        `${team1.teamName} forme nettement supérieure (${team1.scoreForme}/10 vs ${team2.scoreForme}/10)`,
        `Qualité récente démontrée sur 7 matchs`,
        `Écart de ${formeGap.toFixed(1)} points de forme`
      ];
    }
    else if (formeGap <= -3) {
      prono1x2 = '2';
      confidence = 8;
      
      if (bttsYes && overYes) scoreAttendu = '1-3';
      else if (bttsYes && !overYes) scoreAttendu = '1-2';
      else if (!bttsYes && overYes) scoreAttendu = '0-3';
      else scoreAttendu = '0-2';
      
      raisons = [
        `${team2.teamName} forme nettement supérieure (${team2.scoreForme}/10 vs ${team1.scoreForme}/10)`,
        `Qualité récente démontrée sur 7 matchs`,
        `Écart de ${Math.abs(formeGap).toFixed(1)} points de forme`
      ];
    }
    // RÈGLE 3 : ÉCART MOYEN (1.5 - 3 points)
    else if (formeGap >= 1.5) {
      prono1x2 = '1X';
      confidence = 6;
      
      if (bttsYes && overYes) scoreAttendu = '2-1';
      else if (bttsYes && !overYes) scoreAttendu = '1-1';
      else scoreAttendu = '1-0';
      
      raisons = [
        `${team1.teamName} légèrement meilleur (${team1.scoreForme}/10 vs ${team2.scoreForme}/10)`,
        `Avantage modéré, prudence recommandée`,
        `Double chance pour sécurité`
      ];
    }
    else if (formeGap <= -1.5) {
      prono1x2 = 'X2';
      confidence = 6;
      
      if (bttsYes && overYes) scoreAttendu = '1-2';
      else if (bttsYes && !overYes) scoreAttendu = '1-1';
      else scoreAttendu = '0-1';
      
      raisons = [
        `${team2.teamName} légèrement meilleur (${team2.scoreForme}/10 vs ${team1.scoreForme}/10)`,
        `Avantage modéré, prudence recommandée`,
        `Double chance pour sécurité`
      ];
    }
    // RÈGLE 4 : ÉQUILIBRÉ (< 1.5 points)
    else {
      prono1x2 = 'X';
      confidence = 5;
      scoreAttendu = bttsYes ? '1-1' : '0-0';
      raisons = [
        `Forme équilibrée (${team1.scoreForme}/10 vs ${team2.scoreForme}/10)`,
        `Aucune équipe ne se démarque clairement`,
        `Match très indécis`
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
      risques: this.generateRisks(team1, team2, eloGap, formeGap)
    };
  }

  alternativeScores(team1, team2, prono1x2, bttsYes, overYes) {
    let alternatives = [];
    
    if (prono1x2 === '1') {
      if (bttsYes && overYes) alternatives = ['3-1', '3-2', '4-2'];
      else if (bttsYes && !overYes) alternatives = ['2-1', '1-1', '2-0'];
      else if (!bttsYes && overYes) alternatives = ['3-0', '4-0', '5-0'];
      else alternatives = ['2-0', '1-0', '3-0'];
    }
    else if (prono1x2 === '2') {
      if (bttsYes && overYes) alternatives = ['1-3', '2-3', '2-4'];
      else if (bttsYes && !overYes) alternatives = ['1-2', '1-1', '0-2'];
      else if (!bttsYes && overYes) alternatives = ['0-3', '0-4', '0-5'];
      else alternatives = ['0-2', '0-1', '0-3'];
    }
    else if (prono1x2 === '1X') {
      if (bttsYes && overYes) alternatives = ['2-1', '1-1', '3-2'];
      else if (bttsYes && !overYes) alternatives = ['1-1', '1-0', '2-1'];
      else if (!bttsYes && overYes) alternatives = ['3-0', '1-0', '4-0'];
      else alternatives = ['1-0', '0-0', '2-0'];
    }
    else if (prono1x2 === 'X2') {
      if (bttsYes && overYes) alternatives = ['1-2', '1-1', '2-3'];
      else if (bttsYes && !overYes) alternatives = ['1-1', '0-1', '1-2'];
      else if (!bttsYes && overYes) alternatives = ['0-3', '0-1', '0-4'];
      else alternatives = ['0-1', '0-0', '0-2'];
    }
    else {
      if (bttsYes && overYes) alternatives = ['2-2', '3-3', '1-1'];
      else if (bttsYes && !overYes) alternatives = ['1-1', '0-0', '2-2'];
      else if (!bttsYes && overYes) alternatives = ['0-0', '3-3', '2-2'];
      else alternatives = ['0-0', '1-1', '1-0'];
    }
    
    return alternatives.slice(0, 3);
  }

  generateRisks(team1, team2, eloGap, formeGap) {
    const risks = [];
    
    if (Math.abs(formeGap) < 1.5) {
      risks.push('Forme très équilibrée, match incertain');
    }
    
    if (Math.abs(eloGap) > 100) {
      risks.push(`Écart ELO notable (+${Math.abs(eloGap)}) peut peser`);
    }
    
    if (team1.fatigue || team2.fatigue) {
      risks.push('Fatigue peut bouleverser les prévisions');
    }
    
    if (risks.length < 2) {
      risks.push('Facteur domicile peut influencer');
    }
    
    return risks.slice(0, 2);
  }

  findElo(teamName) {
    const normalized = teamName.trim();
    
    if (eloData[normalized]) {
      return eloData[normalized];
    }
    
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

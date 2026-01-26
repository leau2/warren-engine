// Warren Engine - Main Analyzer
// Coordonne toute l'analyse et applique la logique Warren v1

import EloEngine from './eloEngine.js';
import BiasDetector from './biasDetector.js';
import eloData from './elo.js';

class Analyzer {
  constructor() {
    this.eloEngine = new EloEngine();
    this.biasDetector = new BiasDetector();
  }

  /**
   * MÉTHODE PRINCIPALE - Warren v1
   * Analyse un match avec la logique stricte Warren
   */
  analyze(team1Data, team2Data) {
    const team1Elo = this.findElo(team1Data.teamName);
    const team2Elo = this.findElo(team2Data.teamName);
    const eloGap = this.eloEngine.calculateGap(team1Elo, team2Elo);
    
    // Préparer les données au format Warren
    const team1Matches = { 
      matches: team1Data.matches.map(m => ({
        date: m.date,
        score: m.score,
        events: this.formatEventsForWarren(m.events)
      }))
    };
    
    const team2Matches = { 
      matches: team2Data.matches.map(m => ({
        date: m.date,
        score: m.score,
        events: this.formatEventsForWarren(m.events)
      }))
    };
    
    // Analyser avec Warren Engine
    const warrenAnalysis = this.biasDetector.analyze(team1Matches, team2Matches, { eloGap });
    
    // Calculer stats BTTS/Over
    const stats = this.calculateStats(team1Data.matches, team2Data.matches);
    
    // Générer verdict Warren
    const verdict = this.generateVerdict(
      warrenAnalysis, 
      team1Data.teamName, 
      team2Data.teamName, 
      stats, 
      eloGap,
      team1Elo,
      team2Elo
    );
    
    // Calculer record pour compatibilité front-end
    const team1Record = this.calculateRecord(team1Data.matches);
    const team2Record = this.calculateRecord(team2Data.matches);

    return {
      team1: {
        teamName: team1Data.teamName,
        elo: team1Elo,
        rating: this.eloEngine.qualifyTeam(team1Elo),
        record: team1Record, // Pour compatibilité front
        form: warrenAnalysis.team1Form,
        events: warrenAnalysis.team1Events,
        matches: this.enrichMatches(team1Data.matches, team1Elo),
        formeSummary: this.generateFormSummary(warrenAnalysis.team1Form, warrenAnalysis.team1Events)
      },
      team2: {
        teamName: team2Data.teamName,
        elo: team2Elo,
        rating: this.eloEngine.qualifyTeam(team2Elo),
        record: team2Record, // Pour compatibilité front
        form: warrenAnalysis.team2Form,
        events: warrenAnalysis.team2Events,
        matches: this.enrichMatches(team2Data.matches, team2Elo),
        formeSummary: this.generateFormSummary(warrenAnalysis.team2Form, warrenAnalysis.team2Events)
      },
      warren: {
        straightWinAllowed: warrenAnalysis.straightWinAllowed,
        fuzzy: warrenAnalysis.fuzzy,
        decision: warrenAnalysis.decision,
        debug: warrenAnalysis.debug
      },
      stats: stats,
      verdict: verdict,
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0.0-warren',
        engine: 'Warren v1'
      }
    };
  }

  /**
   * ENRICHIR LES MATCHS avec infos ELO
   */
  enrichMatches(matches, teamElo) {
    return matches.map(match => {
      const opponentElo = this.findElo(match.opponent);
      const eloGap = this.eloEngine.calculateGap(teamElo, opponentElo);
      
      return {
        date: match.date,
        location: match.location,
        opponent: match.opponent,
        opponentElo: opponentElo,
        opponentRating: this.eloEngine.qualifyTeam(opponentElo),
        eloGap: eloGap,
        score: match.score,
        result: match.result,
        events: match.events
      };
    });
  }

  /**
   * FORMATER ÉVÉNEMENTS pour Warren
   */
  formatEventsForWarren(events) {
    if (!events) return {};
    
    const formatted = {};
    
    // Penalties
    if (events.penalties && events.penalties.length > 0) {
      const pen = events.penalties[0];
      formatted.penalty = {
        isTeam: pen.team === 'team' || pen.isTeam === true,
        minute: pen.minute?.toString() || "0"
      };
      
      // Vérifier si c'est le seul but (pour détecter victoire fragile 1-0)
      formatted.penaltyOnlyGoal = pen.isOnlyGoal || false;
    }
    
    // Cartons rouges
    if (events.redCards && events.redCards.length > 0) {
      const red = events.redCards[0];
      formatted.redCard = {
        isTeam: red.team === 'team' || red.isTeam === true,
        minute: parseInt(red.minute) || 0
      };
    }
    
    // Buts 90+
    if (events.goals90Plus && events.goals90Plus.length > 0) {
      const goal90 = events.goals90Plus[0];
      formatted.goal90Plus = {
        isTeam: goal90.team === 'team' || goal90.isTeam === true,
        minute: goal90.minute?.toString() || "90+",
        scoreBefore: goal90.scoreBefore || null
      };
    }
    
    // VAR buts refusés
    if (events.varDisallowed && events.varDisallowed.length > 0) {
      const var90 = events.varDisallowed[0];
      formatted.varDisallowed = {
        isTeam: var90.team === 'team' || var90.isTeam === true,
        minute: parseInt(var90.minute) || 0
      };
    }
    
    return formatted;
  }

  /**
   * GÉNÉRER VERDICT WARREN (nouvelle logique stricte)
   */
  generateVerdict(warrenAnalysis, team1Name, team2Name, stats, eloGap, team1Elo, team2Elo) {
    const { decision, straightWinAllowed, fuzzy } = warrenAnalysis;
    
    // Si FLOU : recommander analyse supplémentaire
    if (fuzzy) {
      return {
        '1x2': 'ANALYSE INSUFFISANTE',
        confidence_1x2: 3,
        btts: stats.btts.tendency,
        confidence_btts: Math.min(9, Math.round((stats.btts.team1.percentage + stats.btts.team2.percentage) / 20)),
        over: stats.over25.tendency,
        confidence_over: Math.min(9, Math.round((stats.over25.team1.percentage + stats.over25.team2.percentage) / 20)),
        score_attendu: '?-?',
        scores_alternatifs: ['Besoin H2H'],
        raisons: [
          '⚠️ Match FLOU détecté',
          '→ Récupérer H2H (2 ans)',
          '→ Si encore flou : home/away splits'
        ],
        risques: [
          'Forme trop équilibrée',
          'Impossible de conclure sans données supplémentaires'
        ],
        warrenNote: 'Match nécessite analyse approfondie (H2H requis)'
      };
    }
    
    // Si victoire directe INTERDITE
    if (!straightWinAllowed) {
      const isFavorite = team1Elo > team2Elo;
      
      return {
        '1x2': eloGap > 150 ? (isFavorite ? '1X' : 'X2') : 'X',
        confidence_1x2: 6,
        btts: stats.btts.tendency,
        confidence_btts: Math.min(9, Math.round((stats.btts.team1.percentage + stats.btts.team2.percentage) / 20)),
        over: stats.over25.tendency,
        confidence_over: Math.min(9, Math.round((stats.over25.team1.percentage + stats.over25.team2.percentage) / 20)),
        score_attendu: '1-1',
        scores_alternatifs: ['2-1', '1-2', '2-2'],
        raisons: decision.reasons || [
          'Asymétrie forme insuffisante',
          'Victoire directe trop risquée',
          'Sécuriser avec X2/DNB'
        ],
        risques: [
          'Favori peut quand même gagner',
          'Contexte match peut changer la donne'
        ],
        warrenNote: 'Warren recommande X2/DNB (victoire directe interdite)'
      };
    }
    
    // Victoire directe AUTORISÉE
    const isFavoriteTeam1 = warrenAnalysis.team1Form.wins7 > warrenAnalysis.team2Form.wins7;
    const favorite = isFavoriteTeam1 ? team1Name : team2Name;
    const confidence = decision.confidence || 65;
    
    return {
      '1x2': isFavoriteTeam1 ? '1' : '2',
      confidence_1x2: Math.round(confidence / 10), // Convertir 65% -> 6.5/10
      btts: stats.btts.tendency,
      confidence_btts: Math.min(9, Math.round((stats.btts.team1.percentage + stats.btts.team2.percentage) / 20)),
      over: stats.over25.tendency,
      confidence_over: Math.min(9, Math.round((stats.over25.team1.percentage + stats.over25.team2.percentage) / 20)),
      score_attendu: isFavoriteTeam1 ? '2-0' : '0-2',
      scores_alternatifs: isFavoriteTeam1 ? ['2-1', '3-0', '3-1'] : ['0-1', '1-2', '0-3'],
      raisons: decision.reasons || [
        `${favorite} en forme dominante`,
        'Asymétrie suffisante détectée',
        `Confiance Warren: ${confidence}%`
      ],
      risques: [
        'Événements imprévus (rouge, VAR)',
        'Contexte tactique peut influencer'
      ],
      warrenNote: `Warren autorise victoire directe de ${favorite} (confiance ${confidence}%)`
    };
  }

  /**
   * CALCULER STATS (BTTS / Over 2.5)
   */
  calculateStats(team1Matches, team2Matches) {
    // Over 2.5
    const team1Over = team1Matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
    const team2Over = team2Matches.filter(m => 
      (m.score.team + m.score.opponent) > 2.5
    ).length;
    
    // BTTS
    const team1Btts = team1Matches.filter(m => 
      m.score.team > 0 && m.score.opponent > 0
    ).length;
    
    const team2Btts = team2Matches.filter(m => 
      m.score.team > 0 && m.score.opponent > 0
    ).length;
    
    return {
      over25: {
        team1: { 
          count: team1Over, 
          total: team1Matches.length, 
          percentage: Math.round(team1Over / team1Matches.length * 100) 
        },
        team2: { 
          count: team2Over, 
          total: team2Matches.length, 
          percentage: Math.round(team2Over / team2Matches.length * 100) 
        },
        tendency: (team1Over + team2Over) >= 8 ? 'Over 2.5' : 'Under 2.5'
      },
      btts: {
        team1: { 
          count: team1Btts, 
          total: team1Matches.length, 
          percentage: Math.round(team1Btts / team1Matches.length * 100) 
        },
        team2: { 
          count: team2Btts, 
          total: team2Matches.length, 
          percentage: Math.round(team2Btts / team2Matches.length * 100) 
        },
        tendency: (team1Btts + team2Btts) >= 8 ? 'Oui' : 'Non'
      }
    };
  }

  /**
   * CALCULER RECORD (pour compatibilité front-end)
   */
  calculateRecord(matches) {
    let totalV = 0, totalN = 0, totalD = 0;
    let homeV = 0, homeN = 0, homeD = 0;
    let awayV = 0, awayN = 0, awayD = 0;

    matches.forEach(m => {
      const isDomicile = m.location === 'Domicile';
      
      if (m.result === 'victoire') {
        totalV++;
        if (isDomicile) homeV++;
        else awayV++;
      } else if (m.result === 'nul') {
        totalN++;
        if (isDomicile) homeN++;
        else awayN++;
      } else if (m.result === 'defaite') {
        totalD++;
        if (isDomicile) homeD++;
        else awayD++;
      }
    });

    return {
      total: { v: totalV, n: totalN, d: totalD },
      home: { v: homeV, n: homeN, d: homeD },
      away: { v: awayV, n: awayN, d: awayD }
    };
  }

  /**
   * GÉNÉRER RÉSUMÉ FORME (pour compatibilité front-end)
   */
  generateFormSummary(formData, eventsData) {
    let quality = 'Moyenne';
    const wins7 = formData.wins7 || 0;

    if (wins7 >= 5) quality = 'Excellente';
    else if (wins7 >= 4) quality = 'Bonne';
    else if (wins7 <= 2) quality = 'Faible';

    const biasCount = eventsData.summary?.tags?.length || 0;

    return {
      quality: quality,
      biasCount: biasCount,
      fatigue: 'Non',
      note: ''
    };
  }

  /**
   * TROUVER ELO d'une équipe
   */
  findElo(teamName) {
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

export default Analyzer;

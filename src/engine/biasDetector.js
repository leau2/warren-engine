// Warren Engine v1 - Bias Detector
// Analyse match avec logique asymétrique stricte + gating victoire directe

class BiasDetector {
  constructor() {
    // Seuils pour victoire directe (ASSOUPLIS pour être plus réalistes)
    this.THRESHOLDS = {
      FAVORI_WINS_5: 3,        // 3 victoires sur 5 (60%)
      FAVORI_WINS_7: 4,        // 4 victoires sur 7 (57%)
      ADVERSAIRE_WINS_5_MAX: 2, // Maximum 2 victoires sur 5 (au lieu de 1)
      ADVERSAIRE_LOSSES_5_MIN: 2, // Minimum 2 défaites sur 5
      ADVERSAIRE_WINS_7_MAX: 2,   // Maximum 2 victoires sur 7
      ADVERSAIRE_LOSSES_7_MIN: 3, // Minimum 3 défaites sur 7
      ADVERSAIRE_LOSSES_7_STRICT: 4, // (non utilisé)
      ANTI_PIEGE_LOSSES_7: 1,    // Si adversaire <= 1 défaite => INTERDIT (au lieu de 2)
      TROP_DE_NULS: 4            // Si >= 4 nuls sur 7 => pas victoire directe (au lieu de 3)
    };
  }

  /**
   * ANALYSE PRINCIPALE
   * Retourne { decision, confidence, reasons, fuzzy, events, debug }
   */
  analyze(team1Data, team2Data, options = {}) {
    const { eloGap = 0 } = options;

    // 1) Calculer forme globale (W/D/L sur 5 et 7 matchs)
    const team1Form = this.analyzeForm(team1Data.matches);
    const team2Form = this.analyzeForm(team2Data.matches);

    // 2) Analyser événements (90+, penalty, rouge, VAR)
    const team1Events = this.analyzeAllEvents(team1Data.matches, 'team1');
    const team2Events = this.analyzeAllEvents(team2Data.matches, 'team2');

    // 3) Vérifier si victoire directe autorisée (gating strict)
    const straightWinCheck = this.canAllowStraightWin(team1Form, team2Form);

    // 4) Déterminer si c'est flou
    const fuzzy = this.isFuzzy(team1Form, team2Form, straightWinCheck);

    // 5) Prendre décision finale
    const decision = this.makeDecision(
      team1Form,
      team2Form,
      team1Events,
      team2Events,
      straightWinCheck,
      fuzzy,
      eloGap
    );

    return {
      team1Form,
      team2Form,
      team1Events,
      team2Events,
      straightWinAllowed: straightWinCheck.allowed,
      fuzzy,
      decision,
      debug: {
        straightWinCheck,
        thresholds: this.THRESHOLDS
      }
    };
  }

  /**
   * FORME GLOBALE (W/D/L sur 5 et 7 derniers matchs)
   */
  analyzeForm(matches) {
    if (!matches || matches.length === 0) {
      return {
        wins5: 0, draws5: 0, losses5: 0,
        wins7: 0, draws7: 0, losses7: 0,
        matches5: [],
        matches7: []
      };
    }

    // Trier par date décroissante
    const sorted = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const last5 = sorted.slice(0, 5);
    const last7 = sorted.slice(0, 7);

    const form5 = this.countResults(last5);
    const form7 = this.countResults(last7);

    return {
      wins5: form5.wins,
      draws5: form5.draws,
      losses5: form5.losses,
      wins7: form7.wins,
      draws7: form7.draws,
      losses7: form7.losses,
      matches5: last5,
      matches7: last7,
      goalsScored5: form5.goalsScored,
      goalsConceded5: form5.goalsConceded,
      goalsScored7: form7.goalsScored,
      goalsConceded7: form7.goalsConceded
    };
  }

  countResults(matches) {
    let wins = 0, draws = 0, losses = 0;
    let goalsScored = 0, goalsConceded = 0;

    matches.forEach(m => {
      const result = this.getResult(m);
      if (result === 'W') wins++;
      else if (result === 'D') draws++;
      else if (result === 'L') losses++;

      // Compter buts
      if (m.score) {
        goalsScored += m.score.team || 0;
        goalsConceded += m.score.opponent || 0;
      }
    });

    return { wins, draws, losses, goalsScored, goalsConceded };
  }

  getResult(match) {
    if (!match.score) return 'D';
    if (match.score.team > match.score.opponent) return 'W';
    if (match.score.team < match.score.opponent) return 'L';
    return 'D';
  }

  /**
   * GATING VICTOIRE DIRECTE (règles strictes)
   * Retourne { allowed: bool, reasons: [], antiTrap: bool }
   */
  canAllowStraightWin(teamForm, opponentForm) {
    const reasons = [];
    let allowed = true;

    // ANTI-PIÈGE : Si adversaire ne perd pas beaucoup (<=2 défaites/7) => INTERDIT
    if (opponentForm.losses7 <= this.THRESHOLDS.ANTI_PIEGE_LOSSES_7) {
      allowed = false;
      reasons.push(`ANTI-PIÈGE: Adversaire ne perd pas assez (${opponentForm.losses7} défaites/7 ≤ ${this.THRESHOLDS.ANTI_PIEGE_LOSSES_7})`);
      return { allowed: false, reasons, antiTrap: true };
    }

    // Vérifier si favori est solide
    const isFavoriSolid = 
      teamForm.wins5 >= this.THRESHOLDS.FAVORI_WINS_5 &&
      teamForm.wins7 >= this.THRESHOLDS.FAVORI_WINS_7;

    if (!isFavoriSolid) {
      allowed = false;
      reasons.push(`Favori pas assez dominant (wins5=${teamForm.wins5}/${this.THRESHOLDS.FAVORI_WINS_5}, wins7=${teamForm.wins7}/${this.THRESHOLDS.FAVORI_WINS_7})`);
    }

    // Vérifier si adversaire est fragile
    const isOpponentFragile = 
      opponentForm.wins5 <= this.THRESHOLDS.ADVERSAIRE_WINS_5_MAX &&
      opponentForm.losses5 >= this.THRESHOLDS.ADVERSAIRE_LOSSES_5_MIN &&
      opponentForm.wins7 <= this.THRESHOLDS.ADVERSAIRE_WINS_7_MAX &&
      opponentForm.losses7 >= this.THRESHOLDS.ADVERSAIRE_LOSSES_7_MIN;

    if (!isOpponentFragile) {
      allowed = false;
      reasons.push(`Adversaire pas assez fragile (wins5=${opponentForm.wins5}, losses5=${opponentForm.losses5}, wins7=${opponentForm.wins7}, losses7=${opponentForm.losses7})`);
    }

    // ANTI-PIÈGE : Trop de nuls du favori
    if (teamForm.draws7 >= this.THRESHOLDS.TROP_DE_NULS) {
      allowed = false;
      reasons.push(`ANTI-PIÈGE: Trop de nuls (${teamForm.draws7}/7 ≥ ${this.THRESHOLDS.TROP_DE_NULS})`);
    }

    if (allowed) {
      reasons.push('Asymétrie suffisante pour victoire directe');
    }

    return { allowed, reasons, antiTrap: false };
  }

  /**
   * DÉTECTION FLOU
   */
  isFuzzy(teamForm, opponentForm, straightWinCheck) {
    // Si victoire directe interdite + écarts faibles => FLOU
    if (!straightWinCheck.allowed) {
      const winsDiff = Math.abs(teamForm.wins7 - opponentForm.wins7);
      const lossesDiff = Math.abs(teamForm.losses7 - opponentForm.losses7);
      
      // Si écarts < 2 => trop proche
      if (winsDiff <= 2 && lossesDiff <= 2) {
        return true;
      }

      // Trop de nuls des deux côtés
      if (teamForm.draws7 >= 2 && opponentForm.draws7 >= 2) {
        return true;
      }
    }

    return false;
  }

  /**
   * ANALYSE TOUS ÉVÉNEMENTS (90+, penalty, rouge, VAR)
   */
  analyzeAllEvents(matches, teamLabel) {
    const events = {
      penalties: [],
      redCards: [],
      goals90Plus: [],
      varDisallowed: [],
      summary: {
        confidenceDelta: 0,
        tags: []
      }
    };

    if (!matches || matches.length === 0) return events;

    matches.forEach(match => {
      // Penalty
      if (match.events?.penalty) {
        const penaltyAnalysis = this.analyzePenalty(match, match.events.penalty);
        if (penaltyAnalysis) {
          events.penalties.push(penaltyAnalysis);
          events.summary.confidenceDelta += penaltyAnalysis.confidenceDelta || 0;
          if (penaltyAnalysis.tags) events.summary.tags.push(...penaltyAnalysis.tags);
        }
      }

      // Rouge
      if (match.events?.redCard) {
        const redAnalysis = this.analyzeRedCard(match, match.events.redCard);
        if (redAnalysis) {
          events.redCards.push(redAnalysis);
          events.summary.confidenceDelta += redAnalysis.confidenceDelta || 0;
          if (redAnalysis.tags) events.summary.tags.push(...redAnalysis.tags);
        }
      }

      // But 90+
      if (match.events?.goal90Plus) {
        const goal90Analysis = this.analyzeGoal90Plus(match, match.events.goal90Plus);
        if (goal90Analysis) {
          events.goals90Plus.push(goal90Analysis);
          events.summary.confidenceDelta += goal90Analysis.confidenceDelta || 0;
          if (goal90Analysis.tags) events.summary.tags.push(...goal90Analysis.tags);
        }
      }

      // VAR but refusé
      if (match.events?.varDisallowed) {
        const varAnalysis = this.analyzeVarDisallowed(match, match.events.varDisallowed);
        if (varAnalysis) {
          events.varDisallowed.push(varAnalysis);
          events.summary.confidenceDelta += varAnalysis.confidenceDelta || 0;
          if (varAnalysis.tags) events.summary.tags.push(...varAnalysis.tags);
        }
      }
    });

    return events;
  }

  /**
   * PENALTY (logique Warren : si 1-0 unique penalty => fragile)
   */
  analyzePenalty(match, penaltyInfo) {
    if (!penaltyInfo || !match.score) return null;

    const { isTeam, minute } = penaltyInfo;
    const { team: scoreTeam, opponent: scoreOpponent } = match.score;
    const result = this.getResult(match);

    const tags = [];
    let confidenceDelta = 0;
    let message = '';

    // CAS SPÉCIAL : 1-0 sur penalty unique
    const isSingleGoal = (scoreTeam === 1 && scoreOpponent === 0) || (scoreTeam === 0 && scoreOpponent === 1);
    const isPenaltyOnlyGoal = match.events?.penaltyOnlyGoal === true; // Flag optionnel

    if (isSingleGoal && isPenaltyOnlyGoal) {
      tags.push('win_fragile_penalty_only');
      confidenceDelta = -15;
      message = `Victoire fragile 1-0 sur penalty unique (${minute}')`;
      
      if (minute >= 75) {
        confidenceDelta = -20;
        message += ' - très tardif, faillit nul';
        tags.push('penalty_very_late');
      }

      return { isTeam, minute, result, tags, confidenceDelta, message };
    }

    // Autres cas
    if (isTeam) {
      tags.push('penalty_for');
      confidenceDelta = -5;
      message = `Penalty obtenu (${minute}')`;
    } else {
      tags.push('penalty_against');
      confidenceDelta = -5;
      message = `Penalty concédé (${minute}')`;
    }

    return { isTeam, minute, result, tags, confidenceDelta, message };
  }

  /**
   * ROUGE (Warren : minute importante)
   */
  analyzeRedCard(match, redCardInfo) {
    if (!redCardInfo) return null;

    const { isTeam, minute } = redCardInfo;
    const result = this.getResult(match);

    const tags = [];
    let confidenceDelta = 0;
    let message = '';

    // Rouge tardif (>=80') => impact faible
    if (minute >= 80) {
      tags.push('red_card_late_low_impact');
      confidenceDelta = -3;
      message = `Rouge tardif (${minute}') - impact faible`;
    } 
    // Rouge tôt (<30') => impact fort
    else if (minute < 30) {
      tags.push('red_card_early_high_impact');
      confidenceDelta = -20;
      message = `Rouge très tôt (${minute}') - fiabilité réduite`;
    } 
    // Rouge moyen
    else {
      tags.push('red_card_medium_impact');
      confidenceDelta = -10;
      message = `Rouge (${minute}') - impact modéré`;
    }

    if (isTeam) {
      tags.push('red_card_team');
      message = `[Équipe] ${message}`;
    } else {
      tags.push('red_card_opponent');
      message = `[Adversaire] ${message}`;
    }

    return { isTeam, minute, result, tags, confidenceDelta, message };
  }

  /**
   * BUT 90+ (Warren : symétrique, change nul/victoire)
   */
  analyzeGoal90Plus(match, goal90Info) {
    if (!goal90Info || !match.score) return null;

    const { isTeam, minute, scoreBefore } = goal90Info;
    const result = this.getResult(match);

    const tags = [];
    let confidenceDelta = -10; // Toujours baisse confiance (variance)
    let message = '';

    if (!scoreBefore) {
      // Pas d'info sur score avant => analyse basique
      tags.push('goal_90_plus');
      message = `But ${minute}' - variance`;
      return { isTeam, minute, result, tags, confidenceDelta, message };
    }

    // Calculer résultat avant et après
    const resultBefore = this.getResultFromScore(scoreBefore);
    const resultAfter = result;

    // CAS 1 : Égalisation (ex: 2-1 -> 2-2)
    if (resultBefore === 'W' && resultAfter === 'D') {
      if (!isTeam) {
        // Adversaire égalise
        tags.push('draw_favors_equalizer', 'draw_against_leader');
        message = `Égalisation ${minute}' - nul favorable à adversaire`;
        confidenceDelta = -15;
      } else {
        // On égalise
        tags.push('draw_favors_equalizer');
        message = `Égalisation ${minute}' - nul arraché`;
        confidenceDelta = -12;
      }
    }
    // CAS 2 : Victoire arrachée (ex: 1-1 -> 2-1)
    else if (resultBefore === 'D' && resultAfter === 'W') {
      tags.push('win_arrachée_variance');
      message = `Victoire arrachée ${minute}' - forte variance`;
      confidenceDelta = -15;
    }
    // CAS 3 : But qui ne change pas résultat (ex: 2-0 -> 3-0)
    else {
      tags.push('goal_90_no_result_change');
      message = `But ${minute}' sans changement de résultat`;
      confidenceDelta = -3; // Impact faible
    }

    return { isTeam, minute, result, scoreBefore, resultBefore, tags, confidenceDelta, message };
  }

  /**
   * VAR BUT REFUSÉ
   */
  analyzeVarDisallowed(match, varInfo) {
    if (!varInfo) return null;

    const { isTeam, minute } = varInfo;
    const tags = ['var_goal_disallowed'];
    let confidenceDelta = 0;
    let message = '';

    if (isTeam) {
      tags.push('performance_better_than_score');
      message = `But refusé VAR (${minute}') - performance > score`;
      confidenceDelta = +5; // Légèrement favorable
    } else {
      tags.push('opponent_unlucky');
      message = `Adversaire but refusé VAR (${minute}')`;
      confidenceDelta = -5;
    }

    return { isTeam, minute, tags, confidenceDelta, message };
  }

  /**
   * DÉCISION FINALE (1X2 / X2 / DNB)
   */
  makeDecision(team1Form, team2Form, team1Events, team2Events, straightWinCheck, fuzzy, eloGap) {
    let verdict = '';
    let confidence = 50; // Base
    const reasons = [];

    // Si FLOU => recommander branches
    if (fuzzy) {
      verdict = 'FUZZY - Analyse supplémentaire requise';
      reasons.push('Match flou détecté');
      reasons.push('→ Recommandation : récupérer H2H (2 ans)');
      reasons.push('→ Si encore flou : home/away splits (5 derniers)');
      confidence = 30;
      
      return { verdict, confidence, reasons, needsH2H: true };
    }

    // Si victoire directe INTERDITE
    if (!straightWinCheck.allowed) {
      verdict = 'X2 ou DNB recommandé';
      reasons.push(...straightWinCheck.reasons);
      confidence = 45;
      
      return { verdict, confidence, reasons };
    }

    // Victoire directe AUTORISÉE
    // Calculer confiance basée sur forme + événements
    let baseConfidence = 65;

    // Bonus forme
    const winsDiff = team1Form.wins7 - team2Form.wins7;
    if (winsDiff >= 4) baseConfidence += 10;
    else if (winsDiff >= 3) baseConfidence += 5;

    // Malus événements
    const totalDelta = team1Events.summary.confidenceDelta + team2Events.summary.confidenceDelta;
    baseConfidence += totalDelta;

    // Bonus Elo gap
    if (eloGap >= 200) baseConfidence += 5;
    else if (eloGap >= 100) baseConfidence += 3;

    // Limiter confiance
    confidence = Math.max(30, Math.min(85, baseConfidence));

    verdict = `Team1 victoire directe (confiance: ${confidence}%)`;
    reasons.push('Asymétrie forme suffisante');
    reasons.push(`Forme: Team1 ${team1Form.wins7}W/${team1Form.draws7}D/${team1Form.losses7}L vs Team2 ${team2Form.wins7}W/${team2Form.draws7}D/${team2Form.losses7}L`);
    
    if (team1Events.summary.tags.length > 0) {
      reasons.push(`Events Team1: ${team1Events.summary.tags.join(', ')}`);
    }
    if (team2Events.summary.tags.length > 0) {
      reasons.push(`Events Team2: ${team2Events.summary.tags.join(', ')}`);
    }

    return { verdict, confidence, reasons };
  }

  /**
   * Helper : Calculer résultat depuis score
   */
  getResultFromScore(score) {
    if (!score) return 'D';
    if (score.team > score.opponent) return 'W';
    if (score.team < score.opponent) return 'L';
    return 'D';
  }

  // ============================================================================
  // ANCIENNES MÉTHODES (pour compatibilité avec analyzer.js existant)
  // ============================================================================

  /**
   * ANCIENNE MÉTHODE - Analyze Penalty (compatibilité)
   * Retourne format ancien pour ne pas casser l'interface
   */
  analyzePenaltyOld(match, penaltyInfo) {
    if (!penaltyInfo) return null;
    
    const { team: penTeam, isTeam, minute } = penaltyInfo;
    const { score, result } = match;
    
    // Calculer score sans penalty
    let scoreWithout = { ...score };
    if (isTeam) {
      scoreWithout.team -= 1;
    } else {
      scoreWithout.opponent -= 1;
    }
    
    const resultWithout = this.getResult(match);
    
    return {
      type: isTeam ? 'penalty_team' : 'penalty_adverse',
      severity: 'MOYEN',
      message: `Penalty ${minute}'`,
      scoreReal: scoreWithout,
      impact: 'Voir analyse Warren pour détails'
    };
  }

  /**
   * ANCIENNE MÉTHODE - Analyze Red Card (compatibilité)
   */
  analyzeRedCardOld(match, redCardInfo) {
    if (!redCardInfo) return null;
    
    const { team: cardTeam, isTeam, minute } = redCardInfo;
    const { result } = match;
    
    return {
      type: isTeam ? 'rouge_team' : 'rouge_adverse',
      severity: minute < 30 ? 'FORT' : minute >= 80 ? 'FAIBLE' : 'MOYEN',
      message: `Rouge ${minute}'`,
      impact: 'Voir analyse Warren pour détails'
    };
  }

  /**
   * ANCIENNE MÉTHODE - Analyze Goal 90+ (compatibilité)
   */
  analyzeGoal90PlusOld(match, goal90Info, eloGap) {
    if (!goal90Info) return null;
    
    const { isTeam, minute } = goal90Info;
    
    return {
      type: isTeam ? 'but90_marque' : 'but90_encaisse',
      severity: 'POSITIF_LEGER',
      message: `But ${minute}'`,
      impact: 'Voir analyse Warren pour détails'
    };
  }

  /**
   * ANCIENNE MÉTHODE - Detect Fatigue (compatibilité)
   */
  detectFatigue(matches) {
    if (!matches || matches.length < 3) return null;
    
    const dates = matches.map(m => new Date(m.date)).sort((a, b) => b - a);
    let matchesIn11Days = 1;
    
    for (let i = 0; i < Math.min(dates.length - 1, 6); i++) {
      const daysDiff = (dates[0] - dates[i + 1]) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 11) {
        matchesIn11Days++;
      }
    }
    
    // 4 matchs en 11 jours = critique (fatigue confirmée)
    if (matchesIn11Days >= 4) {
      return {
        detected: true,
        matchCount: matchesIn11Days,
        period: '11 jours',
        impact: 'Fatigue confirmée, performance réduite attendue',
        severity: 'FORT'
      };
    }
    
    return null;
  }

  getResult(match) {
    if (!match.score) return 'nul';
    if (match.score.team > match.score.opponent) return 'victoire';
    if (match.score.team < match.score.opponent) return 'defaite';
    return 'nul';
  }
}

export default BiasDetector;

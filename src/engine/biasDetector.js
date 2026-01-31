// Warren Engine v2 - Bias Detector
// Détection enrichie pour analyse qualitative des matchs

class BiasDetector {
  constructor() {
    // Seuils conservés pour compatibilité
    this.THRESHOLDS = {
      FAVORI_WINS_5: 3,
      FAVORI_WINS_7: 4,
      ADVERSAIRE_WINS_5_MAX: 2,
      ADVERSAIRE_LOSSES_5_MIN: 2,
      ADVERSAIRE_WINS_7_MAX: 2,
      ADVERSAIRE_LOSSES_7_MIN: 3,
      ADVERSAIRE_LOSSES_7_STRICT: 4,
      ANTI_PIEGE_LOSSES_7: 1,
      TROP_DE_NULS: 4
    };
  }

  /**
   * NOUVELLE MÉTHODE - Enrichir les événements d'un match
   * Collecte toutes les infos pour qualifyMatch()
   */
  enrichMatchEvents(match) {
    if (!match || !match.events) {
      return {
        redCards: [],
        penalties: [],
        goals90Plus: [],
        goalsAfterRed: 0,
        leadInMatch: false,
        cameBack: false
      };
    }

    const events = {
      redCards: [],
      penalties: [],
      goals90Plus: [],
      goalsAfterRed: 0,
      leadInMatch: false,
      cameBack: false
    };

    // Cartons rouges
    if (match.events.redCard) {
      events.redCards.push({
        isTeam: match.events.redCard.isTeam,
        minute: match.events.redCard.minute
      });

      // Calculer buts marqués APRÈS le rouge
      events.goalsAfterRed = this.countGoalsAfterMinute(
        match,
        match.events.redCard.minute
      );
    }

    // Penalties
    if (match.events.penalty) {
      const isDecisive = this.isPenaltyDecisive(match, match.events.penalty);
      events.penalties.push({
        isTeam: match.events.penalty.isTeam,
        minute: match.events.penalty.minute,
        decisive: isDecisive
      });
    }

    // Buts 90'+
    if (match.events.goal90Plus) {
      const isDecisive = this.isGoal90Decisive(match, match.events.goal90Plus);
      events.goals90Plus.push({
        isTeam: match.events.goal90Plus.isTeam,
        minute: match.events.goal90Plus.minute,
        decisive: isDecisive
      });
    }

    // Détecter si l'équipe a mené dans le match
    events.leadInMatch = this.didTeamLead(match);

    // Détecter si l'équipe est revenue au score
    events.cameBack = this.didTeamComeBack(match);

    return events;
  }

  /**
   * Compter les buts marqués après une certaine minute
   */
  countGoalsAfterMinute(match, minute) {
    if (!match.events || !match.events.goals) return 0;
    
    // Si pas de détail des buts, on estime
    // Si rouge tôt (< 60') et victoire large, on suppose plusieurs buts après
    const minutesLeft = 90 - minute;
    const scoreDiff = Math.abs(match.score.team - match.score.opponent);
    
    if (minutesLeft >= 30 && scoreDiff >= 2) {
      return Math.min(scoreDiff, 3); // Estimation conservative
    }
    
    if (minutesLeft >= 20 && scoreDiff >= 1) {
      return 1;
    }
    
    return 0;
  }

  /**
   * Vérifier si penalty était décisif
   */
  isPenaltyDecisive(match, penaltyInfo) {
    if (!match.score) return false;

    const { isTeam, minute } = penaltyInfo;
    const { team, opponent } = match.score;

    // Cas 1 : Match gagné 1-0 sur penalty unique
    if (team === 1 && opponent === 0 && isTeam) {
      return true;
    }

    // Cas 2 : Match gagné de 1 but ET penalty pour l'équipe
    if (isTeam && (team - opponent === 1)) {
      return true;
    }

    // Cas 3 : Penalty tardif (75'+) qui change le résultat
    if (minute >= 75) {
      // Si score serré (1 but), le penalty est probablement décisif
      if (Math.abs(team - opponent) <= 1) {
        return true;
      }
    }

    return false;
  }

  /**
   * Vérifier si but 90'+ était décisif
   */
  isGoal90Decisive(match, goal90Info) {
    if (!match.score || !goal90Info.scoreBefore) return false;

    const resultBefore = this.getResultFromScore(goal90Info.scoreBefore);
    const resultAfter = this.getResult(match);

    // Si le résultat a changé → décisif
    return resultBefore !== resultAfter;
  }

  /**
   * Vérifier si l'équipe a mené dans le match
   * (Nécessite données détaillées - sinon estimation)
   */
  didTeamLead(match) {
    // Si on a scoreBefore dans goal90Plus, on peut déduire
    if (match.events?.goal90Plus?.scoreBefore) {
      const { team, opponent } = match.events.goal90Plus.scoreBefore;
      if (team > opponent) return true;
    }

    // Si on a l'historique des buts (timeline)
    if (match.events?.timeline) {
      // Parcourir timeline pour voir si équipe a mené
      // TODO: implémenter si API fournit timeline
    }

    // Estimation : si défaite serrée (1 but) → peut-être a mené
    if (this.getResult(match) === 'defaite') {
      const scoreDiff = Math.abs(match.score.team - match.score.opponent);
      if (scoreDiff === 1 && match.score.team >= 1) {
        return true; // Estimation conservative
      }
    }

    return false;
  }

  /**
   * Vérifier si l'équipe est revenue au score
   * Ex: perdait 2-0, revient 2-2
   */
  didTeamComeBack(match) {
    // Si on a scoreBefore dans goal90Plus
    if (match.events?.goal90Plus?.scoreBefore) {
      const before = match.events.goal90Plus.scoreBefore;
      const after = match.score;
      
      // Si perdait avant et égalise après
      if (before.team < before.opponent && after.team === after.opponent) {
        return true;
      }
      
      // Si perdait avant et gagne après (remontada)
      if (before.team < before.opponent && after.team > after.opponent) {
        return true;
      }
    }

    // Estimation : si match nul avec plusieurs buts marqués
    if (this.getResult(match) === 'nul' && match.score.team >= 2) {
      return true; // Probable qu'il y ait eu un comeback
    }

    return false;
  }

  /**
   * Helper : Résultat depuis score
   */
  getResultFromScore(score) {
    if (!score) return 'nul';
    if (score.team > score.opponent) return 'victoire';
    if (score.team < score.opponent) return 'defaite';
    return 'nul';
  }

  getResult(match) {
    if (!match.score) return 'nul';
    return this.getResultFromScore(match.score);
  }

  // ============================================================================
  // MÉTHODES EXISTANTES (compatibilité)
  // ============================================================================

  analyze(team1Data, team2Data, options = {}) {
    const { eloGap = 0 } = options;

    const team1Form = this.analyzeForm(team1Data.matches);
    const team2Form = this.analyzeForm(team2Data.matches);

    const team1Events = this.analyzeAllEvents(team1Data.matches, 'team1');
    const team2Events = this.analyzeAllEvents(team2Data.matches, 'team2');

    const straightWinCheck = this.canAllowStraightWin(team1Form, team2Form);
    const fuzzy = this.isFuzzy(team1Form, team2Form, straightWinCheck);

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

  analyzeForm(matches) {
    if (!matches || matches.length === 0) {
      return {
        wins5: 0, draws5: 0, losses5: 0,
        wins7: 0, draws7: 0, losses7: 0,
        matches5: [],
        matches7: []
      };
    }

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
      if (result === 'victoire') wins++;
      else if (result === 'nul') draws++;
      else if (result === 'defaite') losses++;

      if (m.score) {
        goalsScored += m.score.team || 0;
        goalsConceded += m.score.opponent || 0;
      }
    });

    return { wins, draws, losses, goalsScored, goalsConceded };
  }

  canAllowStraightWin(teamForm, opponentForm) {
    const reasons = [];
    let allowed = true;

    if (opponentForm.losses7 <= this.THRESHOLDS.ANTI_PIEGE_LOSSES_7) {
      allowed = false;
      reasons.push(`ANTI-PIÈGE: Adversaire ne perd pas assez (${opponentForm.losses7} défaites/7 ≤ ${this.THRESHOLDS.ANTI_PIEGE_LOSSES_7})`);
      return { allowed: false, reasons, antiTrap: true };
    }

    const isFavoriSolid = 
      teamForm.wins5 >= this.THRESHOLDS.FAVORI_WINS_5 &&
      teamForm.wins7 >= this.THRESHOLDS.FAVORI_WINS_7;

    if (!isFavoriSolid) {
      allowed = false;
      reasons.push(`Favori pas assez dominant (wins5=${teamForm.wins5}/${this.THRESHOLDS.FAVORI_WINS_5}, wins7=${teamForm.wins7}/${this.THRESHOLDS.FAVORI_WINS_7})`);
    }

    const isOpponentFragile = 
      opponentForm.wins5 <= this.THRESHOLDS.ADVERSAIRE_WINS_5_MAX &&
      opponentForm.losses5 >= this.THRESHOLDS.ADVERSAIRE_LOSSES_5_MIN &&
      opponentForm.wins7 <= this.THRESHOLDS.ADVERSAIRE_WINS_7_MAX &&
      opponentForm.losses7 >= this.THRESHOLDS.ADVERSAIRE_LOSSES_7_MIN;

    if (!isOpponentFragile) {
      allowed = false;
      reasons.push(`Adversaire pas assez fragile`);
    }

    if (teamForm.draws7 >= this.THRESHOLDS.TROP_DE_NULS) {
      allowed = false;
      reasons.push(`ANTI-PIÈGE: Trop de nuls (${teamForm.draws7}/7)`);
    }

    if (allowed) {
      reasons.push('Asymétrie suffisante pour victoire directe');
    }

    return { allowed, reasons, antiTrap: false };
  }

  isFuzzy(teamForm, opponentForm, straightWinCheck) {
    if (!straightWinCheck.allowed) {
      const winsDiff = Math.abs(teamForm.wins7 - opponentForm.wins7);
      const lossesDiff = Math.abs(teamForm.losses7 - opponentForm.losses7);
      
      if (winsDiff <= 2 && lossesDiff <= 2) {
        return true;
      }

      if (teamForm.draws7 >= 2 && opponentForm.draws7 >= 2) {
        return true;
      }
    }

    return false;
  }

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
      if (match.events?.penalty) {
        const penaltyAnalysis = this.analyzePenalty(match, match.events.penalty);
        if (penaltyAnalysis) {
          events.penalties.push(penaltyAnalysis);
          events.summary.confidenceDelta += penaltyAnalysis.confidenceDelta || 0;
          if (penaltyAnalysis.tags) events.summary.tags.push(...penaltyAnalysis.tags);
        }
      }

      if (match.events?.redCard) {
        const redAnalysis = this.analyzeRedCard(match, match.events.redCard);
        if (redAnalysis) {
          events.redCards.push(redAnalysis);
          events.summary.confidenceDelta += redAnalysis.confidenceDelta || 0;
          if (redAnalysis.tags) events.summary.tags.push(...redAnalysis.tags);
        }
      }

      if (match.events?.goal90Plus) {
        const goal90Analysis = this.analyzeGoal90Plus(match, match.events.goal90Plus);
        if (goal90Analysis) {
          events.goals90Plus.push(goal90Analysis);
          events.summary.confidenceDelta += goal90Analysis.confidenceDelta || 0;
          if (goal90Analysis.tags) events.summary.tags.push(...goal90Analysis.tags);
        }
      }

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

  analyzePenalty(match, penaltyInfo) {
    if (!penaltyInfo || !match.score) return null;

    const { isTeam, minute } = penaltyInfo;
    const { team: scoreTeam, opponent: scoreOpponent } = match.score;

    const tags = [];
    let confidenceDelta = 0;
    let message = '';

    const isSingleGoal = (scoreTeam === 1 && scoreOpponent === 0) || (scoreTeam === 0 && scoreOpponent === 1);
    const isPenaltyOnlyGoal = match.events?.penaltyOnlyGoal === true;

    if (isSingleGoal && isPenaltyOnlyGoal) {
      tags.push('win_fragile_penalty_only');
      confidenceDelta = -15;
      message = `Victoire fragile 1-0 sur penalty unique (${minute}')`;
      
      if (minute >= 75) {
        confidenceDelta = -20;
        message += ' - très tardif';
        tags.push('penalty_very_late');
      }

      return { isTeam, minute, tags, confidenceDelta, message };
    }

    if (isTeam) {
      tags.push('penalty_for');
      confidenceDelta = -5;
      message = `Penalty obtenu (${minute}')`;
    } else {
      tags.push('penalty_against');
      confidenceDelta = -5;
      message = `Penalty concédé (${minute}')`;
    }

    return { isTeam, minute, tags, confidenceDelta, message };
  }

  analyzeRedCard(match, redCardInfo) {
    if (!redCardInfo) return null;

    const { isTeam, minute } = redCardInfo;

    const tags = [];
    let confidenceDelta = 0;
    let message = '';

    if (minute >= 80) {
      tags.push('red_card_late_low_impact');
      confidenceDelta = -3;
      message = `Rouge tardif (${minute}')`;
    } else if (minute < 30) {
      tags.push('red_card_early_high_impact');
      confidenceDelta = -20;
      message = `Rouge très tôt (${minute}')`;
    } else {
      tags.push('red_card_medium_impact');
      confidenceDelta = -10;
      message = `Rouge (${minute}')`;
    }

    if (isTeam) {
      tags.push('red_card_team');
    } else {
      tags.push('red_card_opponent');
    }

    return { isTeam, minute, tags, confidenceDelta, message };
  }

  analyzeGoal90Plus(match, goal90Info) {
    if (!goal90Info || !match.score) return null;

    const { isTeam, minute, scoreBefore } = goal90Info;

    const tags = [];
    let confidenceDelta = -10;
    let message = '';

    if (!scoreBefore) {
      tags.push('goal_90_plus');
      message = `But ${minute}'`;
      return { isTeam, minute, tags, confidenceDelta, message };
    }

    const resultBefore = this.getResultFromScore(scoreBefore);
    const resultAfter = this.getResult(match);

    if (resultBefore === 'victoire' && resultAfter === 'nul') {
      tags.push('draw_favors_equalizer');
      message = `Égalisation ${minute}'`;
      confidenceDelta = -15;
    } else if (resultBefore === 'nul' && resultAfter === 'victoire') {
      tags.push('win_arrachée_variance');
      message = `Victoire arrachée ${minute}'`;
      confidenceDelta = -15;
    } else {
      tags.push('goal_90_no_result_change');
      message = `But ${minute}' sans changement`;
      confidenceDelta = -3;
    }

    return { isTeam, minute, scoreBefore, resultBefore, tags, confidenceDelta, message };
  }

  analyzeVarDisallowed(match, varInfo) {
    if (!varInfo) return null;

    const { isTeam, minute } = varInfo;
    const tags = ['var_goal_disallowed'];
    let confidenceDelta = 0;
    let message = '';

    if (isTeam) {
      tags.push('performance_better_than_score');
      message = `But refusé VAR (${minute}')`;
      confidenceDelta = +5;
    } else {
      tags.push('opponent_unlucky');
      message = `Adversaire but refusé VAR (${minute}')`;
      confidenceDelta = -5;
    }

    return { isTeam, minute, tags, confidenceDelta, message };
  }

  makeDecision(team1Form, team2Form, team1Events, team2Events, straightWinCheck, fuzzy, eloGap) {
    let verdict = '';
    let confidence = 50;
    const reasons = [];

    if (fuzzy) {
      verdict = 'FUZZY - Analyse supplémentaire requise';
      reasons.push('Match flou détecté');
      confidence = 30;
      return { verdict, confidence, reasons, needsH2H: true };
    }

    if (!straightWinCheck.allowed) {
      verdict = 'X2 ou DNB recommandé';
      reasons.push(...straightWinCheck.reasons);
      confidence = 45;
      return { verdict, confidence, reasons };
    }

    let baseConfidence = 65;

    const winsDiff = team1Form.wins7 - team2Form.wins7;
    if (winsDiff >= 4) baseConfidence += 10;
    else if (winsDiff >= 3) baseConfidence += 5;

    const totalDelta = team1Events.summary.confidenceDelta + team2Events.summary.confidenceDelta;
    baseConfidence += totalDelta;

    if (eloGap >= 200) baseConfidence += 5;
    else if (eloGap >= 100) baseConfidence += 3;

    confidence = Math.max(30, Math.min(85, baseConfidence));

    verdict = `Team1 victoire directe (confiance: ${confidence}%)`;
    reasons.push('Asymétrie forme suffisante');
    reasons.push(`Forme: Team1 ${team1Form.wins7}W vs Team2 ${team2Form.wins7}W`);

    return { verdict, confidence, reasons };
  }

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
    
    if (matchesIn11Days >= 4) {
      return {
        detected: true,
        matchCount: matchesIn11Days,
        period: '11 jours',
        impact: 'Fatigue confirmée',
        severity: 'FORT'
      };
    }
    
    return null;
  }
}

export default BiasDetector;

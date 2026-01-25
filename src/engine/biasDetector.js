// Warren Engine - Bias Detector
// Détecte et contextualise les biais (penalty, rouge, VAR, 90'+)

class BiasDetector {
  analyzePenalty(match, penaltyInfo) {
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
    
    const resultWithout = this.getResultFromScore(scoreWithout);
    
    // Analyser l'impact
    if (isTeam) {
      // Penalty pour l'équipe
      if (resultWithout === 'defaite' && result === 'nul') {
        return {
          type: 'penalty_team',
          severity: 'FORT_NEGATIF',
          message: `Sauvé par penalty ${minute}', score réel : ${scoreWithout.team}-${scoreWithout.opponent} (défaite)`,
          scoreReal: scoreWithout,
          impact: 'Performance très faible masquée par but gratuit'
        };
      }
      
      if (resultWithout === 'nul' && result === 'victoire') {
        return {
          type: 'penalty_team',
          severity: 'FORT_NEGATIF',
          message: `Victoire artificielle (penalty ${minute}'), score réel : ${scoreWithout.team}-${scoreWithout.opponent} (nul)`,
          scoreReal: scoreWithout,
          impact: 'Victoire grâce à but gratuit'
        };
      }
      
      if (resultWithout === 'victoire' && result === 'victoire') {
        const diffBefore = scoreWithout.team - scoreWithout.opponent;
        const diffAfter = score.team - score.opponent;
        if (diffAfter > diffBefore + 1) {
          return {
            type: 'penalty_team',
            severity: 'MOYEN',
            message: `Écart flatté par penalty ${minute}'`,
            scoreReal: scoreWithout,
            impact: 'Victoire déjà acquise, écart exagéré'
          };
        }
        return {
          type: 'penalty_team',
          severity: 'NEUTRE',
          message: `Penalty ${minute}' sur domination établie`,
          scoreReal: scoreWithout,
          impact: 'Domination déjà claire'
        };
      }
    } else {
      // Penalty adverse
      if (result === 'defaite' && resultWithout === 'nul') {
        return {
          type: 'penalty_adverse',
          severity: 'FAVORABLE',
          message: `Malchance penalty adverse ${minute}', menait ou tenait ${scoreWithout.team}-${scoreWithout.opponent}`,
          scoreReal: scoreWithout,
          impact: 'Performance réelle meilleure que score affiché'
        };
      }
      
      if (result === 'nul' && resultWithout === 'victoire') {
        return {
          type: 'penalty_adverse',
          severity: 'FAVORABLE',
          message: `Privé de victoire par penalty adverse ${minute}', score réel : ${scoreWithout.team}-${scoreWithout.opponent}`,
          scoreReal: scoreWithout,
          impact: 'Bonne performance masquée'
        };
      }
    }
    
    return {
      type: isTeam ? 'penalty_team' : 'penalty_adverse',
      severity: 'NEUTRE',
      message: `Penalty ${minute}'`,
      scoreReal: scoreWithout,
      impact: 'Impact limité sur résultat'
    };
  }

  analyzeRedCard(match, redCardInfo) {
    if (!redCardInfo) return null;
    
    const { team: cardTeam, isTeam, minute } = redCardInfo;
    const { score, result } = match;
    
    if (!isTeam) {
      // Rouge adversaire
      const scoreDiff = score.team - score.opponent;
      
      if (result === 'victoire' && scoreDiff === 1) {
        return {
          type: 'rouge_adverse',
          severity: 'MOYEN',
          message: `Rouge adversaire ${minute}', victoire 1 but seulement`,
          impact: 'Exploitation limitée de 11 vs 10'
        };
      }
      
      if (result === 'victoire' && scoreDiff >= 2) {
        return {
          type: 'rouge_adverse',
          severity: 'POSITIF_LEGER',
          message: `Rouge adversaire ${minute}', bonne exploitation`,
          impact: 'Supériorité numérique bien utilisée'
        };
      }
      
      if (result === 'nul' || result === 'defaite') {
        return {
          type: 'rouge_adverse',
          severity: 'FORT_NEGATIF',
          message: `Rouge adversaire ${minute}', incapacité à gagner contre 10`,
          impact: 'Performance catastrophique'
        };
      }
    } else {
      // Rouge de l'équipe
      return {
        type: 'rouge_team',
        severity: 'FORT',
        message: `Rouge ${minute}', ${result} en infériorité`,
        impact: result === 'victoire' ? 'Exploit en 10' : result === 'nul' ? 'Résistance héroïque' : 'Défaite logique'
      };
    }
    
    return null;
  }

  analyzeGoal90Plus(match, goal90Info, eloGap) {
    if (!goal90Info) return null;
    
    const { isTeam, minute } = goal90Info;
    const { result } = match;
    
    if (isTeam) {
      // But 90'+ marqué
      return {
        type: 'but90_marque',
        severity: 'POSITIF_LEGER',
        message: `But salvateur ${minute}'`,
        impact: result === 'victoire' ? 'Victoire arrachée, chance' : 'Points sauvés in extremis'
      };
    } else {
      // But 90'+ encaissé
      if (eloGap >= 200) {
        // Contre équipe très supérieure
        return {
          type: 'but90_encaisse',
          severity: 'FAVORABLE',
          message: `But encaissé ${minute}' contre équipe forte`,
          impact: 'Bonne résistance, malchance en fin de match'
        };
      }
      
      if (eloGap < 100) {
        // Contre équipe égale/inférieure
        return {
          type: 'but90_encaisse',
          severity: 'NEGATIF',
          message: `But encaissé ${minute}'`,
          impact: 'Mauvaise gestion de fin de match'
        };
      }
      
      return {
        type: 'but90_encaisse',
        severity: 'MOYEN',
        message: `But encaissé ${minute}'`,
        impact: 'Malchance, mais aurait pu mieux gérer'
      };
    }
  }

  detectFatigue(matches) {
    if (matches.length < 3) return null;
    
    const dates = matches.map(m => new Date(m.date)).sort((a, b) => b - a);
    let matchesIn10Days = 1; // Le match le plus récent
    
    for (let i = 0; i < Math.min(dates.length - 1, 6); i++) {
      const daysDiff = (dates[0] - dates[i + 1]) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 10) {
        matchesIn10Days++;
      }
    }
    
    if (matchesIn10Days >= 3) {
      return {
        detected: true,
        matchCount: matchesIn10Days,
        period: '10 jours',
        impact: 'Fatigue confirmée, performance réduite attendue',
        severity: 'FORT'
      };
    }
    
    return null;
  }

  getResultFromScore(score) {
    if (score.team > score.opponent) return 'victoire';
    if (score.team < score.opponent) return 'defaite';
    return 'nul';
  }
}

module.exports = BiasDetector;

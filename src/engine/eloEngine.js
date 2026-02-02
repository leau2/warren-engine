// Warren Engine - ELO Analysis
// Pondération des performances selon écart ELO

class EloEngine {
  constructor() {
    this.ratings = {
      elite: { min: 2000, label: '⭐⭐⭐⭐ ELITE', desc: 'Top 3 mondial' },
      tresFort: { min: 1900, label: '⭐⭐⭐ TRÈS FORT', desc: 'Top 4-10' },
      fort: { min: 1800, label: '⭐⭐ FORT', desc: 'Top 11-22' },
      moyen: { min: 1700, label: '⭐ MOYEN', desc: 'Top 23-52' },
      faible: { min: 0, label: 'FAIBLE', desc: '53+' }
    };
  }

  qualifyTeam(elo) {
    if (elo >= 2000) return this.ratings.elite;
    if (elo >= 1900) return this.ratings.tresFort;
    if (elo >= 1800) return this.ratings.fort;
    if (elo >= 1700) return this.ratings.moyen;
    return this.ratings.faible;
  }

  calculateGap(eloTeam, eloOpponent) {
    return eloTeam - eloOpponent; // Gardé avec signe pour savoir qui est favori
  }

  // NOUVELLE FONCTION - Logique Warren 2.0
  qualifyMatch(teamElo, opponentElo, result, score, events) {
    const eloGap = this.calculateGap(teamElo, opponentElo);
    const scoreDiff = Math.abs(score.team - score.opponent);
    
    // Déterminer le statut de l'équipe
    let teamStatus;
    if (eloGap >= 100) {
      teamStatus = 'FAVORI';
    } else if (eloGap <= -100) {
      teamStatus = 'OUTSIDER';
    } else {
      teamStatus = 'EGAL';
    }

    // Analyser si les événements sont impactants
    const rougeImpactant = this.isRedCardImpactful(events.redCards, events.goalsAfterRed);
    const penaltyDecisif = this.isPenaltyDecisive(events.penalties, score);
    const but90Decisif = events.goals90Plus && events.goals90Plus.some(g => g.decisive);

    // QUALIFICATION selon résultat + contexte
    let qualification, impactForme, explication;

    // ========== VICTOIRE ==========
    if (result === 'victoire') {
      
      if (teamStatus === 'FAVORI') {
        const hasAdvantage = rougeImpactant || penaltyDecisif || but90Decisif;
        
        if (hasAdvantage) {
          qualification = 'Petite victoire';
          impactForme = 'OK';
          explication = `Victoire avec avantage (${this.getAdvantageText(rougeImpactant, penaltyDecisif, but90Decisif)})`;
        } else if (Math.abs(eloGap) >= 400) {
          qualification = 'Très petite victoire';
          impactForme = 'OK';
          explication = `Victoire attendue contre équipe bien plus faible (${Math.abs(eloGap)} ELO)`;
        } else {
          qualification = 'Victoire normale';
          impactForme = 'BON';
          explication = `Victoire propre contre adversaire inférieur (${Math.abs(eloGap)} ELO)`;
        }
      } 
      else if (teamStatus === 'EGAL') {
        qualification = 'Victoire';
        impactForme = 'BON';
        explication = 'Victoire contre équipe de niveau équivalent';
      } 
      else if (teamStatus === 'OUTSIDER') {
        qualification = 'Grande victoire / Exploit';
        impactForme = 'EXCELLENT';
        explication = `Exploit contre équipe supérieure (${Math.abs(eloGap)} ELO)`;
      }
    }

    // ========== NUL ==========
    else if (result === 'nul') {
      
      if (teamStatus === 'FAVORI') {
        if (rougeImpactant) {
          qualification = 'Nul négatif';
          impactForme = 'MAUVAIS';
          explication = `Avantage numérique non exploité contre équipe inférieure`;
        } else {
          qualification = 'Nul mitigé';
          impactForme = 'MOYEN';
          explication = `Aurait pu mieux faire contre équipe inférieure (${Math.abs(eloGap)} ELO)`;
        }
      } 
      else if (teamStatus === 'EGAL') {
        qualification = 'Nul neutre';
        impactForme = 'NEUTRE';
        explication = 'Match équilibré, nul logique';
      } 
      else if (teamStatus === 'OUTSIDER') {
        const hasDisadvantage = events.redCards && events.redCards.some(r => r.isTeam);
        
        if (hasDisadvantage) {
          qualification = 'Nul héroïque';
          impactForme = 'EXCELLENT';
          explication = `Résistance remarquable malgré l'infériorité numérique`;
        } else {
          qualification = 'Bon point pris';
          impactForme = 'BON';
          explication = `Bon résultat contre équipe supérieure (${Math.abs(eloGap)} ELO)`;
        }
      }
    }

    // ========== DÉFAITE ==========
    else if (result === 'defaite') {
      
      if (teamStatus === 'FAVORI') {
        qualification = 'Mauvaise défaite';
        impactForme = 'TRÈS MAUVAIS';
        explication = `Contre-performance majeure contre équipe inférieure`;
      } 
      else if (teamStatus === 'EGAL') {
        qualification = 'Défaite normale';
        impactForme = 'MAUVAIS';
        explication = 'Défaite contre équipe de niveau équivalent';
      } 
      else if (teamStatus === 'OUTSIDER') {
        const isHonorable = this.isDefeatHonorable(scoreDiff, events, but90Decisif);
        
        if (isHonorable) {
          qualification = 'Défaite honorable';
          impactForme = 'POSITIF';
          explication = this.getHonorableDefeatReason(scoreDiff, events, but90Decisif);
        } else if (scoreDiff >= 3) {
          qualification = 'Lourde défaite';
          impactForme = 'TRÈS MAUVAIS';
          explication = `Défaite lourde même contre équipe supérieure`;
        } else {
          qualification = 'Défaite attendue';
          impactForme = 'NEUTRE';
          explication = `Défaite logique contre équipe supérieure (${Math.abs(eloGap)} ELO)`;
        }
      }
    }

    return {
      qualification,
      impactForme,
      explication,
      eloGap,
      teamStatus,
      events: {
        rougeImpactant,
        penaltyDecisif,
        but90Decisif
      }
    };
  }

  // Vérifier si rouge est impactant
  isRedCardImpactful(redCards, goalsAfterRed) {
    if (!redCards || redCards.length === 0) return false;
    
    const redCard = redCards[0]; // Premier rouge
    const minutesLeft = 90 - redCard.minute;
    
    // Au moins 10 minutes restantes ET des buts marqués après
    return minutesLeft >= 10 && goalsAfterRed > 0;
  }

  // Vérifier si penalty est décisif
  isPenaltyDecisive(penalties, score) {
    if (!penalties || penalties.length === 0) return false;
    
    // Penalty décisif si le score était serré avant
    // Ex: 1-1 → 2-1 avec penalty = décisif
    // Mais 2-0 → 3-0 avec penalty = pas décisif
    return penalties.some(p => p.decisive === true);
  }

  // Vérifier si défaite est honorable
  isDefeatHonorable(scoreDiff, events, but90Decisif) {
    // Critères pour défaite honorable :
    // 1. Score serré (1 but d'écart)
    if (scoreDiff <= 1) return true;
    
    // 2. A mené dans le match
    if (events.leadInMatch) return true;
    
    // 3. Est revenu au score avant de perdre
    if (events.cameBack) return true;
    
    // 4. But décisif tardif (90'+)
    if (but90Decisif) return true;
    
    return false;
  }

  // Texte explicatif pour défaite honorable
  getHonorableDefeatReason(scoreDiff, events, but90Decisif) {
    if (scoreDiff <= 1) {
      return 'Défaite serrée (1 but), bonne résistance';
    }
    if (events.leadInMatch) {
      return 'A mené dans le match, belle performance malgré la défaite';
    }
    if (events.cameBack) {
      return 'Est revenu au score, combat jusqu\'au bout';
    }
    if (but90Decisif) {
      return 'Perdu sur but tardif (90\'+), match était serré';
    }
    return 'Belle résistance';
  }

  // Texte pour avantages
  getAdvantageText(rouge, penalty, but90) {
    const avantages = [];
    if (rouge) avantages.push('supériorité numérique');
    if (penalty) avantages.push('penalty décisif');
    if (but90) avantages.push('but 90\'+ décisif');
    return avantages.join(', ');
  }

  // ANCIENNE FONCTION - Gardée pour compatibilité
  qualifyPerformance(result, eloTeam, eloOpponent, scoreTeam, scoreOpp) {
    const gap = Math.abs(this.calculateGap(eloTeam, eloOpponent));
    const isFavorite = eloTeam > eloOpponent;
    const scoreDiff = Math.abs(scoreTeam - scoreOpp);
    
    // ... (garde l'ancienne logique pour ne pas casser l'existant)
    if (gap < 50) {
      if (result === 'victoire') {
        return scoreDiff >= 2 
          ? { stars: '⭐⭐⭐', label: 'EXCELLENTE', desc: 'Domination contre égal' }
          : { stars: '⭐⭐', label: 'BONNE', desc: 'Victoire courte contre égal' };
      }
      if (result === 'nul') {
        return { stars: '✅', label: 'CORRECT', desc: 'Logique entre égaux' };
      }
      return { stars: '⚠️', label: 'CONTRE-PERFORMANCE', desc: 'Défaite contre égal' };
    }
    
    if (gap < 150) {
      if (isFavorite && result === 'victoire') {
        return scoreDiff >= 2
          ? { stars: '⭐⭐', label: 'BONNE', desc: 'Respecte hiérarchie' }
          : { stars: '⭐', label: 'CORRECTE', desc: 'Victoire attendue' };
      }
      if (isFavorite && result === 'nul') {
        return { stars: '⚠️', label: 'DÉCEVANT', desc: 'Favori ne gagne pas' };
      }
      if (!isFavorite && result === 'victoire') {
        return { stars: '⭐⭐⭐', label: 'EXPLOIT', desc: 'Victoire outsider !' };
      }
      if (!isFavorite && result === 'nul') {
        return { stars: '⭐⭐', label: 'BON RÉSULTAT', desc: 'Outsider tient tête' };
      }
      return { stars: '✅', label: 'LOGIQUE', desc: 'Résultat attendu' };
    }
    
    if (gap < 250) {
      if (isFavorite && result === 'victoire') {
        return { stars: '✅', label: 'NORMAL', desc: 'Attendu' };
      }
      if (isFavorite && result === 'nul') {
        return { stars: '🚨', label: 'CONTRE-PERFORMANCE', desc: 'Favori échoue' };
      }
      if (!isFavorite && result === 'victoire') {
        return { stars: '⭐⭐⭐⭐', label: 'EXPLOIT MAJEUR', desc: 'Énorme surprise !' };
      }
      if (!isFavorite && result === 'nul') {
        return { stars: '⭐⭐⭐', label: 'EXCELLENT', desc: 'Outsider résiste bien' };
      }
      return { stars: '✅', label: 'LOGIQUE', desc: 'Favori s\'impose' };
    }
    
    if (isFavorite && result === 'victoire') {
      return scoreDiff >= 2
        ? { stars: '✅', label: 'LOGIQUE', desc: 'Domination attendue' }
        : { stars: '⚠️', label: 'DÉCEVANT', desc: 'Aurait dû gagner plus large' };
    }
    if (isFavorite && (result === 'nul' || result === 'defaite')) {
      return { stars: '🚨🚨', label: 'CATASTROPHE', desc: 'Énorme contre-performance' };
    }
    if (!isFavorite && result === 'victoire') {
      return { stars: '⭐⭐⭐⭐', label: 'EXPLOIT HISTORIQUE', desc: 'Incroyable !' };
    }
    
    return { stars: '✅', label: 'NORMAL', desc: '' };
  }
}

export default EloEngine;

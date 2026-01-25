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
    return Math.abs(eloTeam - eloOpponent);
  }

  qualifyPerformance(result, eloTeam, eloOpponent, scoreTeam, scoreOpp) {
    const gap = this.calculateGap(eloTeam, eloOpponent);
    const isFavorite = eloTeam > eloOpponent;
    const scoreDiff = Math.abs(scoreTeam - scoreOpp);
    
    // Équipes de même niveau (<50 écart)
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
    
    // Léger favori (50-150 écart)
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
    
    // Net favori (150-250 écart)
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
    
    // Très net favori (250+ écart)
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

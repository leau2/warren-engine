import React, { useState } from 'react';

const WarrenEngineApp = () => {
  const [matchInput, setMatchInput] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const analyzeMatch = async () => {
    if (!matchInput.trim()) {
      setError('Veuillez saisir un match');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    match: matchInput,
    matchDate: matchDate ? `${matchDate}T12:00:00Z` : null
  })
});

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Erreur analyse');
      }

      setResult(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderVerdict = (verdict) => (
    <div style={{
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      padding: '2rem',
      borderRadius: '1rem',
      marginTop: '2rem'
    }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem', color: 'white' }}>
        🎯 VERDICT FINAL
      </h2>
      
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>Pronostic 1X2</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {verdict['1x2']} <span style={{ fontSize: '1rem', opacity: 0.8 }}>({verdict.confidence_1x2}/10)</span>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>BTTS</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {verdict.btts} <span style={{ fontSize: '1rem', opacity: 0.8 }}>({verdict.confidence_btts}/10)</span>
          </div>
        </div>
        
        <div style={{ background: 'rgba(255,255,255,0.15)', padding: '1rem', borderRadius: '0.5rem' }}>
          <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>Over/Under</div>
          <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
            {verdict.over} <span style={{ fontSize: '1rem', opacity: 0.8 }}>({verdict.confidence_over}/10)</span>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Score attendu :</div>
        <div style={{ fontSize: '1.25rem' }}>{verdict.score_attendu}</div>
        <div style={{ fontSize: '0.875rem', opacity: 0.8, marginTop: '0.25rem' }}>
          Alternatifs : {verdict.scores_alternatifs.join(', ')}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>3 Raisons :</div>
        {verdict.raisons.map((r, i) => (
          <div key={i} style={{ fontSize: '0.875rem', marginLeft: '1rem', marginTop: '0.25rem' }}>
            {i + 1}. {r}
          </div>
        ))}
      </div>

      <div>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>2 Risques :</div>
        {verdict.risques.map((r, i) => (
          <div key={i} style={{ fontSize: '0.875rem', marginLeft: '1rem', marginTop: '0.25rem' }}>
            {i + 1}. {r}
          </div>
        ))}
      </div>
    </div>
  );

  const renderTeamAnalysis = (team, teamNum) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '2px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '1rem',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#10b981' }}>
        {team.teamName} (ELO {team.elo})
      </h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.875rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
          Rating : {team.rating.label}
        </div>
        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          Bilan : {team.record.total.v}V {team.record.total.n}N {team.record.total.d}D
        </div>
        <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
          Forme : {team.formeSummary.quality}
          {team.fatigue && <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
            ⚠️ FATIGUE ({team.fatigue.matchCount} matchs en {team.fatigue.period})
          </span>}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.75rem', color: '#cbd5e1' }}>
          Derniers matchs :
        </div>
        {team.matches.slice(0, 7).map((match, i) => (
  <div key={i} style={{
    fontSize: '0.8rem',
    padding: '0.75rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '0.5rem',
    marginBottom: '0.5rem'
  }}>
    <div style={{ marginBottom: '0.5rem' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>
      vs {match.opponent} (ELO {match.opponentElo})
    </span>
    <span style={{ 
      fontSize: '1rem', 
      fontWeight: '700',
      color: match.result === 'victoire' ? '#10b981' : match.result === 'defaite' ? '#ef4444' : '#f59e0b'
    }}>
      {match.result === 'victoire' ? '✅' : match.result === 'defaite' ? '❌' : '⚖️'}
    </span>
  </div>
  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
    {match.location} • {team.teamName} {match.score.team} - {match.score.opponent} {match.opponent}
  </div>
</div>
    
    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
      {match.performance.stars} {match.performance.label} - Écart {match.eloGap}
    </div>
    
    {/* TOUS LES BUTS */}
    {match.events.allGoals && match.events.allGoals.length > 0 && (
      <div style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
        <div style={{ color: '#10b981', fontWeight: '600' }}>⚽ Buts :</div>
        {match.events.allGoals.map((goal, idx) => (
          <div key={idx} style={{ color: '#cbd5e1', marginLeft: '0.5rem' }}>
            • {goal.minute}' - {goal.isTeam ? team.teamName : match.opponent}
            {goal.detail && goal.detail !== 'Normal Goal' && ` (${goal.detail})`}
          </div>
        ))}
      </div>
    )}
    
    {/* PENALTIES */}
    {match.events.penalties && match.events.penalties.length > 0 && (
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
        <div style={{ color: '#fbbf24', fontWeight: '600' }}>🟡 Penalties :</div>
        {match.events.penalties.map((pen, idx) => (
          <div key={idx} style={{ color: '#fbbf24', marginLeft: '0.5rem' }}>
            • {pen.minute}' - {pen.isTeam ? team.teamName : match.opponent} ({pen.player})
          </div>
        ))}
      </div>
    )}
    
    {/* CARTONS ROUGES */}
    {match.events.redCards && match.events.redCards.length > 0 && (
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
        <div style={{ color: '#ef4444', fontWeight: '600' }}>🔴 Cartons rouges :</div>
        {match.events.redCards.map((red, idx) => (
          <div key={idx} style={{ color: '#ef4444', marginLeft: '0.5rem' }}>
            • {red.minute}' - {red.isTeam ? team.teamName : match.opponent} ({red.player})
          </div>
        ))}
      </div>
    )}

    {/* BUTS REFUSÉS */}
  {match.events.disallowedGoals && match.events.disallowedGoals.length > 0 && (
    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
      <div style={{ color: '#f59e0b', fontWeight: '600' }}>🚫 Buts refusés (VAR) :</div>
      {match.events.disallowedGoals.map((goal, idx) => (
        <div key={idx} style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
          • {goal.minute}' - {goal.isTeam ? team.teamName : match.opponent} ({goal.player}) - {goal.reason}
        </div>
      ))}
    </div>
  )}
    
    {/* BUTS 90'+ */}
    {match.events.goals90Plus && match.events.goals90Plus.length > 0 && (
      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
        <div style={{ color: '#a78bfa', fontWeight: '600' }}>⚡ Buts après 90' :</div>
        {match.events.goals90Plus.map((goal, idx) => (
          <div key={idx} style={{ color: '#a78bfa', marginLeft: '0.5rem' }}>
            • {goal.minute}' - {goal.isTeam ? team.teamName : match.opponent}
          </div>
        ))}
      </div>
    )}
    
    {/* ANALYSE BIAIS (messages Warren) */}
    {match.biases.penalty && (
      <div style={{ 
        color: match.biases.penalty.severity.includes('NEGATIF') ? '#fbbf24' : '#10b981', 
        fontSize: '0.75rem', 
        marginTop: '0.5rem',
        padding: '0.5rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '0.25rem'
      }}>
        💬 {match.biases.penalty.message}
      </div>
    )}
    {match.biases.redCard && (
      <div style={{ 
        color: match.biases.redCard.severity.includes('NEGATIF') ? '#ef4444' : '#10b981', 
        fontSize: '0.75rem', 
        marginTop: '0.25rem',
        padding: '0.5rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '0.25rem'
      }}>
        💬 {match.biases.redCard.message}
      </div>
    )}
    {match.biases.goal90 && (
      <div style={{ 
        color: match.biases.goal90.severity.includes('NEGATIF') ? '#a78bfa' : '#10b981', 
        fontSize: '0.75rem', 
        marginTop: '0.25rem',
        padding: '0.5rem',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '0.25rem'
      }}>
        💬 {match.biases.goal90.message}
      </div>
    )}
  </div>
))}
      </div>
    </div>
  );

  const renderStats = (stats) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      border: '2px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '1rem',
      padding: '1.5rem',
      marginBottom: '1.5rem'
    }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem', color: '#10b981' }}>
        📊 STATISTIQUES BUTS
      </h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>Over 2.5 :</div>
        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
          Équipe 1 : {stats.over25.team1.count}/{stats.over25.team1.total} ({stats.over25.team1.percentage}%)
        </div>
        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
          Équipe 2 : {stats.over25.team2.count}/{stats.over25.team2.total} ({stats.over25.team2.percentage}%)
        </div>
        <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.25rem', fontWeight: '600' }}>
          → Tendance : {stats.over25.tendency}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>BTTS :</div>
        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
          Équipe 1 : {stats.btts.team1.count}/{stats.btts.team1.total} ({stats.btts.team1.percentage}%)
        </div>
        <div style={{ fontSize: '0.875rem', color: '#cbd5e1' }}>
          Équipe 2 : {stats.btts.team2.count}/{stats.btts.team2.total} ({stats.btts.team2.percentage}%)
        </div>
        <div style={{ fontSize: '0.875rem', color: '#10b981', marginTop: '0.25rem', fontWeight: '600' }}>
          → Tendance : {stats.btts.tendency}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#e2e8f0',
      padding: '2rem'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            padding: '0.5rem 1.5rem',
            borderRadius: '2rem',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}>
            ⚡ WARREN ENGINE v1.0
          </div>
          <h1 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem' }}>
            Analyse Football Autonome
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#94a3b8' }}>
            794 équipes ELO chargées • Propulsé par API-Football • Logique Warren codée
          </p>
        </div>

        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '1rem',
          padding: '2rem',
          marginBottom: '2rem'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginBottom: '0.75rem',
              color: '#cbd5e1'
            }}>
              ⚽ Match (format: "Équipe1 vs Équipe2")
            </label>
            <input
              type="text"
              value={matchInput}
              onChange={(e) => setMatchInput(e.target.value)}
              placeholder="Ex: Wolves vs Newcastle"
              disabled={isAnalyzing}
              style={{
                width: '100%',
                padding: '1rem',
                fontSize: '1.125rem',
                background: 'rgba(15, 23, 42, 0.8)',
                border: '2px solid rgba(16, 185, 129, 0.5)',
                borderRadius: '0.75rem',
                color: '#e2e8f0',
                outline: 'none'
              }}
            />
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#64748b', 
              marginTop: '0.5rem' 
            }}>
              💡 ELO chargé automatiquement depuis 794 équipes
            </div>
          </div>

          {/* Champ Date */}
<div style={{ marginBottom: '1.5rem' }}>
  <label style={{
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '600',
    marginBottom: '0.75rem',
    color: '#cbd5e1'
  }}>
    📅 Date du match (optionnel)
  </label>
  <input
    type="date"
    value={matchDate}
    onChange={(e) => setMatchDate(e.target.value)}
    disabled={isAnalyzing}
    style={{
      width: '100%',
      padding: '1rem',
      fontSize: '1rem',
      background: 'rgba(15, 23, 42, 0.8)',
      border: '2px solid rgba(16, 185, 129, 0.5)',
      borderRadius: '0.75rem',
      color: '#e2e8f0',
      outline: 'none'
    }}
  />
  <div style={{ 
    fontSize: '0.75rem', 
    color: '#64748b', 
    marginTop: '0.5rem' 
  }}>
    💡 Laissez vide pour un match à venir. Remplissez pour analyser un match passé.
  </div>
</div>
        
          <button
            onClick={analyzeMatch}
            disabled={isAnalyzing}
            style={{
              width: '100%',
              padding: '1.25rem',
              fontSize: '1.125rem',
              fontWeight: '700',
              background: isAnalyzing
                ? 'rgba(107, 114, 128, 0.5)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '0.75rem',
              color: 'white',
              cursor: isAnalyzing ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {isAnalyzing ? '⚙️ Analyse en cours...' : '🚀 Analyser le match'}
          </button>

          {error && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.5)',
              borderRadius: '0.75rem',
              color: '#fca5a5'
            }}>
              ❌ {error}
            </div>
          )}
        </div>

        {result && (
          <div>
            {renderVerdict(result.verdict)}
            {renderStats(result.stats)}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {renderTeamAnalysis(result.team1, 1)}
              {renderTeamAnalysis(result.team2, 2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WarrenEngineApp;

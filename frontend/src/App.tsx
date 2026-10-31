import { useCallback, useEffect, useRef, useState } from 'react'
import { MoveGlyph } from './MoveGlyph'
import { requestAiMove } from './api'
import { useHandLandmarker } from './useHandLandmarker'
import type { Move, Round, RoundResponse, Score } from './types'
import './App.css'

type Phase = 'idle' | 'waiting' | 'countdown' | 'thinking' | 'result'

const moves: Move[] = ['rock', 'paper', 'scissors']
const emptyScore: Score = { player: 0, ai: 0, draws: 0 }

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14.5 5 13 3H8L6.5 5H3v14h18V5h-6.5Z" />
      <circle cx="11" cy="12" r="4" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4v6h6M5.5 15a7 7 0 1 0 .5-7L4 10" />
    </svg>
  )
}

function App() {
  const {
    videoRef,
    canvasRef,
    cameraStatus,
    cameraError,
    gesture,
    handPresent,
    startCamera,
    stopCamera,
  } = useHandLandmarker()
  const [phase, setPhase] = useState<Phase>('idle')
  const [countdown, setCountdown] = useState(3)
  const [lockedMove, setLockedMove] = useState<Move | null>(null)
  const [result, setResult] = useState<RoundResponse | null>(null)
  const [history, setHistory] = useState<Round[]>([])
  const [score, setScore] = useState<Score>(emptyScore)
  const [gameError, setGameError] = useState<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)
  const autoStartBlockedRef = useRef(false)

  const playMove = useCallback(
    async (move: Move) => {
      const requestId = ++requestIdRef.current
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      setLockedMove(move)
      setResult(null)
      setGameError(null)
      setPhase('thinking')

      try {
        const response = await requestAiMove(move, history.slice(-200), score, controller.signal)
        if (requestId !== requestIdRef.current) return
        setResult(response)
        setHistory((rounds) => [...rounds, response])
        setScore((current) => ({
          player: current.player + (response.outcome === 'win' ? 1 : 0),
          ai: current.ai + (response.outcome === 'loss' ? 1 : 0),
          draws: current.draws + (response.outcome === 'draw' ? 1 : 0),
        }))
        setPhase('result')
      } catch (error) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        autoStartBlockedRef.current = true
        setGameError(error instanceof Error ? error.message : 'The round could not be completed.')
        setPhase(cameraStatus === 'ready' ? 'waiting' : 'idle')
      }
    },
    [cameraStatus, history, score],
  )

  useEffect(() => {
    if (!handPresent) autoStartBlockedRef.current = false
  }, [handPresent])

  useEffect(() => {
    if (phase !== 'waiting' || !handPresent || autoStartBlockedRef.current) return
    const timer = window.setTimeout(() => {
      setGameError(null)
      setCountdown(3)
      setPhase('countdown')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [handPresent, phase])

  useEffect(() => {
    if (phase !== 'countdown') return
    const timer = window.setTimeout(() => {
      if (countdown > 1) setCountdown((value) => value - 1)
      else if (gesture) void playMove(gesture)
      else {
        autoStartBlockedRef.current = true
        setGameError('No clear move at zero. Remove your hand, then re-enter the frame to try again.')
        setPhase('waiting')
      }
    }, 800)
    return () => window.clearTimeout(timer)
  }, [countdown, gesture, phase, playMove])

  useEffect(() => () => requestRef.current?.abort(), [])

  const handleStartCamera = async () => {
    autoStartBlockedRef.current = false
    setGameError(null)
    setResult(null)
    setLockedMove(null)
    if (cameraStatus === 'ready') {
      stopCamera()
      setPhase('idle')
      return
    }
    await startCamera()
    setPhase('waiting')
  }

  const nextRound = () => {
    autoStartBlockedRef.current = false
    setResult(null)
    setLockedMove(null)
    setGameError(null)
    setPhase(cameraStatus === 'ready' ? 'waiting' : 'idle')
  }

  const resetMatch = () => {
    autoStartBlockedRef.current = false
    requestIdRef.current += 1
    requestRef.current?.abort()
    setHistory([])
    setScore(emptyScore)
    setResult(null)
    setLockedMove(null)
    setGameError(null)
    setPhase(cameraStatus === 'ready' ? 'waiting' : 'idle')
  }

  const detectionLabel = !handPresent
    ? 'Bring your hand into frame to start'
    : !gesture
      ? 'Make any clear hand gesture'
      : `${gesture} detected`

  const outcomeCopy = result?.outcome === 'win'
    ? 'You win this round'
    : result?.outcome === 'loss'
      ? 'Adaptive AI takes this round'
      : 'A perfect tie'

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="RPS Vision home">
          <span className="brand-mark">RPS</span>
          <span>VISION</span>
        </a>
        <div className="tech-status">
          <span><i /> MediaPipe vision</span>
          <span><i /> Adaptive AI decisions</span>
        </div>
        <button className="icon-button" onClick={resetMatch} title="Reset match" aria-label="Reset match">
          <ResetIcon />
        </button>
      </header>

      <main id="top">
        <section className="intro">
          <div>
            <p className="eyebrow">A classic game, reimagined</p>
            <h1>Your hand.<br /><span>Its move.</span></h1>
          </div>
          <p className="intro-copy">
            Bring your hand into frame to start the countdown. Make or change your move before zero,
            then see what Adaptive AI decides.
          </p>
        </section>

        <section className="game-card" aria-label="Rock paper scissors game">
          <div className="scorebar">
            <div className="score-block player-score">
              <span className="score-label">You</span>
              <strong>{String(score.player).padStart(2, '0')}</strong>
            </div>
            <div className="round-block">
              <span>Round {String(history.length + (phase === 'result' ? 0 : 1)).padStart(2, '0')}</span>
              <span className="draw-count">{score.draws} draws</span>
            </div>
            <div className="score-block ai-score">
              <span className="score-label">Adaptive AI</span>
              <strong>{String(score.ai).padStart(2, '0')}</strong>
            </div>
          </div>

          <div className="arena">
            <section className="camera-panel">
              <div className="panel-heading">
                <span>01 / Your move</span>
                <span className={`status-dot ${cameraStatus}`}>
                  {cameraStatus === 'ready' ? 'Live' : cameraStatus === 'loading' ? 'Loading' : 'Camera off'}
                </span>
              </div>

              <div className={`camera-viewport ${cameraStatus === 'ready' ? 'is-live' : ''}`}>
                <video ref={videoRef} muted playsInline aria-label="Your webcam view" />
                <canvas ref={canvasRef} aria-hidden="true" />
                {cameraStatus !== 'ready' && (
                  <div className="camera-placeholder">
                    <div className="camera-icon"><CameraIcon /></div>
                    <strong>{cameraStatus === 'loading' ? 'Starting vision' : 'Your camera is off'}</strong>
                    <span>{cameraStatus === 'loading' ? 'Loading the hand landmark model…' : 'Start it when you’re ready to play'}</span>
                  </div>
                )}
                {phase === 'countdown' && (
                  <div className="countdown-overlay" aria-live="assertive">
                    <span>Choose your move</span>
                    <strong key={countdown}>{countdown}</strong>
                    <small>{gesture ? `${gesture} selected` : 'Rock, paper, or scissors'}</small>
                  </div>
                )}
                <div className="viewfinder" aria-hidden="true"><i /><i /><i /><i /></div>
              </div>

              <div className="camera-controls">
                <div className="detection-status" aria-live="polite">
                  {phase === 'countdown' && gesture ? (
                    <MoveGlyph move={gesture} size={28} />
                  ) : phase === 'thinking' && lockedMove ? (
                    <MoveGlyph move={lockedMove} size={28} />
                  ) : <span className={`pulse-dot ${handPresent ? 'active' : ''}`} />}
                  <span>
                    {phase === 'countdown'
                      ? gesture
                        ? `${gesture} — you can change until zero`
                        : 'Choose your move before zero'
                      : phase === 'thinking'
                        ? lockedMove
                        : cameraStatus === 'ready'
                          ? detectionLabel
                          : 'Camera gesture input'}
                  </span>
                </div>
                <button
                  className="button button-small button-outline"
                  onClick={() => void handleStartCamera()}
                  disabled={cameraStatus === 'loading' || phase === 'countdown' || phase === 'thinking'}
                >
                  {cameraStatus === 'ready' ? 'Stop camera' : cameraStatus === 'loading' ? 'Starting…' : 'Start camera'}
                </button>
              </div>
            </section>

            <section className={`ai-panel ${phase}`}>
              <div className="panel-heading">
                <span>02 / Adaptive AI’s move</span>
                <span className="model-label">Pattern ensemble</span>
              </div>

              <div className="ai-stage">
                {phase === 'thinking' ? (
                  <div className="thinking-state">
                    <div className="thinking-orbit"><span /><span /><span /></div>
                    <strong>Adaptive AI is deciding</strong>
                    <span>Reading your previous rounds</span>
                  </div>
                ) : result ? (
                  <div className="ai-result">
                    <div className="result-move-icon"><MoveGlyph move={result.aiMove} size={104} /></div>
                    <span className="result-move-name">{result.aiMove}</span>
                  </div>
                ) : (
                  <div className="ai-idle">
                    <div className="ai-symbol"><span>A</span><i /><i /></div>
                    <strong>{phase === 'countdown' ? 'Ready for the reveal' : 'Waiting for your move'}</strong>
                    <span>{phase === 'countdown' ? 'The current move stays hidden from Adaptive AI' : 'Your rival is standing by'}</span>
                  </div>
                )}
              </div>

              <div className="ai-footer">
                {result ? (
                  <>
                    <div className="confidence-heading">
                      <span>Prediction strength</span>
                      <strong>{Math.round(result.confidence * 100)}%</strong>
                    </div>
                    <div className="probability-list">
                      {moves.map((move) => (
                        <div className="probability" key={move}>
                          <span>{move}</span>
                          <div><i style={{ width: `${Math.round((result.probabilities[move] ?? 0) * 100)}%` }} /></div>
                          <span>{Math.round((result.probabilities[move] ?? 0) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="privacy-note">
                    <span className="shield-icon">✓</span>
                    <span>Only game history is shared with Adaptive AI.<br />Your video never leaves this browser.</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {(gameError || cameraError) && (
            <div className="error-banner" role="alert">
              <span>{gameError ?? cameraError}</span>
              {gameError && (
                <button
                  className="error-retry"
                  onClick={() => {
                    autoStartBlockedRef.current = false
                    setGameError(null)
                    setLockedMove(null)
                    setPhase(cameraStatus === 'ready' ? 'waiting' : 'idle')
                  }}
                >
                  Try again
                </button>
              )}
            </div>
          )}

          {phase === 'result' && result && (
            <div className={`round-result ${result.outcome}`} aria-live="polite">
              <div className="round-moves">
                <MoveGlyph move={result.playerMove} size={32} />
                <span>{result.playerMove}</span>
                <i>vs</i>
                <span>{result.aiMove}</span>
                <MoveGlyph move={result.aiMove} size={32} />
              </div>
              <strong>{outcomeCopy}</strong>
              <button className="button button-primary button-small" onClick={nextRound}>Next round</button>
            </div>
          )}

          <div className="manual-controls">
            <span>Or choose your move</span>
            <div className="move-buttons">
              {moves.map((move) => (
                <button
                  key={move}
                  className="move-button"
                  onClick={() => void playMove(move)}
                  disabled={phase === 'countdown' || phase === 'thinking'}
                >
                  <MoveGlyph move={move} size={32} />
                  <span>{move}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="history-section">
          <div className="section-heading">
            <h2>Round history</h2>
            <span>{history.length ? `${history.length} played` : 'No rounds yet'}</span>
          </div>
          {history.length ? (
            <div className="history-list">
              {[...history].reverse().slice(0, 6).map((round, index) => (
                <div className="history-item" key={`${history.length - index}-${round.playerMove}-${round.aiMove}`}>
                  <span className="history-round">{String(history.length - index).padStart(2, '0')}</span>
                  <MoveGlyph move={round.playerMove} size={28} title={`You played ${round.playerMove}`} />
                  <span className="history-dash">—</span>
                  <MoveGlyph move={round.aiMove} size={28} title={`Adaptive AI played ${round.aiMove}`} />
                  <span className={`history-outcome ${round.outcome}`}>{round.outcome}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-history">Your completed rounds will appear here.</div>
          )}
        </section>
      </main>

      <footer>
        <span>RPS / VISION</span>
        <span>MediaPipe landmarks · Adaptive pattern engine · Rock, paper, scissors</span>
      </footer>
    </div>
  )
}

export default App

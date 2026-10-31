import type { Move, Outcome, Round, RoundResponse, Score } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export async function requestAiMove(
  playerMove: Move,
  history: Round[],
  score: Score,
  signal: AbortSignal,
): Promise<RoundResponse> {
  let response: Response
  try {
    response = await fetch(`${API_URL}/api/ai-move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_move: playerMove,
        history: history.map((round) => ({
          player_move: round.playerMove,
          ai_move: round.aiMove,
          outcome: round.outcome,
        })),
        score,
      }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Cannot reach the AI backend. Start it on port 8000 and try again.')
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(body?.detail ?? 'The AI backend is unavailable. Check that it is running.')
  }

  const data = (await response.json()) as {
    player_move: Move
    ai_move: Move
    outcome: Outcome
    confidence: number
    probabilities: Partial<Record<Move, number>>
  }
  return {
    playerMove: data.player_move,
    aiMove: data.ai_move,
    outcome: data.outcome,
    confidence: data.confidence,
    probabilities: data.probabilities,
  }
}

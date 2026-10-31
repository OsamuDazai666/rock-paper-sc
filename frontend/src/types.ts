export type Move = 'rock' | 'paper' | 'scissors'
export type Outcome = 'win' | 'loss' | 'draw'

export interface Round {
  playerMove: Move
  aiMove: Move
  outcome: Outcome
}

export interface Score {
  player: number
  ai: number
  draws: number
}

export interface RoundResponse extends Round {
  confidence: number
  probabilities: Partial<Record<Move, number>>
}

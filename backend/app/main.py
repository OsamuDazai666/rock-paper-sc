import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .decision import STRATEGY_NAME, AdaptiveEngine
from .game import Move, Outcome, resolve_round

logger = logging.getLogger(__name__)
app = FastAPI(title="RPS Vision API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)
engine = AdaptiveEngine()


class PreviousRound(BaseModel):
    player_move: Move
    ai_move: Move
    outcome: Outcome


class Score(BaseModel):
    player: int = Field(ge=0)
    ai: int = Field(ge=0)
    draws: int = Field(ge=0)


class PlayRequest(BaseModel):
    player_move: Move
    history: list[PreviousRound] = Field(default_factory=list, max_length=200)
    score: Score


class PlayResponse(BaseModel):
    player_move: Move
    ai_move: Move
    outcome: Outcome
    confidence: float
    probabilities: dict[Move, float]


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "strategy": STRATEGY_NAME}


@app.post("/api/ai-move")
async def play_round(request: PlayRequest) -> PlayResponse:
    history = [round_.model_dump() for round_ in request.history]
    try:
        ai_move, confidence, probabilities = await engine.choose_move(
            history,
            request.score.model_dump(),
        )
    except Exception as error:
        logger.exception("Adaptive strategy failed")
        raise HTTPException(
            status_code=503,
            detail="The adaptive opponent could not choose a move. Check the backend logs and try again.",
        ) from error

    return PlayResponse(
        player_move=request.player_move,
        ai_move=ai_move,
        outcome=resolve_round(request.player_move, ai_move),
        confidence=confidence,
        probabilities=probabilities,
    )

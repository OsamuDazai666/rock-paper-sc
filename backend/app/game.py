from typing import Literal

Move = Literal["rock", "paper", "scissors"]
Outcome = Literal["win", "loss", "draw"]

BEATS: dict[str, str] = {
    "rock": "scissors",
    "paper": "rock",
    "scissors": "paper",
}


def resolve_round(player_move: Move, ai_move: Move) -> Outcome:
    if player_move == ai_move:
        return "draw"
    if BEATS[player_move] == ai_move:
        return "win"
    return "loss"

import math
import random

from .game import BEATS, Move

MOVES: tuple[Move, ...] = ("rock", "paper", "scissors")
EXPERTS = ("uniform", "frequency", "order_one", "order_two", "outcome", "ai_move")
STRATEGY_NAME = "adaptive-pattern-ensemble"
Distribution = dict[Move, float]
History = list[dict[str, str]]


def uniform() -> Distribution:
    return {move: 1 / len(MOVES) for move in MOVES}


def normalize(counts: Distribution) -> Distribution:
    total = sum(counts.values())
    return {move: counts[move] / total for move in MOVES}


def transition_distribution(history: History, context: str) -> Distribution:
    counts = {move: 1.0 for move in MOVES}
    if not history:
        return uniform()

    for index, round_ in enumerate(history[:-1]):
        if round_.get(context) != history[-1].get(context):
            continue
        next_move = history[index + 1]["player_move"]
        if next_move in MOVES:
            counts[next_move] += 1
    return normalize(counts)


def sequence_distribution(history: History, order: int) -> Distribution:
    if len(history) < order + 1:
        return uniform()
    context = tuple(round_["player_move"] for round_ in history[-order:])
    counts = {move: 1.0 for move in MOVES}
    for index in range(len(history) - order):
        candidate = tuple(round_["player_move"] for round_ in history[index:index + order])
        if candidate == context:
            counts[history[index + order]["player_move"]] += 1
    return normalize(counts)


def frequency_distribution(history: History) -> Distribution:
    counts = {move: 1.0 for move in MOVES}
    for round_ in history:
        counts[round_["player_move"]] += 1
    return normalize(counts)


def predict_expert(expert: str, history: History) -> Distribution:
    if expert == "uniform":
        return uniform()
    if expert == "frequency":
        return frequency_distribution(history)
    if expert == "order_one":
        return sequence_distribution(history, 1)
    if expert == "order_two":
        return sequence_distribution(history, 2)
    if expert in {"outcome", "ai_move"}:
        return transition_distribution(history, expert)
    raise ValueError(f"Unknown prediction expert: {expert}")


def expert_weights(history: History) -> dict[str, float]:
    log_scores = {expert: 0.0 for expert in EXPERTS}
    for index, round_ in enumerate(history):
        actual = round_["player_move"]
        for expert in EXPERTS:
            prediction = predict_expert(expert, history[:index])
            log_scores[expert] += math.log(max(prediction[actual], 1e-9))

    best_score = max(log_scores.values())
    weights = {expert: math.exp(score - best_score) for expert, score in log_scores.items()}
    total = sum(weights.values())
    return {expert: weight / total for expert, weight in weights.items()}


def predict_player(history: History) -> Distribution:
    if len(history) < 3:
        return uniform()
    weights = expert_weights(history)
    ensemble = {
        move: sum(weights[expert] * predict_expert(expert, history)[move] for expert in EXPERTS)
        for move in MOVES
    }
    evidence = min(1.0, (len(history) - 2) / 10)
    return {
        move: evidence * ensemble[move] + (1 - evidence) / len(MOVES)
        for move in MOVES
    }


def counter_policy(player_prediction: Distribution) -> Distribution:
    payoffs = {
        ai_move: sum(
            player_prediction[player_move]
            * (1 if BEATS[ai_move] == player_move else -1 if BEATS[player_move] == ai_move else 0)
            for player_move in MOVES
        )
        for ai_move in MOVES
    }
    scaled = {move: math.exp(payoff / 0.12) for move, payoff in payoffs.items()}
    return normalize(scaled)


def sample_move(policy: Distribution) -> Move:
    target = random.SystemRandom().random()
    cumulative = 0.0
    for move in MOVES:
        cumulative += policy[move]
        if target <= cumulative:
            return move
    return MOVES[-1]


class AdaptiveEngine:
    async def choose_move(
        self,
        history: History,
        score: dict[str, int],
    ) -> tuple[Move, float, Distribution]:
        del score
        prediction = predict_player(history)
        policy = counter_policy(prediction)
        return sample_move(policy), max(prediction.values()), policy

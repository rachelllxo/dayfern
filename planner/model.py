"""Deterministic, L2-regularized least squares fitted to personal completed tasks."""
from math import log1p, expm1
from statistics import mean, median

KINDS = ("Revision", "Coding", "Reading", "Writing", "Practice", "Other")
METHODS = ("estimate", "personal", "ridge")
MIN_TRAIN = 12
MAX_TRAIN = 96


def features(task, subjects):
    return [log1p(task["estimate"])] + [float(task["kind"] == k) for k in KINDS] + [
        float(task["subject"].casefold() == s) for s in subjects
    ]


class Predictor:
    def __init__(self, history):
        self.history = history[-MAX_TRAIN:]
        self.subjects = sorted({r["subject"].casefold() for r in self.history})[:12]
        self.weights = []
        if len(self.history) < MIN_TRAIN:
            return
        rows = [features(r, self.subjects) for r in self.history]
        y = [log1p(r["actual"]) for r in self.history]
        self.bias = mean(y)
        self.centers = list(map(mean, zip(*rows)))
        columns = [[r[j] - center for r in rows] for j, center in enumerate(self.centers)]
        residual = [value - self.bias for value in y]
        self.weights = [0.] * len(columns)
        # Coordinate descent on centered log duration with a fixed L2 penalty.
        for _ in range(40):
            largest = 0.
            for j, col in enumerate(columns):
                norm = sum(x*x for x in col)
                old = self.weights[j]
                weight = (sum(x*r for x, r in zip(col, residual)) + old*norm) / (norm+2.)
                delta = weight-old
                self.weights[j] = weight
                if delta:
                    residual = [r-delta*x for r, x in zip(residual, col)]
                largest = max(largest, abs(delta))
            if largest < 0.00001:
                break

    def predict(self, task):
        estimate = task["estimate"]
        comparable = [r for r in self.history if r["kind"] == task["kind"]]
        personal = estimate
        if len(comparable) >= 3:
            personal *= median(r["actual"]/r["estimate"] for r in comparable)
        values = {"estimate": estimate, "personal": personal}
        if self.weights:
            values["ridge"] = expm1(min(12., self.bias + sum(
                w*(x-m) for x, w, m in zip(features(task, self.subjects), self.weights, self.centers))))
        return {key: max(1, min(1440, round(value))) for key, value in values.items()}


def evaluate(history):
    errors = {k: [] for k in METHODS}
    # Forecast each held-out task using only outcomes available when it was created.
    for task in sorted(history, key=lambda t: t["created"])[-12:]:
        prior = [r for r in history if r["done"] < task["created"]]
        if len(prior) < MIN_TRAIN:
            continue
        for key, predicted in Predictor(prior).predict(task).items():
            errors[key].append(abs(predicted-task["actual"]))
    n = len(errors["ridge"])
    scores = {k: round(mean(v), 2) for k, v in errors.items() if v}
    winner = min(scores, key=scores.get) if n >= 5 else None
    return {"count": n, "mae": scores, "winner": winner}

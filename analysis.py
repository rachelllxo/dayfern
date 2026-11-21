"""Descriptive statistics and deterministic, two-cluster daily routine discovery."""
from datetime import date
from math import dist
from statistics import mean, pstdev

LIMITS = {"screen": 1440, "focus": 1440, "pickups": 2500, "mood": 5}


def validate(rows):
    if not isinstance(rows, list) or len(rows) > 3660:
        raise ValueError("Provide up to 3,660 daily entries.")
    dates = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Invalid daily entry.")
        day = row.get("date")
        if not isinstance(day, str) or date.fromisoformat(day).isoformat() != day or day in dates:
            raise ValueError("Each entry needs a unique ISO date.")
        dates.add(day)
        for key, maximum in LIMITS.items():
            v = row.get(key)
            if type(v) is not int or not (int(key == "mood") <= v <= maximum):
                raise ValueError(f"Invalid value for {key}.")


def analyze(rows):
    validate(rows)
    rows = sorted(rows, key=lambda r: r["date"])
    averages = {k: round(mean(r[k] for r in rows), 1) for k in LIMITS} if rows else {}
    result = {"count": len(rows), "averages": averages, "pattern": None}
    if len(rows) < 6:
        return result
    keys = ("screen", "focus", "pickups")
    centers = [mean(r[k] for r in rows) for k in keys]
    scales = [pstdev(r[k] for r in rows) or 1 for k in keys]
    points = [tuple((r[k]-m)/s for k, m, s in zip(keys, centers, scales)) for r in rows]
    a = min(points)
    b = max(points, key=lambda p: dist(p, a))
    if a == b:
        return result
    for _ in range(50):
        labels = [int(dist(p, b) < dist(p, a)) for p in points]
        groups = [[p for p, label in zip(points, labels) if label == i] for i in (0, 1)]
        new = [tuple(map(mean, zip(*group))) for group in groups]
        if new == [a, b]:
            break
        a, b = new
    profiles = []
    for label in (0, 1):
        members = [r for r, i in zip(rows, labels) if i == label]
        profiles.append({"days": len(members), **{k: round(mean(r[k] for r in members)) for k in keys}})
    if min(p["days"] for p in profiles) >= 2:
        result["pattern"] = sorted(profiles, key=lambda p: p["screen"])
    return result

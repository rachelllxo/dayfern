import json
import mimetypes
import os
from pathlib import Path
from wsgiref.simple_server import make_server

from analysis import analyze
from planner.service import plan

WEB = Path(__file__).parent / "web"


def application(env, start):
    path = env["PATH_INFO"]
    method = env["REQUEST_METHOD"]
    status, mime = "200 OK", "application/json"
    if path in ("/api/analyze", "/api/plan") and method == "POST":
        try:
            length = int(env.get("CONTENT_LENGTH") or 0)
            if not 0 < length <= 600000:
                raise ValueError("Invalid payload size.")
            rows = json.loads(env["wsgi.input"].read(length))
            body = json.dumps(plan(rows) if path == "/api/plan" else analyze(rows)).encode()
        except (ValueError, TypeError, RecursionError) as exc:
            status = "400 Bad Request"
            body = json.dumps({"error": str(exc)}).encode()
    elif path == "/health" and method == "GET":
        body = b'{"ok":true}'
    elif method == "GET" and path in ("/", "/wellbeing", "/planner.js", "/state.mjs", "/planner.css", "/app.js", "/styles.css", "/meadow.png", "/favicon.svg"):
        target = WEB / ({"/": "index.html", "/wellbeing": "wellbeing.html"}.get(path, path[1:]))
        body = target.read_bytes()
        mime = "text/javascript" if target.suffix == ".mjs" else mimetypes.guess_type(target)[0] or "application/octet-stream"
    else:
        status, body = "404 Not Found", b'{"error":"Unknown endpoint"}'
    start(status, [("Content-Type", mime), ("Content-Length", str(len(body))), ("Cache-Control", "no-store" if mime == "application/json" else "no-cache"), ("X-Content-Type-Options","nosniff")])
    return [body]


if __name__ == "__main__":
    with make_server("0.0.0.0", int(os.getenv("PORT", "8000")), application) as server:
        server.serve_forever()

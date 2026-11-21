# Dayfern

A personal digital wellbeing journal with a Python analysis service and a responsive vanilla JavaScript dashboard. A 30-day sample journal lets you explore the charts before starting your own.

## Run locally

Install Python 3.10 or later. From this folder run:

```sh
python app.py
```

Open http://localhost:8000. No build step, database or API key is needed. Use the same browser and address to revisit your journal.

## Using Dayfern

1. Choose **Add check-in**. Enter your screen time, focus time, phone pickups and mood for a date. Copy device totals manually from your usage report.
2. Use **Overview** to compare activity over 7, 14 or 30 calendar days. Averages use logged days. Gaps in the chart represent missing entries.
3. Open **Patterns** for a comparison of recurring daily routines.
4. Open **Check-in journal** to edit, delete, export or import entries. JSON import merges records and rejects overlapping dates before making changes.

## Analysis and privacy

The server standardizes screen time, focus time and pickups and fits a deterministic two-cluster k-means model to the selected period. Mood is summarized separately. A comparison needs six logged days, varied observations and at least two days per group. These are exploratory associations.

Personal records persist in browser local storage. The browser sends entries to the same-origin Python service for validation and analysis. The application processes them in memory. Export a JSON backup before clearing browser data, changing domains or moving to another device. A shared browser profile shares the journal.

## GitHub and Render

The downloadable archive includes a Git checkout with commit history. After extracting it, open a terminal inside the dayfern folder. With GitHub CLI installed and authenticated, publish a private copy:

```sh
gh repo create dayfern --private --source=. --remote=origin --push
```

In Render, choose **New → Blueprint**, connect that repository and select the main branch. Review the free web service defined in render.yaml and deploy it. Render installs Gunicorn, binds the service to its assigned port and checks /health. Open the service URL after deployment completes. Free services may take time to wake after inactivity.

## Verification

```sh
python -m unittest -v
node --check web/app.js
```

## Project structure

- app.py serves static assets and accepts JSON arrays at POST /api/analyze.
- analysis.py validates daily entries, calculates averages and discovers routine groups.
- web/ contains the browser UI, chart renderer and bundled meadow illustration.
- test_analysis.py covers the clustering boundaries and invalid input.
- render.yaml and requirements.txt configure production hosting.

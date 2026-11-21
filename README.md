# Dayfern

A personal digital wellbeing journal with a Python analysis service and a responsive vanilla JavaScript dashboard. A 30-day sample journal lets you explore the charts before starting your own.

## Run locally

Install Python 3.10 or later. From this folder run:

```sh
python app.py
```

Open https://dayfern.onrender.com/. No build step, database or API key is needed. Use the same browser and address to revisit your journal.

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

## Website 
<img width="1332" height="596" alt="{58F17C1C-CC4C-4E75-BE79-86DFA576467F}" src="https://github.com/user-attachments/assets/ba82de96-8632-40b3-82a7-c4c62a867ec0" />
<img width="1331" height="571" alt="{3B08476B-407E-4AB4-88EB-2FCF5BA97790}" src="https://github.com/user-attachments/assets/e73f2f65-1146-402f-9988-94c965f6fad5" />
<img width="1334" height="582" alt="{7236C13B-BEEC-4CE8-BC7A-F365B3022C94}" src="https://github.com/user-attachments/assets/4fa0baac-f086-49f3-9cc9-7380917ad0b3" />
<img width="1338" height="599" alt="{4F46FC31-86F3-499B-A3D4-6320B0E0F2E0}" src="https://github.com/user-attachments/assets/498d94ae-a73b-4030-95fc-0f4a7253f0ab" />
<img width="1323" height="582" alt="{009E41FE-2CFA-41EC-B322-69220911931F}" src="https://github.com/user-attachments/assets/76409f42-9b16-4e03-8fba-dbeaa90e419e" />






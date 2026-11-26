# Dayfern personalized study planner

Dayfern plans study sessions from task deadlines, remaining availability and personal duration estimates. The Python service returns a schedule and evaluates three forecasting methods. Tasks, timing history and wellbeing entries are kept in the current browser profile. The included demo uses invented data in a separate in-memory workspace.

## Run on Windows, macOS or Linux

Extract the ZIP first. Open a terminal **inside Dayfern-Planner**, where app.py and render.yaml are located. Use Python 3.10 or later.

```sh
python app.py
```

Windows users with the Python launcher can run `py app.py`. Open **http://localhost:8000** in a modern browser. Press Ctrl+C in the terminal to stop. The local development server uses the Python standard library. Node.js is only needed if you want to run the JavaScript tests. Use localhost locally and HTTPS on a hosted service so browser APIs such as crypto.randomUUID are available.

## Try the application

1. Open **Explore sample** for a synthetic workspace with 23 measured tasks and three open tasks. Open **Weekly review** for a populated model comparison. **Back to my planner** returns to your personal data. The sample resets after a reload.
2. Choose **Add task**. Enter the subject, type, initial estimate, priority and deadline. Use a consistent subject spelling. Optional date and time fields reserve the task’s first study block.
3. In **Today**, set a start time, available minutes and preferred session length. The date follows the browser’s local calendar. A window never crosses midnight. The schedule starts at the later of the configured time and the current minute. If the window has passed, change the start time or increase availability.
4. Select **Start focus** or **Start / resume**. Pause when you stop working. Reloading the same site retains a running timer. If the page is closed while the timer runs, elapsed wall-clock time still counts. Only one task can run at a time. Pausing leaves a task open. Use **Finish** when all work on the task is complete. An abandoned task keeps its recorded sessions for activity totals.
5. To replan, edit a task’s deadline, priority, reservation or revised time left. A revision applies to future planning and preserves the original estimate for comparison. Revisions decrease as new active minutes accumulate. For an unfinished task that exceeds its estimate, the planner reserves a minimum of one minute until you revise the remaining work.
6. Open **Weekly review** to compare estimated and actual minutes and check the model evaluation. Export a planner backup before clearing browser data. Import validates a backup and asks before replacing the selected workspace. Exporting writes a paused snapshot of an active timer while the original timer continues.
7. Open **Wellbeing journal** for the existing check-in, chart, clustering, import and export features. Its storage key is unchanged. Deploy to the same site origin and use the same browser profile to retain previous wellbeing data.

## Publish through GitHub and deploy on Render

### Updating your existing rachelllxo/dayfern repository

Clone or open **your existing GitHub checkout**. Copy the extracted application files and folders into its root, replacing the old application files. Skip the extracted .git folder so the destination checkout retains its own branch, history and GitHub remote. Include planner/, tests/, web/, .gitignore and the root files. Do not place the entire Dayfern-Planner folder inside the existing checkout. Confirm that app.py, requirements.txt and render.yaml are at the repository root.

From the destination checkout, review and commit the update:

```sh
git status
git add .
git diff --cached --stat
git commit -m "Upgrade Dayfern to a personalized study planner"
git push origin main
```

If updating through the GitHub website, upload the extracted source files and folders to the repository root and enter the same commit message. A ZIP uploaded as the only file cannot be executed as this application.

### Creating a new GitHub repository instead

The extracted project includes clean local Git history and has no remote. To publish it to a new empty repository using the authenticated GitHub CLI, run the following from the extracted Dayfern-Planner folder:

```sh
gh repo create dayfern-study-planner --private --source=. --remote=origin --push
```

### Render service settings

For a new deployment, open the Render dashboard, select **New → Blueprint**, connect the GitHub repository, select **main** and keep **render.yaml** as the Blueprint path. Review the proposed single free Python web service, then select **Deploy Blueprint**. If your existing Render service already tracks this branch, open that service and verify the deployment of your new commit. Use its manual deployment option if automatic deployment is disabled.

| Setting | Value |
|---|---|
| Runtime | Python |
| Root directory | Repository root (leave blank) |
| Build command | pip install -r requirements.txt |
| Start command | gunicorn --bind 0.0.0.0:$PORT --workers 2 app:application |
| Health check | /health |
| Instance | Free |
| External database or model keys | None required |

Visit the assigned HTTPS URL and then /health, which returns {"ok":true}. Open the demo, generate a schedule, save a personal task, start and pause the timer, refresh and confirm the task persists. Free services can take time to wake. Configuration reference: https://render.com/docs/infrastructure-as-code

## Personalization and evaluation

The original estimate, subject and type are fixed after task creation. A completion includes the sum of all its active sessions. The training history excludes open tasks, abandoned tasks and completions with no recorded time. A task marked complete after timing only part of the work will supply an incomplete target. Users should track all sessions for meaningful results.

The **manual baseline** uses the original estimate. The **personal correction** multiplies the estimate by the median actual-to-estimated ratio for that type once three comparable tasks exist, using up to 96 recent measured completions. **Ridge regression** is implemented in Python with a centered intercept, L2 penalty of 2 and coordinate descent. It models log(1 + actual minutes) using log(1 + estimated minutes), type indicators and up to 12 subject indicators. Unknown subjects have zero subject indicators. Predictions are rounded and bounded to 1–1,440 minutes. Mood is not used to predict productivity.

For evaluation, the service examines the last 12 measured tasks by creation time. For each, all methods see only outcomes completed strictly before that task was created. At least 12 such training records are required for an evaluated prediction. All three methods are scored on identical eligible tasks. The metric is **mean absolute error in minutes**. After five eligible comparisons, the lowest observed MAE determines the method for pending tasks. Before that, the planner uses personal correction when eligible and otherwise uses the manual estimate. Results on these comparisons are for model selection. Reserve an additional later period if reporting independent generalization accuracy in a dissertation. The sample workspace is a demonstration rather than empirical evidence about real students.

The scheduler subtracts active minutes from the predicted total, honors valid reservations and allocates remaining capacity by earliest deadline, then highest priority. It displays unfinished minutes explicitly. Fixed reservations apply to a first block, future reserved tasks are deferred, and conflicting reservations require an adjustment. Each generated block is at most the preferred session length. Adjacent blocks have no automatic break allowance. Availability should reflect usable study time. The weekly review counts active time by calendar day and compares estimates with full session totals for measured tasks finished in the last seven days.

## Project structure

```text
Dayfern-Planner/
  app.py                   WSGI application and development entry point
  analysis.py              Wellbeing statistics and routine clustering
  planner/
    __init__.py
    model.py               Manual baseline, personal correction, ridge and evaluation
    service.py             Input validation, forecasts and bounded scheduling
  web/
    index.html             Planner, task dialog and navigation
    planner.js             Today, tasks, review and backup interactions
    state.mjs              Timer state, session accounting and sample data
    planner.css            Responsive planner styles
    wellbeing.html         Original wellbeing application
    app.js                 Wellbeing journal and visualizations
    styles.css             Wellbeing layout
    meadow.png             Bundled illustration
    favicon.svg            Dayfern mark
  tests/
    __init__.py
    test_planner.py        Forecasting, scheduling and service checks
    state.test.mjs         JavaScript timer and backup tests
  test_analysis.py         Wellbeing analysis tests
  requirements.txt         Production WSGI server dependency
  render.yaml              Render Blueprint
  README.md
  .gitignore
```

## Verify the code

```sh
python -m unittest -v
node --test tests/state.test.mjs
node --check web/planner.js
node --check web/app.js
```

Use Node 22 or later for the JavaScript checks. Git history is available with git log --oneline.

## Storage and service boundaries

The production service is stateless. Browser local storage persists records on one origin and profile; there is no account or cross-device synchronization. The browser sends task metadata and timing totals to the same-origin Python API when generating a plan. Raw session intervals remain client-side. The planner supports up to 1,000 tasks. A restore accepts up to 50,000 session intervals and a 6 MB backup. The API limits each submitted JSON body to 600,000 bytes. The separate wellbeing endpoint retains its own validation rules. The two workspaces use separate export formats.

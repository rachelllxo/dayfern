from io import BytesIO
import json
import unittest

from app import application
from planner.model import Predictor
from planner.service import plan


def task(i, **extra):
    return dict({"id": str(i), "title": "Study", "subject": "CS", "kind": "Coding",
                 "estimate": 30, "priority": 2, "due": "2026-11-27", "created": i*1000,
                 "state": "open", "seconds": 0}, **extra)


def request(rows, **opts):
    settings = dict(date="2026-11-26", start=540, nowMinute=530, available=90, block=25)
    return plan({"tasks": rows, "settings": {**settings, **opts}})


class PlannerTests(unittest.TestCase):
    def test_cold_start_and_deadline(self):
        data = request([task(1), task(2, due="2026-11-26")], available=35)
        self.assertEqual(data["slots"][0]["id"], "2")
        self.assertEqual(data["forecasts"]["1"]["method"], "estimate")
        self.assertEqual(data["deferred"], {"1": 25})

    def test_completed_history_and_partial(self):
        done = [task(i,state="done",seconds=3600,done=i*1000+10) for i in range(3)]
        data = request(done+[task(4,seconds=900),task(5,state="abandoned",seconds=900)])
        self.assertEqual(data["forecasts"]["4"],dict(minutes=60,remaining=45,method="personal",similar=3))
        self.assertEqual(data["history"],3)

    def test_pinned_and_conflicting(self):
        pin = dict(date="2026-11-26",minute=565)
        data=request([task(1,pin=pin),task(2,pin=pin),task(3)])
        self.assertEqual(data["conflicts"],["2"])
        for a,b in zip(data["slots"],data["slots"][1:]):
            self.assertLessEqual(a["end"],b["start"])
        self.assertEqual([s["start"] for s in data["slots"] if s["fixed"]],[565])
        self.assertEqual(data["deferred"]["2"],30)

    def test_midnight_and_elapsed_availability(self):
        data=request([task(1)],start=1430,nowMinute=1437)
        self.assertEqual(data["slots"][0]["end"],1440)
        self.assertEqual(data["deferred"]["1"],27)
        self.assertEqual(request([task(1)],nowMinute=800)["slots"],[])

    def test_revised_remaining_preserves_initial_estimate(self):
        data=request([task(1,seconds=1200,revision={"minutes":40,"atSeconds":600})])
        self.assertEqual(data["forecasts"]["1"]["minutes"],30)
        self.assertEqual(data["forecasts"]["1"]["remaining"],30)

    def test_future_pin(self):
        data=request([task(1,pin={"date":"2026-12-01","minute":600})])
        self.assertEqual(data["slots"],[])
        self.assertEqual(data["deferred"],{"1":30})

    def test_evaluation_excludes_unavailable_outcomes(self):
        rows=[task(i,state="done",seconds=2400,done=100000+i) for i in range(20)]
        self.assertEqual(request(rows)["evaluation"]["count"],0)

    def test_all_models_share_holdout(self):
        rows=[task(i,state="done",seconds=3600,done=i*1000+1) for i in range(20)]
        ev=request(rows)["evaluation"]
        self.assertEqual(ev["count"],8)
        self.assertEqual(ev["mae"],{"estimate":30,"personal":0,"ridge":0})
        self.assertEqual(ev["winner"],"personal")

    def test_ridge_learns_variable_duration(self):
        rows=[task(i,estimate=10+i*3,actual=2*(10+i*3)) for i in range(30)]
        model=Predictor(rows)
        self.assertGreater(model.predict(task(31,estimate=60))["ridge"],model.predict(task(32,estimate=20))["ridge"])

    def test_bad_input(self):
        for rows in ([task(1),task(1)],[task(1,seconds=-1)],[task(1,estimate=True)]):
            with self.assertRaises(ValueError):
                request(rows)

    def test_web_entrypoints(self):
        for path in ("/","/planner.js","/state.mjs","/planner.css","/wellbeing","/app.js","/styles.css","/health"):
            statuses=[]
            body=application({"PATH_INFO":path,"REQUEST_METHOD":"GET"},lambda s,h:statuses.append(s))
            self.assertTrue(b"".join(body));self.assertEqual(statuses,["200 OK"])
        raw=json.dumps({"tasks":[],"settings":dict(date="2026-11-26",start=10,available=90,block=30,nowMinute=10)}).encode()
        result=application({"PATH_INFO":"/api/plan","REQUEST_METHOD":"POST","CONTENT_LENGTH":str(len(raw)),"wsgi.input":BytesIO(raw)},lambda s,h:self.assertEqual(s,"200 OK"))
        self.assertEqual(json.loads(b"".join(result))["slots"],[])

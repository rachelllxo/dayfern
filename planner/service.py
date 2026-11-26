from datetime import date
from math import ceil, isfinite
from .model import KINDS, Predictor, evaluate

def check(value, message):
    if not value:
        raise ValueError(message)

def integer(obj, key, low, high):
    v = obj.get(key)
    check(type(v) is int and low <= v <= high, "Invalid " + key)
    return v

def day(value):
    check(isinstance(value, str) and len(value)==10 and date.fromisoformat(value).isoformat()==value, "Invalid date")
    return value

def validate(payload):
    check(isinstance(payload, dict), "Expected planner object")
    opts = payload.get("settings")
    tasks = payload.get("tasks")
    check(isinstance(opts, dict) and isinstance(tasks, list) and len(tasks)<=1000, "Invalid planner data")
    day(opts.get("date"))
    for key, a, b in [("start",0,1439),("available",1,1440),("block",1,180),("nowMinute",0,1440)]:
        integer(opts,key,a,b)
    ids = set()
    for t in tasks:
        check(isinstance(t,dict), "Invalid task")
        for key, limit in [("id",100),("title",120),("subject",64)]:
            check(isinstance(t.get(key),str) and 0<len(t[key].strip())<=limit, "Invalid "+key)
        check(t["id"] not in ids, "Duplicate task")
        ids.add(t["id"])
        check(t.get("kind") in KINDS and t.get("state") in ("open","done","abandoned"),"Invalid task category or state")
        day(t.get("due"))
        integer(t,"priority",1,3)
        integer(t,"estimate",1,1440)
        integer(t,"created",0,10**14)
        secs=t.get("seconds")
        check(type(secs) in (int,float) and isfinite(secs) and 0<=secs<=10**9,"Invalid tracked time")
        if t["state"]=="done":
            integer(t,"done",t["created"],10**14)
        revision=t.get("revision")
        if revision is not None:
            check(isinstance(revision,dict),"Invalid remaining time")
            integer(revision,"minutes",1,1440)
            recorded=revision.get("atSeconds")
            check(type(recorded) in (int,float) and 0<=recorded<=secs,"Invalid revision timestamp")
        if t.get("pin") is not None:
            check(isinstance(t["pin"],dict),"Invalid reservation")
            day(t["pin"].get("date"))
            integer(t["pin"],"minute",0,1439)
    return tasks,opts

def schedule(tasks, opts, remaining):
    start=max(opts["start"],opts["nowMinute"])
    end=min(1440,opts["start"]+opts["available"])
    slots=[]
    issues=[]
    left=dict(remaining)
    pinned=[t for t in tasks if t.get("pin") and t["pin"]["date"]==opts["date"]]
    for t in sorted(pinned,key=lambda t:(t["pin"]["minute"],t["id"])):
        at=t["pin"]["minute"]
        size=min(left[t["id"]],opts["block"])
        if at<start or at+size>end or any(at<s["end"] and s["start"]<at+size for s in slots):
            issues.append(t["id"])
            continue
        slots.append({"id":t["id"],"start":at,"end":at+size,"fixed":True})
        left[t["id"]]-=size
    cursor=start
    reservations=sorted(slots,key=lambda s:s["start"])
    queue=sorted(tasks,key=lambda t:(t["due"],-t["priority"],t["created"],t["id"]))
    for reservation in reservations+[{"start":end,"end":end}]:
        for t in queue:
            tid=t["id"]
            if tid in issues or (t.get("pin") and t["pin"]["date"]>opts["date"]):
                continue
            # Keep a reserved session as the first block for that task.
            if t in pinned and cursor<t["pin"]["minute"]:
                continue
            while left[tid] and cursor<reservation["start"]:
                size=min(left[tid],opts["block"],reservation["start"]-cursor)
                slots.append({"id":tid,"start":cursor,"end":cursor+size,"fixed":False})
                cursor+=size
                left[tid]-=size
        cursor=reservation["end"]
    return sorted(slots,key=lambda s:s["start"]),left,issues

def plan(payload):
    tasks,opts=validate(payload)
    history=sorted((dict(t,actual=t["seconds"]/60) for t in tasks if t["state"]=="done" and t["seconds"]>0),key=lambda t:t["done"])
    review=evaluate(history)
    model=Predictor(history)
    pending=[t for t in tasks if t["state"]=="open"]
    forecasts={}
    for t in pending:
        estimates=model.predict(t)
        count=sum(r["kind"]==t["kind"] for r in model.history)
        method=review["winner"] or ("personal" if count>=3 else "estimate")
        predicted=estimates[method]
        remaining=max(1,ceil(predicted-t["seconds"]/60))
        if t.get("revision"):
            revision=t["revision"]
            remaining=max(1,ceil(revision["minutes"]-(t["seconds"]-revision["atSeconds"])/60))
        forecasts[t["id"]]={"minutes":predicted,"remaining":remaining,"method":method,"similar":count}
    slots,left,issues=schedule(pending,opts,{k:v["remaining"] for k,v in forecasts.items()})
    return {"forecasts":forecasts,"slots":slots,"deferred":{k:v for k,v in left.items() if v},
            "conflicts":issues,"evaluation":review,"history":len(history)}

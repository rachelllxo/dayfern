import test from "node:test";
import assert from "node:assert/strict";
import {initial,startTimer,stopTimer,payload,seed,validateBackup} from "../web/state.mjs";
test("pause, reload, resume and stop preserve only active time",()=>{
  let s=initial();s.tasks=[{id:"a",state:"open",created:0}];startTimer(s,"a",1000);
  s=JSON.parse(JSON.stringify(s));assert.equal(payload(s,new Date(1250)).tasks[0].seconds,.25);
  stopTimer(s,2000);stopTimer(s,2500);startTimer(s,"a",4000);stopTimer(s,4600);
  assert.equal(payload(s).tasks[0].seconds,1.6);assert.equal(s.sessions.length,2);
});
test("simultaneous timers and closed tasks are rejected",()=>{
  const s=initial();s.tasks=[{id:"a",state:"open"},{id:"b",state:"done"}];
  assert.throws(()=>startTimer(s,"b"));startTimer(s,"a");assert.throws(()=>startTimer(s,"a"));
});
test("demo backup round trip and invalid intervals",()=>{
  const s=JSON.parse(JSON.stringify(seed()));validateBackup(s);
  s.sessions.push({...s.sessions[0]});assert.throws(()=>validateBackup(s));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalyticsModel} from '../lib/psn-analytics-model.mjs';
test('Sony cumulative time is independent of observed sessions',()=>{
 const model=buildAnalyticsModel({sources:{psn:{available:true,data:{played:{titles:[{titleId:'A',name:'Example',playDuration:'PT2H'}]}}},profile:{available:true,data:{record:{payload:{observedSessions:[{durationMinutes:30}]}}}}}});
 assert.equal(model.sonyMinutes,120);
 assert.equal(model.observedSessions.length,1);
 assert.equal(model.coverage.psn,true);
});
test('missing sources remain distinguishable from empty datasets',()=>{
 const model=buildAnalyticsModel({sources:{psn:{available:false,data:null}}});
 assert.equal(model.coverage.psn,false);
 assert.deepEqual(model.games,[]);
 assert.equal(model.paginationComplete,null);
});

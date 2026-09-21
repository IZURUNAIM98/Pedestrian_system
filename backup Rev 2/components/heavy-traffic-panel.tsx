"use client";

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CrossingView } from '@/components/crossing-view';
import { TimelineRail } from '@/components/timeline-rail';
import { EventLog } from '@/components/event-log';
import { HEAVY_TRAFFIC_DEFAULTS, HEAVY_TRAFFIC_NAME, HEAVY_TRAFFIC_PRESETS, createHeavyTrafficState, heavyTrafficConfigSchema, heavyTrafficDominance, heavyTrafficPedestrianTimer, heavyTrafficSignals, registerHeavyTrafficRequest, stepHeavyTraffic, type HeavyTrafficConfig, type HeavyTrafficInputs, type HeavyTrafficState } from '@/lib/heavy-traffic';
import type { CrossingMode, SimulationResult } from '@/lib/types';

export function HeavyTrafficPanel({mode,result,onModeChange,onBusy}: {mode:CrossingMode;result:SimulationResult;onModeChange:(mode:CrossingMode)=>void;onBusy:(busy:boolean)=>void}) {
  const [config,setConfig]=useState<HeavyTrafficConfig>({...HEAVY_TRAFFIC_DEFAULTS});
  const [state,setState]=useState<HeavyTrafficState|null>(null);
  const [running,setRunning]=useState(false);
  const [error,setError]=useState('');
  const [preset,setPreset]=useState('Heavy Peak');
  const [hiddenLogCount,setHiddenLogCount]=useState(0);
  const inputs=useRef<HeavyTrafficInputs>({});
  const busy=running;
  useEffect(()=>{onBusy(busy);return ()=>onBusy(false);},[busy,onBusy]);
  useEffect(()=>{
    if(!running) return;
    const timer=window.setInterval(()=>setState(previous=>previous?stepHeavyTraffic(previous,inputs.current):previous),1000);
    return ()=>window.clearInterval(timer);
  },[running]);
  useEffect(()=>{
    if(!state?.finished || !running) return;
    const id=window.requestAnimationFrame(()=>setRunning(false));return ()=>window.cancelAnimationFrame(id);
  },[state?.finished,running]);
  const signals=state?heavyTrafficSignals(state):null;
  const pedestrianTimer=state?heavyTrafficPedestrianTimer(state):{label:'No Request',countdown:0};
  function htStart() {
    const parsed=heavyTrafficConfigSchema.safeParse(config);
    if(!parsed.success){setError(parsed.error.issues.map(i=>i.message).join(' '));return;}
    setError('');inputs.current={};setHiddenLogCount(0);setState(createHeavyTrafficState(parsed.data));setRunning(true);
  }
  function htNumber(key:keyof HeavyTrafficConfig,value:number) {setConfig(prev=>({...prev,[key]:value}));}
  const fields:[keyof HeavyTrafficConfig,string,number,number][]=[['eastboundDemand','Eastbound demand (vehicles/min)',8,60],['westboundDemand','Westbound demand (vehicles/min)',8,60],['pedestrianInterval','Pedestrian arrival interval (s)',20,90],['initialQueue','Initial queue per approach',0,24]];
  const timing:[keyof HeavyTrafficConfig,string,number,number][]=[['confirmationSeconds','Confirmation period (s)',3,15],['stabilitySeconds','Stability period (s)',8,30],['cooldownSeconds','Mode cooldown (s)',8,30],['activationQueue','Activation queue (vehicles)',3,10],['recoveryQueue','Recovery queue (vehicles)',0,3],['minGreen','Minimum vehicle green (s)',6,12],['maxGreen','Maximum vehicle green (s)',12,24],['maxPedestrianWait','Maximum pedestrian wait (s)',25,45],['amberSeconds','Amber interval (s)',3,5],['allRedSeconds','All-red buffer (s)',2,4],['walkSeconds','Full WALK interval (s)',15,20],['clearanceSeconds','Pedestrian clearance (s)',3,6],['emergencyAt','Emergency arrival time (s)',20,180]];
  const parsedPreview=heavyTrafficConfigSchema.safeParse(config);
  const preview=state??createHeavyTrafficState(parsedPreview.success?parsedPreview.data:HEAVY_TRAFFIC_DEFAULTS);
  return <section className="ht-panel" aria-labelledby="ht-title">
    <Card><span className="eyebrow">LOCAL TRAFFIC STABILISATION / SIMULATED INPUTS</span><h2 id="ht-title">{HEAVY_TRAFFIC_NAME}</h2><p>Forty metres is the immediate monitoring area on each approach. Queues beyond it are estimates from simulated upstream inputs. This crossing demonstrates local flow stabilisation; corridor recovery needs upstream controller coordination.</p>
      <div className="crossing-mode-tabs"><button aria-pressed={mode==='normal'} disabled={running} onClick={()=>onModeChange('normal')}>Normal zebra crossing</button><button aria-pressed={mode==='school'} disabled={running} onClick={()=>onModeChange('school')}>School crossing</button></div>
      <fieldset className="ht-config" disabled={running}><legend>Configure simulated peak demand</legend>
        <label>Peak preset<select value={preset} onChange={e=>{setPreset(e.target.value);setConfig(prev=>({...prev,...HEAVY_TRAFFIC_PRESETS[e.target.value as keyof typeof HEAVY_TRAFFIC_PRESETS]}));}}>{Object.keys(HEAVY_TRAFFIC_PRESETS).map(name=><option key={name}>{name}</option>)}</select></label>
        {fields.map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} step="1" value={config[key] as number} onChange={e=>htNumber(key,Number(e.target.value))}/></label>)}
        <label>Sensor health<select value={config.sensorHealth} onChange={e=>setConfig(prev=>({...prev,sensorHealth:e.target.value as HeavyTrafficConfig['sensorHealth']}))}><option value="operational">Operational (96%)</option><option value="redundant">One unreliable / redundancy adequate (68%)</option><option value="failed">Safety unverified / critical (20%)</option></select></label>
        <label>Optional emergency arrival<select value={config.emergencyEnabled?'enabled':'disabled'} onChange={e=>setConfig(prev=>({...prev,emergencyEnabled:e.target.value==='enabled'}))}><option value="disabled">Disabled</option><option value="enabled">Verified simulated ambulance</option></select></label>
        <label>Emergency direction<select value={config.emergencyDirection} onChange={e=>setConfig(prev=>({...prev,emergencyDirection:e.target.value as HeavyTrafficConfig['emergencyDirection']}))}><option>Eastbound</option><option>Westbound</option></select></label>
      </fieldset>
      <details><summary>Safety timing and persistence settings</summary><p>Provisional demonstration settings; they are not approved field timings. Green, amber and all-red must fit within the ordinary maximum pedestrian wait. Active occupancy, critical and emergency holds are audited exceptions.</p><fieldset className="ht-config" disabled={running}>{timing.map(([key,label,min,max])=><label key={key}>{label}<input type="number" min={min} max={max} step="1" value={config[key] as number} onChange={e=>htNumber(key,Number(e.target.value))}/></label>)}</fieldset></details>
      {error?<p role="alert" className="ht-error">{error}</p>:null}
    </Card>
    <div className="ht-road-controls"><Button onClick={htStart} disabled={running}>Start Heavy Traffic Simulation</Button>{state&&!state.finished?<Button variant="secondary" onClick={()=>setRunning(v=>!v)}>{running?'Pause':'Resume'}</Button>:null}<Button variant="secondary" disabled={!state} onClick={()=>{setRunning(false);setState(null);setHiddenLogCount(0);inputs.current={};}}>Reset peak-hour sequence</Button><Button disabled={!state||state.finished} onClick={()=>setState(prev=>prev?registerHeavyTrafficRequest(prev):prev)}>Pedestrian request</Button></div>
    <div className="ht-scene"><CrossingView result={result} animationFrame={0} isAnimating={running} hasRun={false} controllerCountdown={pedestrianTimer.countdown} pedestrianTimerLabel={pedestrianTimer.label} motionDurationMs={1000} heavyTrafficState={preview}/></div>
    <Card><div className="ht-state" role="status" aria-live="polite"><strong>{state?.mode??'NORMAL'}</strong><span>{state?.stabilised?'STABLE':state?.phase??'Ready'} / simulation {state?.elapsed??0}s</span><span>{state?heavyTrafficDominance(state):'Balanced'}</span><span>Pedestrian {signals?.pedestrian??'WAIT'} / waited {state?.pedestrianRequestAt!==null&&state?state.pedestrianWait:0}s / {state?.pedestrianPhases??0} served</span></div>
      {state?<p><b>Activation:</b> {state.activationTime===null?'Not yet confirmed':`${state.activationTime}s`} - {state.activationReason} <b>Confidence:</b> {state.config.sensorHealth==='operational'?96:state.config.sensorHealth==='redundant'?68:20}% (simulated). <b>Next vehicle window:</b> {state.vehicleWindow}s. <b>Queue clearance estimate:</b> {Math.ceil((state.metrics.Eastbound.queue+state.metrics.Westbound.queue)/Math.max(1,state.metrics.Eastbound.dischargeRate+state.metrics.Westbound.dischargeRate)*60)}s at the recent discharge rate; excludes future arrivals.</p>:null}
      <div className="table-wrap"><table className="ht-metrics"><thead><tr><th>Direction / status</th><th>Vehicles counted</th><th>Queue / tail estimate</th><th>Average speed</th><th>Occupancy</th><th>Arrival rate</th><th>Queue waiting time</th><th>Discharge rate</th><th>Congestion score</th></tr></thead><tbody>{(['Eastbound','Westbound'] as const).map(d=>{const m=preview.metrics[d];return <tr key={d}><th>{d}<small>{m.status}</small></th><td>{m.count}</td><td>{m.queue} / {m.queueMeters} m<small>{m.monitoredQueue} monitored; {m.upstreamQueue} upstream estimate</small></td><td>{m.averageSpeed} km/h</td><td>{m.occupancy}%</td><td>{m.arrivalRate}/min</td><td>{m.waitingTime}s<small>max stopped {m.stoppedDuration}s</small></td><td>{m.dischargeRate}/min</td><td>{m.score}/100</td></tr>;})}</tbody></table></div>
      {state&&!state.finished?<div className="ht-faults"><label>Run sensor health<select aria-label="Run sensor health" defaultValue={config.sensorHealth} onChange={e=>{inputs.current.sensorHealth=e.target.value as HeavyTrafficConfig['sensorHealth'];}}><option value="operational">Operational</option><option value="redundant">Degraded / redundancy adequate</option><option value="failed">Critical / safety unverified</option></select></label><label><input type="checkbox" onChange={e=>{inputs.current.obstruction=e.target.checked;}}/> Simulate crossing obstruction</label><label><input type="checkbox" onChange={e=>{inputs.current.lateVehicle=e.target.checked;}}/> Simulate unsafe late arrival</label><label><input type="checkbox" onChange={e=>{inputs.current.extendPedestrian=e.target.checked;}}/> Pedestrian remains in crossing (extend clearance)</label></div>:null}
    </Card>
    <Card><h2>Seven-stage simulation sequence</h2><p>{Math.round(preview.timeline.filter(t=>t.detail!=='Awaiting observation.').length/7*100)}% observed{state?.finished?' - outcome recorded':' - observations in progress'}</p><TimelineRail stages={preview.timeline} activeIndex={preview.activeStage}/></Card>
    {state?.summary?<Card><h2>Outcome summary</h2><dl className="ht-summary">{Object.entries(state.summary).map(([key,value])=><div key={key}><dt>{key.replace(/([A-Z])/g,' $1')}</dt><dd>{value??'Not stabilised'}</dd></div>)}</dl></Card>:null}
    <Card className="ht-audit"><div className="card-heading"><div><span className="eyebrow">CHRONOLOGICAL LOCAL AUDIT</span><h2>Heavy traffic event log</h2><p>Timestamp, direction, evidence, action, safety rule and result remain available in this local simulation view. Clear log hides entries from this view only.</p></div><Button variant="secondary" disabled={!state||state.events.length<=hiddenLogCount} onClick={()=>setHiddenLogCount(state?.events.length??0)}>Clear heavy traffic log</Button></div>{state?<EventLog entries={state.events.slice(hiddenLogCount)} filter="all"/>:<p>Start the peak-hour sequence to record observations and decisions.</p>}</Card>
  </section>;
}

import { describe, it, expect } from 'vitest';
import { createHeavyTrafficState, HEAVY_TRAFFIC_DEFAULTS, HEAVY_TRAFFIC_PRESETS, heavyTrafficConfigSchema, heavyTrafficPedestrianTimer, heavyTrafficSignals, registerHeavyTrafficRequest, stepHeavyTraffic, type HeavyTrafficConfig, type HeavyTrafficState } from '@/lib/heavy-traffic';
import { createHeavyTrafficReportPdf } from '@/lib/pdf-report';

function htRun(overrides:Partial<HeavyTrafficConfig>={},onTick?:(s:HeavyTrafficState)=>void) {
  let state=createHeavyTrafficState({...HEAVY_TRAFFIC_DEFAULTS,...overrides},new Date('2026-09-19T00:00:00Z'));
  for(let i=0;i<480&&!state.finished;i++){state=stepHeavyTraffic(state);onTick?.(state);}return state;
}
describe('Peak-hour safety and recovery controller',()=>{
  for(const [name,preset] of Object.entries(HEAVY_TRAFFIC_PRESETS)) it(`${name}: sustained congestion, fair service, stable recovery`,()=>{
    let longest=0;let walks=0;let lastWalkStarted=0;let wasWalk=false;
    const final=htRun(preset,s=>{
      const sig=heavyTrafficSignals(s);
      if(sig.pedestrian==='WALK'){expect(sig.eastbound).toBe('STOP');expect(sig.westbound).toBe('STOP');expect(s.obstruction).toBe(false);expect(s.vehicles.some(v=>v.position>-10&&v.position<10)).toBe(false);if(!wasWalk){lastWalkStarted=s.elapsed;walks++;}}
      if(wasWalk&&sig.pedestrian!=='WALK')expect(s.elapsed-lastWalkStarted).toBeGreaterThanOrEqual(s.config.walkSeconds);
      wasWalk=sig.pedestrian==='WALK';
      if(s.pedestrianOccupied){expect(sig.eastbound).toBe('STOP');expect(sig.westbound).toBe('STOP');}
      longest=Math.max(longest,s.pedestrianRequestAt===null?0:s.pedestrianWait);
      for(const direction of ['Eastbound','Westbound']){const lane=s.vehicles.filter(v=>v.direction===direction).sort((a,b)=>a.position-b.position);for(let i=1;i<lane.length;i++)expect(lane[i].position-lane[i-1].position).toBeGreaterThanOrEqual(8.99);}
    });
    expect(final.activationTime).not.toBeNull();expect(final.stabilised).toBe(true);expect(final.mode).toBe('NORMAL');expect(walks).toBeGreaterThan(0);expect(longest).toBeLessThanOrEqual(final.config.maxPedestrianWait);
    expect(final.summary!.endingQueue).toBeLessThan(final.summary!.maximumQueue);expect(final.summary!.processed).toBeGreaterThan(0);expect(final.timeline.every(t=>t.detail!=='Awaiting observation.')).toBe(true);
    expect(final.events.find(e=>e.action.includes('HEAVY TRAFFIC MANAGEMENT'))).toBeTruthy();expect(final.events.find(e=>e.action.includes('RECOVERY'))).toBeTruthy();
  });
  it('one slow vehicle / temporary queue cannot confirm heavy mode',()=>{let s=createHeavyTrafficState({...HEAVY_TRAFFIC_DEFAULTS,initialQueue:1});for(let i=0;i<7;i++)s=stepHeavyTraffic(s);expect(s.activationTime).toBeNull();});
  it('rejects timing combinations that exceed the pedestrian wait limit',()=>{expect(heavyTrafficConfigSchema.safeParse({...HEAVY_TRAFFIC_DEFAULTS,maxGreen:24,maxPedestrianWait:25}).success).toBe(false);});
  it('keeps persistent vehicle IDs and monotonic positions without mutating prior state',()=>{
    let s=createHeavyTrafficState();for(let i=0;i<100;i++){const prev=s;const before=JSON.stringify(prev);s=stepHeavyTraffic(s);expect(JSON.stringify(prev)).toBe(before);for(const v of s.vehicles){const p=prev.vehicles.find(p=>p.id===v.id);if(p){expect(v.position).toBeGreaterThanOrEqual(p.position);expect(v.position-p.position).toBeLessThanOrEqual(9.01);}}}
  });
  it('duplicate demand never resets a latched pedestrian request',()=>{let s=registerHeavyTrafficRequest(createHeavyTrafficState());s=stepHeavyTraffic(s);const first=s.pedestrianRequestAt;s=registerHeavyTrafficRequest(s);expect(s.pedestrianRequestAt).toBe(first);});
  it('shows complete separate WAIT, safety-transition and 15-second WALK countdowns',()=>{
    let s=registerHeavyTrafficRequest(createHeavyTrafficState());
    const waiting:number[]=[],walking:number[]=[],labels:string[]=[],events:string[]=[];
    for(let i=0;i<60&&s.phase!=='CLEARANCE';i++){
      const timer=heavyTrafficPedestrianTimer(s);labels.push(timer.label);events.push(`${s.phase}:${timer.countdown}`);
      if(timer.label==='Waiting Time')waiting.push(timer.countdown);
      if(timer.label==='Walking Time')walking.push(timer.countdown);
      s=stepHeavyTraffic(s);
    }
    expect(waiting).toEqual(Array.from({length:21},(_,i)=>20-i));
    expect(labels).toContain('Safe Signal Transition');
    expect(events).toContain('AMBER:0');expect(events).toContain('ALL_RED:0');
    expect(walking).toEqual(Array.from({length:16},(_,i)=>15-i));
    expect(heavyTrafficSignals(s).pedestrian).toBe('WAIT');
    expect(heavyTrafficSignals(s).eastbound).toBe('STOP');
    expect(s.events.some(e=>e.evidence.includes('Walking Time reached zero'))).toBe(true);
  });
  it('blocks WALK during obstruction; serves retained demand after verification',()=>{let s=registerHeavyTrafficRequest(createHeavyTrafficState());for(let i=0;i<45;i++){s=stepHeavyTraffic(s,{obstruction:true});expect(heavyTrafficSignals(s).pedestrian).toBe('WAIT');}expect(s.pedestrianRequestAt).not.toBeNull();for(let i=0;i<8;i++)s=stepHeavyTraffic(s,{obstruction:false});expect(s.pedestrianPhases).toBeGreaterThan(0);expect(s.events.some(e=>e.result.includes('Request remains registered'))).toBe(true);});
  it('extends clearance for occupied crossing and holds traffic RED',()=>{let s=registerHeavyTrafficRequest(createHeavyTrafficState());while(s.phase!=='CLEARANCE')s=stepHeavyTraffic(s);for(let i=0;i<15;i++){s=stepHeavyTraffic(s,{extendPedestrian:true});expect(s.pedestrianOccupied).toBe(true);expect(heavyTrafficSignals(s).eastbound).toBe('STOP');}s=stepHeavyTraffic(s,{extendPedestrian:false});expect(s.phase).toBe('RELEASE_BUFFER');});
  it('redundant degraded sensors use a complete 15s WALK; failed sensors inhibit release',()=>{
    let s=registerHeavyTrafficRequest(createHeavyTrafficState({...HEAVY_TRAFFIC_DEFAULTS,sensorHealth:'redundant'}));while(s.phase!=='WALK')s=stepHeavyTraffic(s);expect(s.phaseDuration).toBeGreaterThanOrEqual(15);expect(s.mode).toBe('DEGRADED MODE');s=stepHeavyTraffic(s,{sensorHealth:'failed'});expect(heavyTrafficSignals(s).eastbound).toBe('STOP');
    const critical=htRun({sensorHealth:'failed'});expect(critical.stabilised).toBe(false);expect(critical.summary!.finalStatus).toBe('CRITICAL/SAFE MODE');expect(critical.pedestrianPhases).toBe(0);
  });
  for(const direction of ['Eastbound','Westbound'] as const) it(`verified ${direction} emergency waits for active crossing and returns to recovery`,()=>{
    let saw=false;const final=htRun({emergencyEnabled:true,emergencyDirection:direction,emergencyAt:42},s=>{if(s.phase==='EMERGENCY_PASSAGE'){saw=true;expect(s.pedestrianOccupied).toBe(false);expect(s.obstruction).toBe(false);expect(s.vehicles.some(v=>v.position>-10&&v.position<10)).toBe(false);}});expect(saw).toBe(true);expect(final.emergencyDone).toBe(true);expect(final.stabilised).toBe(true);
  });
  it('PDF includes every audit entry, pagination and before/after performance',()=>{
    const s=htRun();const pdf=new TextDecoder().decode(createHeavyTrafficReportPdf(s));expect(pdf).toContain('%PDF-1.4');expect(pdf).toContain('before and after');expect(pdf).toContain('Chronological evidence');expect(pdf).toContain(`/Count `);for(const e of s.events)expect(e.timestamp).toMatch(/^2026-/);expect(pdf.match(/\/Type \/Page /g)!.length).toBeGreaterThan(1);expect(s.events.every(e=>e.direction&&e.evidence&&e.action&&e.safetyRule&&e.result)).toBe(true);
  });
});

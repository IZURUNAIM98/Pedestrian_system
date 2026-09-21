import { z } from 'zod';
import { createEmergencyPriorityRecord } from '@/lib/emergency-priority';
import { type EmergencyDirection, type EmergencyPriorityRecord, type EventLogEntry, type TimelineStage, type SignalState } from '@/lib/types';

export const HEAVY_TRAFFIC_NAME = 'Peak-Hour Heavy Traffic and Queue Stabilisation';
const HT_STAGES=['Normal monitoring','Traffic build-up','Sustained congestion confirmed','Heavy traffic management','Protected pedestrian service','Queue discharge and recovery','Final stabilisation outcome'];
export const heavyTrafficConfigSchema = z.object({
  eastboundDemand: z.number().min(8).max(60), westboundDemand: z.number().min(8).max(60),
  pedestrianInterval: z.number().int().min(20).max(90), initialQueue: z.number().int().min(0).max(24),
  sensorHealth: z.enum(['operational', 'redundant', 'failed']), emergencyEnabled: z.boolean(),
  emergencyDirection: z.enum(['Eastbound', 'Westbound']), emergencyAt: z.number().int().min(20).max(180),
  confirmationSeconds: z.number().int().min(3).max(15), stabilitySeconds: z.number().int().min(8).max(30),
  cooldownSeconds: z.number().int().min(8).max(30), activationQueue: z.number().int().min(3).max(10),
  recoveryQueue: z.number().int().min(0).max(3), minGreen: z.number().int().min(6).max(12),
  maxGreen: z.number().int().min(12).max(24), amberSeconds: z.number().int().min(3).max(5),
  allRedSeconds: z.number().int().min(2).max(4), walkSeconds: z.number().int().min(15).max(20),
  clearanceSeconds: z.number().int().min(3).max(6), maxPedestrianWait: z.number().int().min(25).max(45),
}).superRefine((c, ctx) => {
  if(c.minGreen > c.maxGreen || c.maxGreen + c.amberSeconds + c.allRedSeconds > c.maxPedestrianWait)
    ctx.addIssue({code:'custom', message:'Maximum pedestrian wait must cover the maximum green, amber and all-red intervals.'});
  if(Math.max(c.walkSeconds,15)+c.clearanceSeconds+c.allRedSeconds+c.minGreen+c.amberSeconds+c.allRedSeconds>c.maxPedestrianWait)
    ctx.addIssue({code:'custom',message:'Maximum pedestrian wait must also cover an active protected phase, clearance, minimum green and stop transition.'});
  if(c.recoveryQueue >= c.activationQueue) ctx.addIssue({code:'custom',message:'Recovery queue must be below activation queue for hysteresis.'});
});
export type HeavyTrafficConfig = z.infer<typeof heavyTrafficConfigSchema>;
export const HEAVY_TRAFFIC_DEFAULTS: HeavyTrafficConfig = {
  eastboundDemand:34, westboundDemand:34, pedestrianInterval:35, initialQueue:4,
  sensorHealth:'operational', emergencyEnabled:false, emergencyDirection:'Eastbound', emergencyAt:42,
  confirmationSeconds:6, stabilitySeconds:12, cooldownSeconds:12, activationQueue:4, recoveryQueue:2,
  minGreen:8, maxGreen:20, amberSeconds:3, allRedSeconds:2, walkSeconds:15, clearanceSeconds:3, maxPedestrianWait:40,
};
export const HEAVY_TRAFFIC_PRESETS = {
  'Moderate Peak': {eastboundDemand:24,westboundDemand:24,initialQueue:3},
  'Heavy Peak': {eastboundDemand:34,westboundDemand:34,initialQueue:4},
  'Severe Queue': {eastboundDemand:48,westboundDemand:46,initialQueue:16},
  'Uneven Directional Demand': {eastboundDemand:44,westboundDemand:16,initialQueue:5},
} as const;
export type HeavyTrafficMode = 'NORMAL'|'BUILD-UP'|'HEAVY TRAFFIC MANAGEMENT'|'RECOVERY'|'DEGRADED MODE'|'CRITICAL/SAFE MODE';
export type HeavyTrafficPhase = 'GREEN'|'AMBER'|'ALL_RED'|'WALK'|'CLEARANCE'|'RELEASE_BUFFER'|'EMERGENCY_CLEARANCE'|'EMERGENCY_PASSAGE'|'SAFE_HOLD';
export interface HeavyTrafficVehicle { id:string; direction:EmergencyDirection; position:number; speed:number; enteredAt:number; delay:number; }
export interface HeavyTrafficMetrics { count:number; queue:number; monitoredQueue:number; upstreamQueue:number; queueMeters:number; averageSpeed:number; occupancy:number; arrivalRate:number; waitingTime:number; dischargeRate:number; stoppedDuration:number; score:number; status:'NORMAL'|'BUILD-UP'|'HEAVY'|'RECOVERY'|'STABLE'; }
export interface HeavyTrafficEvent extends EventLogEntry { elapsed:number; direction:EmergencyDirection|'Both'|'Pedestrian'; evidence:string; action:string; safetyRule:string; result:string; }
export interface HeavyTrafficSummary { startingQueue:number; maximumQueue:number; endingQueue:number; processed:number; averageDelay:number; pedestrianWait:number; pedestrianPhases:number; emergencyEvents:number; safetyHolds:number; violations:number; sensorConfidence:number; stabilisationSeconds:number|null; finalStatus:string; }
export interface HeavyTrafficState {
  config:HeavyTrafficConfig; startedAt:string; elapsed:number; mode:HeavyTrafficMode; phase:HeavyTrafficPhase; phaseStarted:number; phaseDuration:number;
  vehicles:HeavyTrafficVehicle[]; nextVehicleId:number; arrivals:Record<EmergencyDirection,number>; departures:Record<EmergencyDirection,number[]>; arrivalCredit:Record<EmergencyDirection,number>;
  metrics:Record<EmergencyDirection,HeavyTrafficMetrics>; persistent:Record<EmergencyDirection,number>; recoverySince:number|null; lastModeChange:number; activationTime:number|null; activationReason:string;
  pedestrianRequestAt:number|null; lastPedestrianArrival:number; pedestrianWait:number; pedestrianProgress:number; pedestrianOccupied:boolean; pedestrianPhases:number; longestPedestrianWait:number;
  emergency:EmergencyPriorityRecord|null; emergencyPending:boolean; emergencyDone:boolean; emergencyProgress:number;
  obstruction:boolean; lateVehicle:boolean; extendPedestrian:boolean; safetyHolds:number; violations:number; maximumQueue:number; totalDelay:number;
  events:HeavyTrafficEvent[]; timeline:Array<Omit<TimelineStage,'name'> & {name:string}>; activeStage:number; finished:boolean; stabilised:boolean; vehicleWindow:number; summary:HeavyTrafficSummary|null;
}
export interface HeavyTrafficInputs { pedestrianRequest?:boolean; obstruction?:boolean; lateVehicle?:boolean; extendPedestrian?:boolean; sensorHealth?:HeavyTrafficConfig['sensorHealth']; }
const HT_DIRECTIONS:EmergencyDirection[]=['Eastbound','Westbound'];
const htEmptyMetrics = ():HeavyTrafficMetrics => ({count:0,queue:0,monitoredQueue:0,upstreamQueue:0,queueMeters:0,averageSpeed:0,occupancy:0,arrivalRate:0,waitingTime:0,dischargeRate:0,stoppedDuration:0,score:0,status:'NORMAL'});

function htEvent(s:HeavyTrafficState, category:EventLogEntry['category'], direction:HeavyTrafficEvent['direction'], evidence:string, action:string, safetyRule:string, result:string) {
  const timestamp=new Date(new Date(s.startedAt).getTime()+s.elapsed*1000).toISOString();
  s.events.push({id:`HT-${s.events.length+1}`,timestamp,elapsed:s.elapsed,category,direction,evidence,action,safetyRule,result,message:`${direction}. Evidence: ${evidence}. Action: ${action}. Safety rule: ${safetyRule}. Result: ${result}.`});
}
function htStage(s:HeavyTrafficState,index:number,detail:string) {
  if(index>0 && index<6 && s.timeline[index-1].detail==='Awaiting observation.') return;
  if(s.timeline[index].detail==='Awaiting observation.') s.timeline[index]={...s.timeline[index],timestamp:new Date(new Date(s.startedAt).getTime()+s.elapsed*1000).toISOString(),detail};
  s.activeStage=Math.max(s.activeStage,index);
}
function htMode(s:HeavyTrafficState,mode:HeavyTrafficMode,reason:string) {
  if(s.mode===mode) return;
  htEvent(s,'controller','Both',reason,`${s.mode} -> ${mode}`,'Persistent indicators, hysteresis and cooldown',`Mode ${mode}`);
  s.mode=mode; s.lastModeChange=s.elapsed;
}
function htPhase(s:HeavyTrafficState,phase:HeavyTrafficPhase,duration:number,reason:string) {
  htEvent(s,'controller','Both',reason,`${s.phase} -> ${phase} (${duration}s)`,'STOP before WALK; crossing clearance before vehicle release',`Vehicle ${phase==='GREEN'?'GO':phase==='AMBER'?'AMBER':phase==='EMERGENCY_PASSAGE'?'verified emergency only':'STOP'}; pedestrian ${phase==='WALK'?'WALK':'WAIT'}`);
  s.phase=phase; s.phaseStarted=s.elapsed; s.phaseDuration=duration;
}
function htCrossingClear(s:HeavyTrafficState) { return !s.obstruction && !s.lateVehicle && !s.pedestrianOccupied && !s.vehicles.some(v=>v.position>-10 && v.position<10); }
export function heavyTrafficSignals(s:HeavyTrafficState): {eastbound:SignalState;westbound:SignalState;pedestrian:'WAIT'|'WALK';countdown:number} {
  const shared:SignalState=s.phase==='GREEN'?'GO':s.phase==='AMBER'?'AMBER':'STOP';
  return {eastbound:s.phase==='EMERGENCY_PASSAGE' && s.emergency?.direction==='Eastbound'?'GO':shared, westbound:s.phase==='EMERGENCY_PASSAGE' && s.emergency?.direction==='Westbound'?'GO':shared, pedestrian:s.phase==='WALK'?'WALK':'WAIT', countdown:Math.max(0,s.phaseDuration-(s.elapsed-s.phaseStarted))};
}
export function heavyTrafficPedestrianTimer(s:HeavyTrafficState): {label:'Waiting Time'|'Safe Signal Transition'|'Walking Time'|'No Request';countdown:number} {
  const age=s.elapsed-s.phaseStarted;
  if(s.phase==='WALK') return {label:'Walking Time',countdown:Math.max(0,s.phaseDuration-age)};
  if(['AMBER','ALL_RED','CLEARANCE','EMERGENCY_CLEARANCE','RELEASE_BUFFER'].includes(s.phase)) return {label:'Safe Signal Transition',countdown:Math.max(0,s.phaseDuration-age)};
  if(s.pedestrianRequestAt!==null) return {label:'Waiting Time',countdown:s.phase==='GREEN'?Math.max(0,s.phaseDuration-age):0};
  return {label:'No Request',countdown:0};
}
export function createHeavyTrafficState(config:HeavyTrafficConfig=HEAVY_TRAFFIC_DEFAULTS,now=new Date()):HeavyTrafficState {
  const c=heavyTrafficConfigSchema.parse(config);
  const s:HeavyTrafficState={config:c,startedAt:now.toISOString(),elapsed:0,mode:'NORMAL',phase:'GREEN',phaseStarted:0,phaseDuration:c.maxGreen,
    vehicles:[],nextVehicleId:1,arrivals:{Eastbound:0,Westbound:0},departures:{Eastbound:[],Westbound:[]},arrivalCredit:{Eastbound:0,Westbound:0},metrics:{Eastbound:htEmptyMetrics(),Westbound:htEmptyMetrics()},persistent:{Eastbound:0,Westbound:0},recoverySince:null,lastModeChange:0,activationTime:null,activationReason:'Awaiting persistent congestion.',pedestrianRequestAt:null,lastPedestrianArrival:0,pedestrianWait:0,pedestrianProgress:0,pedestrianOccupied:false,pedestrianPhases:0,longestPedestrianWait:0,emergency:null,emergencyPending:false,emergencyDone:false,emergencyProgress:0,obstruction:false,lateVehicle:false,extendPedestrian:false,safetyHolds:0,violations:0,maximumQueue:c.initialQueue*2,totalDelay:0,events:[],timeline:HT_STAGES.map(name=>({name,timestamp:now.toISOString(),detail:'Awaiting observation.',status:'complete'})),activeStage:0,finished:false,stabilised:false,vehicleWindow:c.maxGreen,summary:null};
  for(const direction of HT_DIRECTIONS) for(let i=0;i<c.initialQueue;i++) { s.vehicles.push({id:`HTV-${s.nextVehicleId++}`,direction,position:-12-i*9,speed:0,enteredAt:0,delay:0});s.arrivals[direction]++; }
  htStage(s,0,'Normal two-way flow observed. Forty metres is the immediate monitoring range; upstream queues are simulated estimates.');
  htEvent(s,'sensor','Both',`Initial queue ${c.initialQueue} per direction; sensor ${c.sensorHealth}`,'Begin normal shared-green flow','Simulation-only, persistent actor IDs','Normal operation');
  htMeasure(s);return s;
}
function htDemand(s:HeavyTrafficState,direction:EmergencyDirection):number {
  const peak=direction==='Eastbound'?s.config.eastboundDemand:s.config.westboundDemand;
  // Peak arrivals are a finite simulated pulse; tapering is explicitly logged.
  return s.elapsed<8 ? 10 : s.elapsed<28 ? 10+(peak-10)*(s.elapsed-8)/20 : s.elapsed<70 ? peak : s.elapsed<90 ? Math.max(4,peak*(90-s.elapsed)/20) : 4;
}
function htMeasure(s:HeavyTrafficState) {
  for(const d of HT_DIRECTIONS) {
    const lane=s.vehicles.filter(v=>v.direction===d); const near=lane.filter(v=>v.position>=-50 && v.position<=-10);
    const queued=lane.filter(v=>v.position<=-10 && v.speed<1.5);
    const queue=queued.length, speed=near.length?near.reduce((n,v)=>n+v.speed*3.6,0)/near.length:32;
    const occupancy=Math.min(100,near.length*20), stopped=queued.length?Math.max(...queued.map(v=>v.delay)):0;
    const score=Math.round((queue>=s.config.activationQueue?35:0)+(speed<12?25:0)+(occupancy>=60?25:0)+(stopped>=3?15:0));
    s.metrics[d]={count:s.arrivals[d],queue,monitoredQueue:queued.filter(v=>v.position>=-50).length,upstreamQueue:queued.filter(v=>v.position<-50).length,queueMeters:queue*9,averageSpeed:Math.round(speed*10)/10,occupancy,arrivalRate:Math.round(htDemand(s,d)*10)/10,waitingTime:queued.length?Math.round(queued.reduce((n,v)=>n+v.delay,0)/queued.length):0,dischargeRate:s.departures[d].filter(t=>t>s.elapsed-30).length*2,stoppedDuration:Math.round(stopped),score,status:s.stabilised?'STABLE':s.mode==='RECOVERY'?'RECOVERY':s.mode==='HEAVY TRAFFIC MANAGEMENT'?'HEAVY':score>=60?'BUILD-UP':'NORMAL'};
  }
  s.maximumQueue=Math.max(s.maximumQueue,s.metrics.Eastbound.queue+s.metrics.Westbound.queue);
}
function htAdvanceVehicles(s:HeavyTrafficState) {
  for(const d of HT_DIRECTIONS) {
    s.arrivalCredit[d]+=htDemand(s,d)/60;
    if(s.arrivalCredit[d]>=1) {
      const tail=Math.min(-55,...s.vehicles.filter(v=>v.direction===d).map(v=>v.position-9));
      s.vehicles.push({id:`HTV-${s.nextVehicleId++}`,direction:d,position:tail,speed:tail<-55?0:8,enteredAt:s.elapsed,delay:0});
      s.nextVehicleId=Math.max(s.nextVehicleId,1);s.arrivals[d]++;s.arrivalCredit[d]-=1;
    }
    // 100ms integration with acceleration/braking bounds and a minimum 9 m gap.
    for(let sub=0;sub<10;sub++) {
      const lane=s.vehicles.filter(v=>v.direction===d).sort((a,b)=>b.position-a.position);
      for(let i=0;i<lane.length;i++) {
        const v=lane[i],leader=lane[i-1];
        const stopped=s.phase!=='GREEN';
        const signalLimit=stopped && v.position<=-12 ? -12 : Infinity;
        const leaderLimit=leader?leader.position-9:Infinity;
        const limit=Math.min(signalLimit,leaderLimit), gap=Math.max(0,limit-v.position);
        const target=Math.min(9,Math.sqrt(2*2.5*gap));
        v.speed=Math.max(0,Math.min(target,v.speed+(target>=v.speed?1.8:-2.5)*.1));
        v.position=Math.min(limit,v.position+v.speed*.1);
        if(v.speed<1.5) v.delay+=.1;
      }
    }
  }
  const exited=s.vehicles.filter(v=>v.position>58);
  for(const v of exited) {s.departures[v.direction].push(s.elapsed);s.totalDelay+=v.delay;}
  s.vehicles=s.vehicles.filter(v=>v.position<=58);
}
function htRequest(s:HeavyTrafficState) {
  if(s.pedestrianRequestAt!==null) { htEvent(s,'controller','Pedestrian','Request already latched','Retain original request time','Duplicate requests never reset waiting time','Demand retained');return; }
  s.pedestrianRequestAt=s.elapsed;
  htEvent(s,'controller','Pedestrian','Pedestrian demand button / simulated arrival','Latch request immediately','Maximum wait includes amber and all-red','Pedestrian WAIT, counter started');
}
function htFinish(s:HeavyTrafficState,stable:boolean) {
  s.finished=true;s.stabilised=stable;
  if(stable) htMode(s,'NORMAL','Queue, occupancy, speed and departure balance stable for the configured period.');
  htMeasure(s);
  const processed=s.departures.Eastbound.length+s.departures.Westbound.length;
  s.summary={startingQueue:s.config.initialQueue*2,maximumQueue:s.maximumQueue,endingQueue:s.metrics.Eastbound.queue+s.metrics.Westbound.queue,processed,averageDelay:processed?Math.round(s.totalDelay/processed*10)/10:0,pedestrianWait:s.longestPedestrianWait,pedestrianPhases:s.pedestrianPhases,emergencyEvents:s.emergencyDone?1:0,safetyHolds:s.safetyHolds,violations:s.violations,sensorConfidence:s.config.sensorHealth==='operational'?96:s.config.sensorHealth==='redundant'?68:20,stabilisationSeconds:stable?s.elapsed:null,finalStatus:stable?'NORMAL / STABLE':s.mode};
  htStage(s,6,`${stable?'Stable recovery completed':'Run stopped in safe mode'}: ${processed} processed; queue ${s.summary.startingQueue} -> maximum ${s.maximumQueue} -> ${s.summary.endingQueue}.`);
  htEvent(s,'outcome','Both',JSON.stringify(s.summary),stable?'Return to NORMAL':'Keep fail-safe hold','Never report unsafe/incomplete run as stabilised',s.summary.finalStatus);
}
export function stepHeavyTraffic(previous:HeavyTrafficState, inputs:HeavyTrafficInputs={}):HeavyTrafficState {
  if(previous.finished) return previous;
  const s:HeavyTrafficState={...previous,config:{...previous.config},vehicles:previous.vehicles.map(v=>({...v})),events:[...previous.events],timeline:previous.timeline.map(t=>({...t})),arrivals:{...previous.arrivals},departures:{Eastbound:[...previous.departures.Eastbound],Westbound:[...previous.departures.Westbound]},arrivalCredit:{...previous.arrivalCredit},metrics:{...previous.metrics},persistent:{...previous.persistent}};
  s.elapsed++;
  if(inputs.sensorHealth) s.config.sensorHealth=inputs.sensorHealth;
  if(inputs.obstruction!==undefined && inputs.obstruction!==s.obstruction) {s.obstruction=inputs.obstruction;if(s.obstruction){s.violations++;s.safetyHolds++;} htEvent(s,'safety','Both',`Crossing obstruction ${inputs.obstruction}`,'Verify / hold crossing','Occupancy prevents WALK and vehicle release',s.obstruction?'Obstruction hold':'Route verification required');}
  if(inputs.lateVehicle!==undefined) s.lateVehicle=inputs.lateVehicle;
  if(inputs.extendPedestrian!==undefined) s.extendPedestrian=inputs.extendPedestrian;
  if(inputs.pedestrianRequest || (s.elapsed-s.lastPedestrianArrival>=s.config.pedestrianInterval && s.elapsed<130)) {htRequest(s);s.lastPedestrianArrival=s.elapsed;}
  if(s.pedestrianRequestAt!==null) {s.pedestrianWait=s.elapsed-s.pedestrianRequestAt;s.longestPedestrianWait=Math.max(s.longestPedestrianWait,s.pedestrianWait);}
  if(s.elapsed===8) {htMode(s,'BUILD-UP','Simulated peak arrival ramp begins.');htStage(s,1,'Arrival rate increases on both approaches; persistent vehicle spacing is maintained.');}
  if(s.elapsed===70) htEvent(s,'sensor','Both','Peak pulse ended; simulated upstream arrivals taper over 20s','Begin demand recovery profile','Local stabilisation only; no corridor-wide claim','Peak demand reduces gradually');
  if(s.config.emergencyEnabled && !s.emergency && s.elapsed>=s.config.emergencyAt) {
    s.emergency=createEmergencyPriorityRecord({direction:s.config.emergencyDirection,pedestrianAlreadyCrossing:s.pedestrianOccupied},new Date(new Date(s.startedAt).getTime()+s.elapsed*1000));s.emergencyPending=true;
    htEvent(s,'detection',s.config.emergencyDirection,'Verified simulated CCTV + radar emergency request','Latch existing emergency-priority procedure','Protect active pedestrian clearance before emergency passage','Emergency request pending');
  }
  if(s.config.sensorHealth==='failed') {
    htMode(s,'CRITICAL/SAFE MODE','Redundant sensing cannot verify crossing safety. Adaptive optimisation disabled; operator notified locally.');
    if(!['WALK','CLEARANCE','SAFE_HOLD'].includes(s.phase)) {s.safetyHolds++;htPhase(s,'SAFE_HOLD',0,'Unreliable crossing verification: predefined all-red fail-safe.');}
  } else if(s.config.sensorHealth==='redundant') htMode(s,'DEGRADED MODE','One sensor unreliable; simulated independent radar / stop-line agreement retained. Conservative fixed timings.');
  else if(['DEGRADED MODE','CRITICAL/SAFE MODE'].includes(s.mode)) {
    htMode(s,'BUILD-UP','Sensor agreement restored; restart persistent observation.');
    if(s.phase==='SAFE_HOLD' && !s.pedestrianOccupied) htPhase(s,'RELEASE_BUFFER',s.config.allRedSeconds,'Validate clear route before recovery.');
  }
  if((s.obstruction || s.lateVehicle) && s.phase==='GREEN') htPhase(s,'AMBER',s.config.amberSeconds,'Conflict observation: stop new vehicle entries and verify the route.');
  htAdvanceVehicles(s);htMeasure(s);
  for(const d of HT_DIRECTIONS) s.persistent[d]=s.metrics[d].score>=60?s.persistent[d]+1:0;
  if(s.elapsed>=8+s.config.confirmationSeconds && s.activationTime===null && HT_DIRECTIONS.some(d=>s.persistent[d]>=s.config.confirmationSeconds) && s.config.sensorHealth==='operational') {
    s.activationTime=s.elapsed;s.activationReason=HT_DIRECTIONS.filter(d=>s.persistent[d]>=s.config.confirmationSeconds).map(d=>`${d}: queue ${s.metrics[d].queue}, speed ${s.metrics[d].averageSpeed}, occupancy ${s.metrics[d].occupancy}%, stopped ${s.metrics[d].stoppedDuration}s`).join('; ');
    htMode(s,'HEAVY TRAFFIC MANAGEMENT',s.activationReason);htStage(s,2,'Multiple CCTV/radar congestion indicators persisted through the confirmation interval.');htStage(s,3,`Congestion confirmed: ${s.activationReason}`);
  }
  for(const d of HT_DIRECTIONS) {
    const m=s.metrics[d];htEvent(s,'sensor',d,`count ${m.count}; queue ${m.queue} (${m.upstreamQueue} estimated upstream); speed ${m.averageSpeed} km/h; occupancy ${m.occupancy}%; arrivals ${m.arrivalRate}/min; stopped ${m.stoppedDuration}s; score ${m.score}; confidence ${s.config.sensorHealth==='operational'?96:s.config.sensorHealth==='redundant'?68:20}%`,'Observe persistence and compare directional demand','One slow vehicle does not activate heavy mode',`${m.status}; discharge ${m.dischargeRate}/min`);
  }
  const age=s.elapsed-s.phaseStarted,c=s.config,redClear=htCrossingClear(s), adequate=c.sensorHealth!=='failed';
  if(s.phase==='GREEN') {
    const waitDue=s.pedestrianRequestAt!==null && s.pedestrianWait>=c.maxPedestrianWait-c.amberSeconds-c.allRedSeconds;
    if((s.pedestrianRequestAt!==null && age>s.vehicleWindow) || (waitDue&&age>=c.minGreen) || s.emergencyPending) htPhase(s,'AMBER',c.amberSeconds,'Waiting Time reached zero; begin amber safety transition / pedestrian deadline / verified emergency.');
  } else if(s.phase==='AMBER' && age>c.amberSeconds) htPhase(s,'ALL_RED',c.allRedSeconds,'Amber countdown reached zero; begin mandatory all-red clearance and monitor both stop lines.');
  else if(s.phase==='ALL_RED' && age>c.allRedSeconds) {
    if(adequate && redClear) {
      if(s.emergencyPending) htPhase(s,'EMERGENCY_CLEARANCE',c.allRedSeconds,'Pedestrians clear; verified emergency request has priority.');
      else if(s.pedestrianRequestAt!==null) {
        s.pedestrianPhases++;s.pedestrianOccupied=true;s.pedestrianProgress=0;s.pedestrianRequestAt=null;
        htPhase(s,'WALK',Math.max(c.walkSeconds,15),'Safety transition complete; both relevant lanes stopped, conflict route clear, valid pedestrian request. Walking Time starts at the full interval.');htStage(s,4,'Safety assessment passed: relevant vehicles stopped, no obstruction, no unresolved late arrivals; full pedestrian service.');
      } else htPhase(s,'RELEASE_BUFFER',c.allRedSeconds,'No pedestrian demand; clear crossing confirmed.');
    } else if(s.elapsed%5===0) {s.safetyHolds++;htEvent(s,'safety','Both',`Crossing clear ${redClear}; adequate sensors ${adequate}`,'Hold all-red; retain request','Never grant WALK with unresolved conflict','Pedestrian WAIT; operator verification required');}
  } else if(s.phase==='WALK') {
    s.pedestrianProgress=Math.min(100,100*age/s.phaseDuration);
    if(age>s.phaseDuration) {s.pedestrianProgress=100;htPhase(s,'CLEARANCE',c.clearanceSeconds,'Walking Time reached zero; pedestrian signal returns to WAIT and traffic remains RED through clearance.');}
  } else if(s.phase==='CLEARANCE' && age>=c.clearanceSeconds) {
    if(s.extendPedestrian) {s.safetyHolds++; if(s.elapsed%5===0) htEvent(s,'safety','Pedestrian','Pedestrian still in crossing','Extend clearance under all-red','Never shorten pedestrian clearance for queues','Release inhibited');}
    else {s.pedestrianOccupied=false;htPhase(s,adequate?'RELEASE_BUFFER':'SAFE_HOLD',c.allRedSeconds,'Pedestrian reached sidewalk; apply release buffer / fail-safe.');}
  } else if(s.phase==='RELEASE_BUFFER' && age>=c.allRedSeconds && adequate && redClear) {
    if(s.emergencyPending) htPhase(s,'EMERGENCY_CLEARANCE',c.allRedSeconds,'Deferred emergency after complete pedestrian clearance.');
    else {
      const queue=Math.max(s.metrics.Eastbound.queue,s.metrics.Westbound.queue);
      s.vehicleWindow=c.sensorHealth==='redundant'?12:Math.max(c.minGreen,Math.min(c.maxGreen,c.minGreen+queue*2));
      htEvent(s,'controller','Both',`Directional queues EB ${s.metrics.Eastbound.queue}; WB ${s.metrics.Westbound.queue}; wait EB ${s.metrics.Eastbound.waitingTime}s / WB ${s.metrics.Westbound.waitingTime}s`, `Next shared vehicle-flow window ${s.vehicleWindow}s`,'Bounded min/max green; both physical signal heads coordinated','No directional starvation');
      htPhase(s,'GREEN',s.vehicleWindow,'All-red buffer complete; crossing empty; begin smooth queue discharge.');htStage(s,5,'Queue discharge and adaptive recovery: fixed safety constraints remain in force.');
    }
  } else if(s.phase==='EMERGENCY_CLEARANCE' && age>=c.allRedSeconds && adequate && redClear) htPhase(s,'EMERGENCY_PASSAGE',8,'Verified route clear; ordinary queued traffic remains stopped for responder.');
  else if(s.phase==='EMERGENCY_PASSAGE') {
    if(!redClear || !adequate) {s.safetyHolds++;htPhase(s,'SAFE_HOLD',0,'Emergency conflict prevents safe passage.');}
    else {s.emergencyProgress=Math.min(100,age/8*100); if(age>=8) {s.emergencyPending=false;s.emergencyDone=true;htEvent(s,'safety',s.emergency?.direction??'Both','Emergency reached exit sensor','Confirm route clear; resume recovery gradually','Independent all-red buffer before normal release','Emergency passage complete');htPhase(s,'RELEASE_BUFFER',c.allRedSeconds,'Emergency exit verified.');}}
  }
  if(s.phase==='SAFE_HOLD' && adequate && redClear && !s.pedestrianOccupied) htPhase(s,'ALL_RED',c.allRedSeconds,'Safe route verified after hold.');
  const displayedTimer=heavyTrafficPedestrianTimer(s);
  if(displayedTimer.label!=='No Request') htEvent(s,'controller','Pedestrian',`${displayedTimer.label} ${displayedTimer.countdown}s; vehicle phase ${s.phase}`,`Display ${displayedTimer.label} countdown`,`Displayed timer, traffic signal, pedestrian state and movement use the same controller state`,`${heavyTrafficSignals(s).pedestrian}; vehicles ${heavyTrafficSignals(s).eastbound}/${heavyTrafficSignals(s).westbound}`);
  if(s.pedestrianRequestAt!==null && s.pedestrianWait===c.maxPedestrianWait+1) htEvent(s,'safety','Pedestrian',`Wait exceeds ${c.maxPedestrianWait}s due to safety/emergency hold`,'Retain demand; notify operator locally','Collision prevention / active crossing / verified emergency overrides optimisation','Request remains registered; no cancellation');
  if(s.mode==='RECOVERY' && HT_DIRECTIONS.some(d=>s.persistent[d]>=c.confirmationSeconds) && s.elapsed-s.lastModeChange>=c.cooldownSeconds) htMode(s,'HEAVY TRAFFIC MANAGEMENT','Persistent congestion returned after cooldown; resume bounded recovery cycles.');
  const stable=s.elapsed>=100 && adequate && !s.emergencyPending && (!c.emergencyEnabled||s.emergencyDone) && s.pedestrianRequestAt===null && !s.pedestrianOccupied && !s.obstruction && !s.lateVehicle && HT_DIRECTIONS.every(d=>{const m=s.metrics[d];const departureRate=s.departures[d].filter(t=>t>s.elapsed-60).length;return m.queue<=c.recoveryQueue && m.averageSpeed>=18 && m.occupancy<=40 && m.stoppedDuration<3 && departureRate>=m.arrivalRate;});
  if(stable) {
    s.recoverySince??=s.elapsed;
    if(s.mode==='HEAVY TRAFFIC MANAGEMENT' && s.elapsed-s.lastModeChange>=c.cooldownSeconds) htMode(s,'RECOVERY','Queue below recovery threshold; continue sustained balance checks.');
    if(s.elapsed-s.recoverySince>=c.stabilitySeconds && s.elapsed-s.lastModeChange>=c.cooldownSeconds && s.phase==='GREEN') htFinish(s,true);
  } else s.recoverySince=null;
  if(s.elapsed>=480 && !s.finished) htFinish(s,false);
  return s;
}

export function heavyTrafficActorX(v:HeavyTrafficVehicle):number {return 50+(v.direction==='Eastbound'?1:-1)*v.position*.72;}
export function heavyTrafficDominance(s:HeavyTrafficState):string {
  const a=s.metrics.Eastbound,b=s.metrics.Westbound;
  return Math.abs(a.queue-b.queue)<=2 && Math.abs(a.arrivalRate-b.arrivalRate)<10?'Balanced':a.queue+a.arrivalRate/20>b.queue+b.arrivalRate/20?'Eastbound-dominant':'Westbound-dominant';
}

export function registerHeavyTrafficRequest(previous:HeavyTrafficState):HeavyTrafficState {
  if(previous.finished) return previous;
  const s={...previous,events:[...previous.events]};htRequest(s);return s;
}

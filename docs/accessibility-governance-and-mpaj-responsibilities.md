# Accessibility, governance and MPAJ responsibilities

## Status and boundary

SmartCross 2.2 is an educational, deterministic simulation. It is not an MPAJ operational system, is not affiliated with or endorsed by MPAJ, and is not connected to live CCTV, ANPR databases, traffic signals, roadside sensors, enforcement systems or emergency dispatch.

## Accessibility commitments

- All controls must be keyboard operable and expose clear accessible names.
- Signal, risk and controller states use text and symbols as well as colour.
- Visible focus, responsive layouts and a skip link support keyboard and narrow-screen use.
- Non-essential animation is disabled when reduced motion is requested.
- Pedestrians enter only during a protected WALK after both conflicting approaches stop and the route is clear.
- Adverse-condition and sensor-health states are written in plain language and are never conveyed by colour alone.

## Evidence governance

- Plate numbers are synthetic and exist only in browser-memory simulation records.
- ANPR activates only when a configured violation reaches the Detected stage. It remains inactive during no-violation runs.
- Confidence values are deterministic mock values, not measured AI accuracy.
- A human reviewer must assess every suspected violation before reaching a conclusion.
- Only collision and fire are classified as critical incidents. Other violations remain in the local operator-review workflow.
- Mock notification recipients are selected by critical incident type, but no notification leaves the prototype.
- Exported reports retain the SIMULATION ONLY boundary and must not be used as enforcement evidence.

## Potential MPAJ operational responsibilities

If a future system were considered for field use, MPAJ or the legally authorised authority would need to:

1. Approve the operating concept, site selection, thresholds, retention rules and escalation procedures.
2. Commission field surveys, accessibility checks, speed studies, lighting and drainage inspections, and an accredited road-safety audit.
3. Define lawful roles for traffic operations, enforcement liaison, emergency coordination and data protection.
4. Assign trained human reviewers and document how uncertain or false detections are dismissed.
5. Approve procurement, cybersecurity, privacy impact assessment, maintenance, calibration and sensor-health procedures.
6. Establish authorised communication channels; automatic emergency dispatch and automatic enforcement must remain disabled unless separately approved under applicable law and policy.
7. Monitor outcomes, accessibility impacts and unintended effects, with authority to stop, correct and retest the system.

## Environmental test interpretation

Rain, night, degraded sensor health and drainage ponding are simulated test conditions. They adjust displayed mock confidence and visual context only. They do not certify real equipment performance, drainage capacity, road safety or operational readiness.

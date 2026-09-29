# Vendor Technical Questionnaire for Isolated Physical HIL

Questionnaire status: unanswered template. Do not infer vendor conformance from this document.

## Product identity

1. Legal manufacturer and support contact?
2. Device/controller model, hardware revision and serial/asset format?
3. Firmware version, release date, support status and end-of-support date?
4. Applicable certifications and exact scope?

## Electrical and physical interface

5. Connector and complete pinout?
6. Nominal/maximum voltage, current, power, earthing and surge requirements?
7. Input/output electrical characteristics and isolation ratings?
8. Safe de-energised state and behaviour on open/short circuit?
9. Approved bench load or simulator requirements?
10. Watchdog, brownout, startup, shutdown and emergency-stop behavior?

## Protocol and data model

11. Physical/transport/application protocol and version?
12. Full message catalogue, schemas, units, ranges, enumerations and reserved values?
13. Message sequence, state-transition and acknowledgement rules?
14. Timeout, retry, backoff, reconnection and idempotency behavior?
15. Timestamp source, resolution, synchronisation, drift and leap/time-change behavior?
16. Sequence numbering, rollover, duplicate, reordered and replay behavior?
17. Malformed, partial, checksum-failed and unsupported-message handling?
18. Rate limits and behavior under overload or denial of service?

## Safety behavior

19. Vendor-defined safe state and evidence supporting it?
20. Behavior when communication, sensor, processor, storage or clock fails?
21. Can conflicting signal outputs be energised; what hardware interlock prevents this?
22. How is actual output state independently read back?
23. What state follows reboot, firmware update, rollback and configuration mismatch?
24. Known hazards, anomalies, errata and field safety notices?

## Security

25. Unique device identity and mutual-authentication capabilities?
26. Supported encryption, integrity protection, certificates and key rotation?
27. Secure boot, signed firmware/configuration and downgrade protection?
28. Default accounts, credential reset, role model and audit logging?
29. Vulnerability disclosure, advisory and patch processes?
30. Network services, ports, remote-management paths and disablement method?

## Calibration and maintenance

31. Calibration method, accuracy, uncertainty, interval and traceability requirements?
32. Environmental operating limits and effects on accuracy/failure modes?
33. Preventive-maintenance and inspection schedule?
34. Diagnostic export and health-status definitions?

## Test and evidence

35. Approved emulator, test harness or conformance suite available?
36. Recommended isolated-HIL wiring and acceptance tests?
37. Protocol captures and expected results for nominal and failure cases?
38. Vendor representative authorised to certify the supplied answers?

## Vendor declaration

- Response version/date: TBD
- Applicable models/firmware: TBD
- Supporting files and SHA-256 digests: TBD
- Authorised representative: TBD
- Signature/reference: TBD
- Limitations/conditions: TBD

Unanswered, ambiguous or contradictory safety-relevant questions keep APP-04 and affected interfaces BLOCKED.

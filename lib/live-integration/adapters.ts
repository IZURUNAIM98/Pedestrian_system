import { z } from "zod";
import { createHash } from "node:crypto";

export const DEVICE_KINDS = ["CCTV_EASTBOUND", "CCTV_WESTBOUND", "VEHICLE_RADAR", "PEDESTRIAN_SENSOR", "CROSSING_OCCUPANCY", "EMERGENCY_DETECTION", "PUSH_BUTTON", "SIGNAL_CONTROLLER", "ACCESSIBILITY_DEVICE", "EDGE_GATEWAY", "OPERATOR_ALERT", "ANPR"] as const;
export type DeviceKind = (typeof DEVICE_KINDS)[number];
export const HEALTH_STATES = ["OPERATIONAL", "DEGRADED", "STALE", "FAILED", "DISCONNECTED"] as const;
export type HealthState = (typeof HEALTH_STATES)[number];
export const OBSERVATION_SCHEMA_VERSION = "1.0" as const;
const sourceIdentifier = z.string().min(1).max(64).regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Source identifier must use uppercase alphanumerics separated by single hyphens.");

const direction = z.enum(["Eastbound", "Westbound"]);
const signal = z.enum(["GO", "AMBER", "STOP"]);
const nonNegativeCount = z.number().int().min(0).max(100);

export const devicePayloadSchemas = {
  CCTV_EASTBOUND: z.object({ vehiclePresent: z.boolean(), speedKmh: z.number().min(0).max(250).optional(), queueVehicles: nonNegativeCount.optional(), stopLineIntrusion: z.boolean(), crossingOccupied: z.boolean() }).strict(),
  CCTV_WESTBOUND: z.object({ vehiclePresent: z.boolean(), speedKmh: z.number().min(0).max(250).optional(), queueVehicles: nonNegativeCount.optional(), stopLineIntrusion: z.boolean(), crossingOccupied: z.boolean() }).strict(),
  VEHICLE_RADAR: z.object({ direction, speedKmh: z.number().min(0).max(250), vehiclePresent: z.boolean(), queueVehicles: nonNegativeCount }).strict(),
  PEDESTRIAN_SENSOR: z.object({ demand: z.boolean(), crossingOccupied: z.boolean() }).strict(),
  CROSSING_OCCUPANCY: z.object({ occupied: z.boolean(), clearanceVerified: z.boolean() }).strict().superRefine((value, context) => {
    if (value.occupied && value.clearanceVerified) context.addIssue({ code: "custom", message: "An occupied crossing cannot be marked clear." });
  }),
  EMERGENCY_DETECTION: z.object({ detected: z.boolean(), direction: direction.optional(), authenticated: z.boolean().optional(), confidence: z.number().min(0).max(1).optional() }).strict().superRefine((value, context) => {
    const details = value.direction !== undefined && value.authenticated !== undefined && value.confidence !== undefined;
    if (value.detected !== details) context.addIssue({ code: "custom", message: "Emergency details must be complete if and only if an emergency is detected." });
  }),
  PUSH_BUTTON: z.object({ pressed: z.boolean(), authenticated: z.boolean() }).strict(),
  SIGNAL_CONTROLLER: z.object({ eastbound: signal, westbound: signal, pedestrian: z.enum(["WAIT", "WALK"]) }).strict(),
  ACCESSIBILITY_DEVICE: z.object({ requestActive: z.boolean(), authenticated: z.boolean() }).strict(),
  EDGE_GATEWAY: z.object({ connected: z.boolean(), upstreamHealthy: z.boolean() }).strict(),
  OPERATOR_ALERT: z.object({ safeHold: z.boolean(), resumeRequested: z.boolean() }).strict().superRefine((value, context) => {
    if (value.safeHold && value.resumeRequested) context.addIssue({ code: "custom", message: "Safe hold and resume cannot be requested together." });
  }),
  ANPR: z.object({ vehicleDetected: z.boolean(), direction: direction.optional(), plateToken: z.string().min(1).max(128).optional() }).strict().superRefine((value, context) => {
    if (value.vehicleDetected !== (value.direction !== undefined)) context.addIssue({ code: "custom", message: "ANPR direction is required only for a detected vehicle." });
  }),
} satisfies Record<DeviceKind, z.ZodType>;

export interface FieldObservation<T> { schemaVersion: typeof OBSERVATION_SCHEMA_VERSION; deviceId: string; sourceId: string; kind: DeviceKind; observedAt: string; receivedAt: string; sequence: number; confidence: number; health: HealthState; value: T; }
export interface AdapterContext { now: Date; staleAfterMs: number; }
export interface FieldInputAdapter<T> { readonly id: string; readonly kind: DeviceKind; connect(): Promise<void>; disconnect(): Promise<void>; read(context: AdapterContext): Promise<FieldObservation<T>>; health(): Promise<HealthState>; }
export interface ReplayAdapter<T> extends FieldInputAdapter<T> { reset(): void; }
export interface AdapterIdentity {
  readonly deviceId: string;
  readonly sourceId: string;
  readonly kind: DeviceKind;
  readonly interfaceId: string;
  readonly schemaVersion: typeof OBSERVATION_SCHEMA_VERSION;
  readonly configurationHash: string;
}
export interface ReplayIdentityRejectionRecord {
  readonly code: "SOURCE_IDENTITY_MISMATCH" | "ADAPTER_IDENTITY_INVALID" | ObservationRejectionCode;
  readonly reason: string;
  readonly configuredIdentity: AdapterIdentity;
  readonly claimedIdentity: Readonly<{ deviceId: unknown; sourceId: unknown; kind: unknown; schemaVersion: unknown }>;
  readonly safeResponse: Readonly<{ eastbound: "STOP"; westbound: "STOP"; pedestrian: "WAIT" }>;
  readonly recordHash: string;
}
export interface SignalCommand { correlationId: string; issuedAt: string; eastbound: "GO" | "AMBER" | "STOP"; westbound: "GO" | "AMBER" | "STOP"; pedestrian: "WAIT" | "WALK"; expiresAt: string; }
export interface SignalControllerAdapter extends FieldInputAdapter<{ eastbound: string; westbound: string; pedestrian: string }> { propose(command: SignalCommand): Promise<{ accepted: boolean; reason: string }>; actuate(command: SignalCommand): Promise<never>; }

export type ObservationRejectionCode = "ACCEPTED" | "SOURCE_IDENTITY_MISMATCH" | "UNSUPPORTED_SCHEMA_VERSION" | "UNKNOWN_DEVICE_KIND" | "MALFORMED_ENVELOPE" | "PROTOTYPE_PROPERTY_REJECTED" | "INVALID_TIMESTAMP" | "INVALID_IDENTITY_OR_SEQUENCE" | "SOURCE_KIND_MISMATCH" | "INVALID_CONFIDENCE" | "FUTURE_OBSERVATION" | "STALE_OBSERVATION" | "DEVICE_UNAVAILABLE" | "MALFORMED_PAYLOAD" | "PAYLOAD_METADATA_CONTRADICTION" | "DUPLICATE_OR_OUT_OF_ORDER";
export interface ObservationValidation { valid: boolean; code: ObservationRejectionCode; reason: string; freshnessMs: number; }

const observationEnvelopeSchema = z.object({ schemaVersion: z.literal(OBSERVATION_SCHEMA_VERSION), deviceId: sourceIdentifier, sourceId: sourceIdentifier, kind: z.enum(DEVICE_KINDS), observedAt: z.string(), receivedAt: z.string(), sequence: z.number().int().min(0), confidence: z.number().min(0).max(1), health: z.enum(HEALTH_STATES), value: z.unknown() }).strict();
const sourcePrefixes: Record<DeviceKind, readonly string[]> = {
  CCTV_EASTBOUND: ["CCTV-EB", "CCTV-EAST"], CCTV_WESTBOUND: ["CCTV-WB", "CCTV-WEST"], VEHICLE_RADAR: ["RADAR"], PEDESTRIAN_SENSOR: ["PED"], CROSSING_OCCUPANCY: ["OCC"], EMERGENCY_DETECTION: ["EM"], PUSH_BUTTON: ["BTN", "PUSH"], SIGNAL_CONTROLLER: ["CTRL"], ACCESSIBILITY_DEVICE: ["ACCESS"], EDGE_GATEWAY: ["EDGE"], OPERATOR_ALERT: ["OP"], ANPR: ["ANPR"],
};
function hasPlainPrototype(value: unknown): boolean { if (!value || typeof value !== "object") return true; const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null; }
function sourceMatchesKind(sourceId: string, kind: DeviceKind): boolean { return sourcePrefixes[kind].some((prefix) => sourceId === prefix || sourceId.startsWith(`${prefix}-`)); }
function stable(value: unknown): string { if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`; return JSON.stringify(value); }
function hash(value: unknown): string { return createHash("sha256").update(stable(value)).digest("hex"); }
function makeAdapterIdentity(deviceId: string, sourceId: string, kind: DeviceKind, interfaceId: string): AdapterIdentity {
  const controlled = { deviceId, sourceId, kind, interfaceId, schemaVersion: OBSERVATION_SCHEMA_VERSION };
  const parsed = z.object({ deviceId: sourceIdentifier, sourceId: sourceIdentifier, kind: z.enum(DEVICE_KINDS), interfaceId: sourceIdentifier, schemaVersion: z.literal(OBSERVATION_SCHEMA_VERSION) }).strict().safeParse(controlled);
  if (!parsed.success || !sourceMatchesKind(sourceId, kind)) throw new Error(`Invalid replay adapter identity: ${parsed.success ? "source does not match kind" : parsed.error.issues[0]?.message}.`);
  return Object.freeze({ ...controlled, configurationHash: hash(controlled) });
}

export interface AdapterIdentityConfiguration { readonly deviceId: string; readonly sourceId: string; readonly kind: DeviceKind; readonly interfaceId: string; }
export class AdapterIdentityRegistry {
  readonly #bySource = new Map<string, AdapterIdentity>();
  constructor(configurations: readonly AdapterIdentityConfiguration[]) {
    for (const configuration of configurations) {
      if (this.#bySource.has(configuration.sourceId)) throw new Error(`DUPLICATE_SOURCE_REGISTRATION: ${configuration.sourceId}`);
      this.#bySource.set(configuration.sourceId, makeAdapterIdentity(configuration.deviceId, configuration.sourceId, configuration.kind, configuration.interfaceId));
    }
    Object.freeze(this);
  }
  identityFor(sourceId: string): AdapterIdentity {
    const identity = this.#bySource.get(sourceId);
    if (!identity) throw new Error(`UNREGISTERED_SOURCE_ID: ${sourceId}`);
    return identity;
  }
  rejectionFor(observation: FieldObservation<unknown>): ReplayIdentityRejectionRecord | null {
    const claimedIdentity = Object.freeze({ deviceId: (observation as { deviceId?: unknown }).deviceId, sourceId: (observation as { sourceId?: unknown }).sourceId, kind: (observation as { kind?: unknown }).kind, schemaVersion: (observation as { schemaVersion?: unknown }).schemaVersion });
    const configuredIdentity = typeof claimedIdentity.sourceId === "string" ? this.#bySource.get(claimedIdentity.sourceId) : undefined;
    const reason = !configuredIdentity
      ? "Observation source is not registered in the approved adapter identity configuration."
      : claimedIdentity.deviceId !== configuredIdentity.deviceId || claimedIdentity.sourceId !== configuredIdentity.sourceId || claimedIdentity.kind !== configuredIdentity.kind || claimedIdentity.schemaVersion !== configuredIdentity.schemaVersion
        ? "Observation device, source, kind or schema does not exactly match the approved adapter identity."
        : null;
    if (!reason) return null;
    const fallback = configuredIdentity ?? Object.freeze({ deviceId: "UNREGISTERED", sourceId: typeof claimedIdentity.sourceId === "string" ? claimedIdentity.sourceId : "UNREGISTERED", kind: DEVICE_KINDS.includes(claimedIdentity.kind as DeviceKind) ? claimedIdentity.kind as DeviceKind : "EDGE_GATEWAY", interfaceId: "UNREGISTERED", schemaVersion: OBSERVATION_SCHEMA_VERSION, configurationHash: hash({ unregistered: claimedIdentity }) });
    const content = { code: "SOURCE_IDENTITY_MISMATCH" as const, reason, configuredIdentity: fallback, claimedIdentity, safeResponse: { eastbound: "STOP" as const, westbound: "STOP" as const, pedestrian: "WAIT" as const } };
    return Object.freeze({ ...content, recordHash: hash(content) });
  }
}

export function verifyReplayIdentityRejection(record: ReplayIdentityRejectionRecord): boolean {
  const { recordHash, ...content } = record;
  return hash(content) === recordHash;
}

export class ReplayIdentityError extends Error {
  constructor(readonly rejection: ReplayIdentityRejectionRecord) { super(rejection.reason); this.name = "ReplayIdentityError"; }
}

export function validateObservation<T>(observation: FieldObservation<T>, context: AdapterContext): ObservationValidation {
  if (!observation || typeof observation !== "object") return { valid: false, code: "MALFORMED_ENVELOPE", reason: "Observation envelope is missing or malformed.", freshnessMs: Number.POSITIVE_INFINITY };
  if (!hasPlainPrototype(observation) || !hasPlainPrototype(observation.value)) return { valid: false, code: "PROTOTYPE_PROPERTY_REJECTED", reason: "Observation or payload has a non-plain prototype.", freshnessMs: Number.POSITIVE_INFINITY };
  if (observation.schemaVersion !== OBSERVATION_SCHEMA_VERSION) return { valid: false, code: "UNSUPPORTED_SCHEMA_VERSION", reason: "Observation schema version is missing or unsupported.", freshnessMs: Number.POSITIVE_INFINITY };
  if (!DEVICE_KINDS.includes(observation.kind)) return { valid: false, code: "UNKNOWN_DEVICE_KIND", reason: "Unknown device kind rejected.", freshnessMs: Number.POSITIVE_INFINITY };
  const envelope = observationEnvelopeSchema.safeParse(observation);
  if (!envelope.success) return { valid: false, code: "MALFORMED_ENVELOPE", reason: `Observation envelope rejected: ${envelope.error.issues[0]?.message ?? "invalid field"}`, freshnessMs: Number.POSITIVE_INFINITY };
  const observed = Date.parse(observation.observedAt);
  const received = Date.parse(observation.receivedAt);
  const freshnessMs = context.now.getTime() - observed;
  if (!Number.isFinite(observed) || !Number.isFinite(received) || received < observed) return { valid: false, code: "INVALID_TIMESTAMP", reason: "Invalid device timestamp ordering.", freshnessMs: Number.POSITIVE_INFINITY };
  if (typeof observation.sourceId !== "string" || !observation.sourceId.trim() || !Number.isInteger(observation.sequence) || observation.sequence < 0) return { valid: false, code: "INVALID_IDENTITY_OR_SEQUENCE", reason: "Missing source identity or invalid sequence.", freshnessMs };
  if (!sourceMatchesKind(observation.sourceId, observation.kind)) return { valid: false, code: "SOURCE_KIND_MISMATCH", reason: "Source identifier does not match the declared device kind.", freshnessMs };
  if (!Number.isFinite(observation.confidence) || observation.confidence < 0 || observation.confidence > 1) return { valid: false, code: "INVALID_CONFIDENCE", reason: "Confidence is outside 0..1.", freshnessMs };
  if (freshnessMs < -250) return { valid: false, code: "FUTURE_OBSERVATION", reason: "Observation timestamp is in the future.", freshnessMs };
  if (freshnessMs > context.staleAfterMs || observation.health === "STALE") return { valid: false, code: "STALE_OBSERVATION", reason: "Observation is stale.", freshnessMs };
  if (["FAILED", "DISCONNECTED"].includes(observation.health)) return { valid: false, code: "DEVICE_UNAVAILABLE", reason: `Device is ${observation.health.toLowerCase()}.`, freshnessMs };
  const payload = devicePayloadSchemas[observation.kind].safeParse(observation.value);
  if (!payload.success) return { valid: false, code: "MALFORMED_PAYLOAD", reason: `Payload rejected for ${observation.kind}: ${payload.error.issues[0]?.message ?? "invalid value"}`, freshnessMs };
  const parsedPayload = payload.data as Record<string, unknown>;
  if (observation.kind === "EMERGENCY_DETECTION" && parsedPayload.detected === true && parsedPayload.confidence !== observation.confidence) return { valid: false, code: "PAYLOAD_METADATA_CONTRADICTION", reason: "Emergency payload confidence contradicts observation metadata.", freshnessMs };
  if (observation.kind === "EDGE_GATEWAY" && observation.health === "OPERATIONAL" && parsedPayload.connected === false) return { valid: false, code: "PAYLOAD_METADATA_CONTRADICTION", reason: "Operational gateway metadata contradicts a disconnected payload.", freshnessMs };
  return { valid: true, code: "ACCEPTED", reason: "Observation and device payload accepted.", freshnessMs };
}

export class ObservationGuard {
  private readonly lastSequence = new Map<string, number>();
  accept<T>(observation: FieldObservation<T>, context: AdapterContext): ObservationValidation {
    const validation = validateObservation(observation, context);
    if (!validation.valid) return validation;
    const previous = this.lastSequence.get(observation.sourceId);
    if (previous !== undefined && observation.sequence <= previous) return { ...validation, valid: false, code: "DUPLICATE_OR_OUT_OF_ORDER", reason: "Duplicate or out-of-order observation rejected." };
    this.lastSequence.set(observation.sourceId, observation.sequence);
    return validation;
  }
  acceptBatch<T>(observations: readonly FieldObservation<T>[], context: AdapterContext): ObservationValidation[] {
    const proposed = new Map(this.lastSequence);
    const results: ObservationValidation[] = [];
    for (const observation of observations) {
      const validation = validateObservation(observation, context);
      if (!validation.valid) { results.push(validation); return results; }
      const previous = proposed.get(observation.sourceId);
      if (previous !== undefined && observation.sequence <= previous) { results.push({ ...validation, valid: false, code: "DUPLICATE_OR_OUT_OF_ORDER", reason: "Duplicate or out-of-order observation rejected." }); return results; }
      proposed.set(observation.sourceId, observation.sequence);
      results.push(validation);
    }
    this.lastSequence.clear();
    for (const [sourceId, sequence] of proposed) this.lastSequence.set(sourceId, sequence);
    return results;
  }
  reset(sourceId?: string) { if (sourceId) this.lastSequence.delete(sourceId); else this.lastSequence.clear(); }
}

export class MockAdapter<T> implements FieldInputAdapter<T> {
  readonly kind: DeviceKind; readonly id: string; private connected = false;
  constructor(id: string, kind: DeviceKind, private readonly observation: FieldObservation<T>) { this.id = id; this.kind = kind; }
  async connect() { this.connected = true; } async disconnect() { this.connected = false; }
  async health(): Promise<HealthState> { return this.connected ? this.observation.health : "DISCONNECTED"; }
  async read(context: AdapterContext) { if (!this.connected) throw new Error("Adapter is disconnected."); if (this.observation.kind !== this.kind || this.observation.sourceId !== this.id) throw new Error("Adapter identity does not match observation identity."); const checked = validateObservation(this.observation, context); if (!checked.valid) throw new Error(checked.reason); return this.observation; }
}

export class InMemoryReplayAdapter<T> implements ReplayAdapter<T> {
  readonly identity: AdapterIdentity; private index = 0; private connected = false;
  get id(): string { return this.identity.sourceId; } get kind(): DeviceKind { return this.identity.kind; }
  constructor(private readonly registry: AdapterIdentityRegistry, sourceId: string, private readonly observations: readonly FieldObservation<T>[]) {
    this.identity = registry.identityFor(sourceId);
  }
  async connect() { this.connected = true; } async disconnect() { this.connected = false; } reset() { this.index = 0; }
  async health(): Promise<HealthState> { return this.connected ? "OPERATIONAL" : "DISCONNECTED"; }
  async read(context: AdapterContext) {
    if (!this.connected) throw new Error("Replay adapter is disconnected.");
    const value = this.observations[this.index++]; if (!value) throw new Error("Replay exhausted.");
    const claimedIdentity = Object.freeze({ deviceId: (value as { deviceId?: unknown }).deviceId, sourceId: (value as { sourceId?: unknown }).sourceId, kind: (value as { kind?: unknown }).kind, schemaVersion: (value as { schemaVersion?: unknown }).schemaVersion });
    const registryRejection = this.registry.rejectionFor(value as FieldObservation<unknown>);
    const identityMatches = !registryRejection && value.sourceId === this.identity.sourceId;
    const checked = identityMatches ? validateObservation(value, context) : { valid: false, code: "SOURCE_IDENTITY_MISMATCH" as const, reason: registryRejection?.reason ?? "Replay observation source does not match this configured adapter.", freshnessMs: Number.POSITIVE_INFINITY };
    if (!checked.valid) {
      if (registryRejection) throw new ReplayIdentityError(registryRejection);
      const content = { code: checked.code, reason: checked.reason, configuredIdentity: this.identity, claimedIdentity, safeResponse: { eastbound: "STOP" as const, westbound: "STOP" as const, pedestrian: "WAIT" as const } };
      throw new ReplayIdentityError(Object.freeze({ ...content, recordHash: hash(content) }));
    }
    return value;
  }
}

export abstract class PendingVendorFieldAdapter<T> implements FieldInputAdapter<T> {
  abstract readonly id: string; abstract readonly kind: DeviceKind;
  async connect(): Promise<void> { throw new Error("Field protocol pending vendor and MPAJ confirmation."); }
  async disconnect(): Promise<void> {} async health(): Promise<HealthState> { return "DISCONNECTED"; }
  async read(context: AdapterContext): Promise<FieldObservation<T>> { void context; throw new Error("Field protocol pending vendor and MPAJ confirmation."); }
}

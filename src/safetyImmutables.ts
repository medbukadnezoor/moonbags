export const LAB_SAFETY_PREFIX = "MoonBags Lab safety immutable";

export type LabPosture = {
  ok: boolean;
  dryRun: boolean | null;
  source: "default" | "env" | "runtime";
  raw?: string;
  errors: string[];
};

export type SafetyValidationResult = {
  ok: boolean;
  errors: string[];
};

type JsonPath = Array<string | number>;

const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "n", "off"]);
const DEFAULT_BUY_SIZE_SOL = 0.02;
const DEFAULT_MAX_CONCURRENT_POSITIONS = 10;

const SECRET_FIELD_RE = /(priv|private|secret|credential|api[_-]?key|token|passphrase|mnemonic|seed|wallet)/i;
const SECRET_PATH_RE = /(\.env|wallet|keypair|secret|credential|private|mnemonic|seed)/i;
const EXECUTION_CLIENT_RE = /execution.*client|client.*execution|swap.*client|quote.*client/i;
const LIVE_MODE_RE = /^(live|mainnet|real)$/i;
const HARD_STOP_DISABLE_RE = /disable.*(hard)?stop|(hard)?stop.*disable/i;
const HARD_STOP_ENABLED_RE = /stop.*enabled|hard.*stop.*enabled/i;
const HARD_STOP_FIELD_RE = /^(STOP_PCT|stopPct|hardStopPct|hard_stop_pct|safetyFloor\.?stopPct)$/i;
const SIZE_FIELD_RE = /BUY_SIZE_SOL|buySizeSol|maxPositionSizeSol|max_position_size_sol|MAX_CONCURRENT_POSITIONS|maxConcurrentPositions|max_concurrent_positions/i;

export function parseDryRunPosture(raw: string | undefined, source: LabPosture["source"] = "env"): LabPosture {
  if (raw === undefined || raw.trim() === "") {
    return { ok: true, dryRun: true, source: "default", errors: [] };
  }

  const normalized = raw.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return { ok: true, dryRun: true, source, raw, errors: [] };
  if (FALSE_VALUES.has(normalized)) {
    return {
      ok: false,
      dryRun: false,
      source,
      raw,
      errors: [`${LAB_SAFETY_PREFIX}: DRY_RUN=false is blocked. MoonBags Lab MVP is dry-run-only.`],
    };
  }

  return {
    ok: false,
    dryRun: null,
    source,
    raw,
    errors: [`${LAB_SAFETY_PREFIX}: invalid DRY_RUN value "${raw}". Use DRY_RUN=true for the MVP lab.`],
  };
}

export function assertLabRuntimeDryRun(raw: string | undefined = process.env.DRY_RUN): void {
  const posture = parseDryRunPosture(raw);
  if (!posture.ok) throw new Error(posture.errors.join("\n"));
}

export function validateRuntimeSettings(settings: Record<string, unknown>): SafetyValidationResult {
  const errors: string[] = [];

  if (settings.DRY_RUN !== undefined || settings.dryRun !== undefined) {
    const value = settings.DRY_RUN ?? settings.dryRun;
    if (value !== true && value !== "true" && value !== 1) {
      errors.push(`${LAB_SAFETY_PREFIX}: runtime settings cannot set DRY_RUN/dryRun to a non-true value.`);
    }
  }

  for (const [key, value] of Object.entries(settings)) {
    collectFieldValueErrors(errors, [key], key, value);
  }

  return { ok: errors.length === 0, errors };
}

export function validatePatchObject(patch: unknown): SafetyValidationResult {
  const errors: string[] = [];
  scanPatchValue(errors, [], patch);
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function scanPatchValue(errors: string[], path: JsonPath, value: unknown): void {
  const key = String(path[path.length - 1] ?? "");
  collectFieldValueErrors(errors, path, key, value);

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanPatchValue(errors, [...path, index], item));
    return;
  }

  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      scanPatchValue(errors, [...path, childKey], childValue);
    }
  }
}

function collectFieldValueErrors(errors: string[], path: JsonPath, key: string, value: unknown): void {
  const dottedPath = pathToString(path);

  if ((key === "DRY_RUN" || key === "dryRun") && value !== true && value !== "true" && value !== 1) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} attempts to set dry-run false.`);
  }

  if (/tradingMode|mode/i.test(key) && typeof value === "string" && LIVE_MODE_RE.test(value)) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} attempts to enable live trading mode.`);
  }

  if (SECRET_FIELD_RE.test(key)) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} touches wallet, key, token, credential, or secret-like material.`);
  }

  if (typeof value === "string" && SECRET_PATH_RE.test(value)) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} references a private runtime or credential path.`);
  }

  if (EXECUTION_CLIENT_RE.test(key)) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} attempts to change the execution client.`);
  }

  if (HARD_STOP_FIELD_RE.test(key) && typeof value === "number" && value <= 0) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} weakens or disables the hard stop.`);
  }

  if ((HARD_STOP_DISABLE_RE.test(key) && value === true) || (HARD_STOP_ENABLED_RE.test(key) && value === false)) {
    errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} disables hard-stop enforcement.`);
  }

  if (SIZE_FIELD_RE.test(key) && typeof value === "number") {
    if (/BUY_SIZE_SOL|buySizeSol|maxPositionSizeSol|max_position_size_sol/i.test(key) && value > DEFAULT_BUY_SIZE_SOL) {
      errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} increases live size above the MVP dry-run envelope.`);
    }
    if (/MAX_CONCURRENT_POSITIONS|maxConcurrentPositions|max_concurrent_positions/i.test(key) && value > DEFAULT_MAX_CONCURRENT_POSITIONS) {
      errors.push(`${LAB_SAFETY_PREFIX}: ${dottedPath} increases maximum concurrent positions.`);
    }
  }
}

function pathToString(path: JsonPath): string {
  if (path.length === 0) return "<root>";
  return path.map((part) => typeof part === "number" ? `[${part}]` : part).join(".");
}

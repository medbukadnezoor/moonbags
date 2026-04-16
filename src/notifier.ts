import { CONFIG } from "./config.js";
import logger from "./logger.js";

/**
 * Escape HTML special chars so Telegram's parse_mode="HTML" doesn't reject
 * the message. Apply to ALL user/external-derived text before interpolating
 * into HTML messages.
 */
export function escapeHtml(s: string | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function enabled(): boolean {
  return Boolean(CONFIG.TELEGRAM_BOT_TOKEN && CONFIG.TELEGRAM_CHAT_ID);
}

async function send(text: string): Promise<void> {
  if (!enabled()) return;
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: CONFIG.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      logger.warn({ status: res.status, body }, "[notifier] telegram send non-OK");
    }
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "[notifier] telegram send failed");
  }
}

function short(sig: string): string {
  return sig.length > 12 ? `${sig.slice(0, 6)}…${sig.slice(-4)}` : sig;
}

function mcapFmt(usd: number): string {
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 1_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toFixed(0)}`;
}

function holdFmt(secs: number): string {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${secs}s`;
}

function gmgn(mint: string): string {
  return `https://gmgn.ai/sol/token/${mint}`;
}

function solscan(sig: string): string {
  return `https://solscan.io/tx/${sig}`;
}

export function notifyBoot(): Promise<void> {
  const mbLine = CONFIG.MOONBAG_PCT > 0
    ? `\nmoonbag: ${(CONFIG.MOONBAG_PCT * 100).toFixed(0)}%  mb-trail: ${(CONFIG.MB_TRAIL_PCT * 100).toFixed(0)}%  mb-timeout: ${(CONFIG.MB_TIMEOUT_SECS / 60).toFixed(0)}m`
    : "";
  return send(
    `🌙 <b>MoonBags</b> online\n` +
    `mode: ${CONFIG.DRY_RUN ? "DRY RUN" : "LIVE"}  |  buy: ${CONFIG.BUY_SIZE_SOL} SOL\n` +
    `arm: +${(CONFIG.ARM_PCT * 100).toFixed(0)}%  trail: ${(CONFIG.TRAIL_PCT * 100).toFixed(0)}%  stop: -${(CONFIG.STOP_PCT * 100).toFixed(0)}%` +
    mbLine,
  );
}

export function notifyBuy(args: {
  name: string;
  mint: string;
  solSpent: number;
  entryMcap: number;
  entryPrice: number;
  signature: string;
}): Promise<void> {
  const text =
    `🟢 <b>BUY ${escapeHtml(args.name)}</b>\n` +
    `mcap: ${mcapFmt(args.entryMcap)}  |  spent: ${args.solSpent.toFixed(4)} SOL\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>  ·  <a href="${solscan(escapeHtml(args.signature))}">tx ${escapeHtml(short(args.signature))}</a>`;
  return send(text);
}

export function notifySell(args: {
  name: string;
  mint: string;
  reason: string;
  entrySol: number;
  exitSol: number;
  pnlSolPct: number;
  peakPnlPct: number;
  holdSecs: number;
  signature: string;
  llmReason?: string;
}): Promise<void> {
  const pnlSol = args.exitSol - args.entrySol;
  const icon = args.pnlSolPct >= 0 ? "🟢" : "🔴";
  const sign = pnlSol >= 0 ? "+" : "";
  const llmLine = args.llmReason ? `\nLLM: <i>"${escapeHtml(args.llmReason)}"</i>` : "";
  const text =
    `${icon} <b>SELL ${escapeHtml(args.name)}</b> — ${args.reason}\n` +
    `PnL: <b>${sign}${pnlSol.toFixed(4)} SOL (${sign}${args.pnlSolPct.toFixed(1)}%)</b>\n` +
    `peak: +${args.peakPnlPct.toFixed(1)}%  |  held: ${holdFmt(args.holdSecs)}` +
    llmLine + `\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>  ·  <a href="${solscan(escapeHtml(args.signature))}">tx ${escapeHtml(short(args.signature))}</a>`;
  return send(text);
}

export function notifyArmed(args: { name: string; mint: string; pnlPct: number }): Promise<void> {
  return send(
    `⚡ <b>ARMED ${escapeHtml(args.name)}</b> — trailing active\n` +
    `+${(args.pnlPct * 100).toFixed(1)}% from entry\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

export function notifyMoonbagStart(args: {
  name: string; mint: string;
  moonbagPct: number; mbTrailPct: number; mbTimeoutMins: number;
}): Promise<void> {
  return send(
    `🌙 <b>MOONBAG ${escapeHtml(args.name)}</b>\n` +
    `Keeping ${(args.moonbagPct * 100).toFixed(0)}%  |  trail: ${(args.mbTrailPct * 100).toFixed(0)}%  |  timeout: ${args.mbTimeoutMins.toFixed(0)}m\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

export function notifyBuyFail(args: { name: string; mint: string; attempts: number }): Promise<void> {
  return send(
    `❌ <b>BUY FAILED ${escapeHtml(args.name)}</b>\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

export function notifySellFail(args: {
  name: string;
  mint: string;
  reason: string;
  attempts: number;
}): Promise<void> {
  return send(
    `⚠️ <b>SELL STUCK ${escapeHtml(args.name)}</b> — ${args.reason}\n` +
    `${args.attempts} attempts failed — manual action needed\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

export function notifyLlmActive(args: {
  name: string;
  mint: string;
  trailPct: number;
  pnlPct: number;
}): Promise<void> {
  const sign = args.pnlPct >= 0 ? "+" : "";
  return send(
    `🤖 <b>LLM watching ${escapeHtml(args.name)}</b>\n` +
    `trail: ${(args.trailPct * 100).toFixed(0)}%  |  PnL: ${sign}${(args.pnlPct * 100).toFixed(1)}%\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

export function notifyLlmTighten(args: {
  name: string;
  mint: string;
  oldTrailPct: number;
  newTrailPct: number;
  reason: string;
}): Promise<void> {
  return send(
    `🤖 <b>LLM tightened ${escapeHtml(args.name)}</b>  ${(args.oldTrailPct * 100).toFixed(0)}% → ${(args.newTrailPct * 100).toFixed(0)}%\n` +
    `<i>"${escapeHtml(args.reason)}"</i>\n` +
    `<a href="${gmgn(escapeHtml(args.mint))}">GMGN</a>`,
  );
}

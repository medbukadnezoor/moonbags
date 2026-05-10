// ---------------------------------------------------------------------------
// Wallet Harvester — SQLite Store
// ---------------------------------------------------------------------------

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type {
  WalletRecord,
  SightingRecord,
  TokenRecord,
  RunRecord,
  ProviderRunMetric,
  Source,
  WalletTag,
  ExtractedWallet,
  DiscoveredToken,
} from "./types.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS wallets (
  address         TEXT PRIMARY KEY,
  sources         TEXT NOT NULL DEFAULT '[]',
  tags            TEXT NOT NULL DEFAULT '[]',
  wallet_label    TEXT,
  twitter_username TEXT,
  twitter_name    TEXT,
  avatar_url      TEXT,
  provider_tags   TEXT NOT NULL DEFAULT '[]',
  token_tags      TEXT NOT NULL DEFAULT '[]',
  metadata_snapshot_at INTEGER,
  first_seen      INTEGER NOT NULL,
  last_seen       INTEGER NOT NULL,
  token_count     INTEGER NOT NULL DEFAULT 0,
  pnl_usd         REAL,
  win_rate         REAL,
  avg_buy_usd      REAL,
  pnl_snapshot_at  INTEGER
);

CREATE TABLE IF NOT EXISTS sightings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address  TEXT NOT NULL REFERENCES wallets(address),
  mint            TEXT NOT NULL,
  action          TEXT NOT NULL,
  amount_usd      REAL,
  token_mcap_usd  REAL,
  timestamp       INTEGER NOT NULL,
  source          TEXT NOT NULL,
  signal_type     TEXT,
  run_id          TEXT NOT NULL,
  UNIQUE(wallet_address, mint, source, timestamp, action)
);

CREATE TABLE IF NOT EXISTS tokens (
  mint                TEXT PRIMARY KEY,
  symbol              TEXT,
  name                TEXT,
  mcap_at_harvest     REAL,
  volume_24h_usd      REAL,
  holder_count        INTEGER,
  smart_wallet_count  INTEGER,
  kol_count           INTEGER,
  created_at          INTEGER,
  first_harvested_at  INTEGER NOT NULL,
  last_harvested_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  run_id              TEXT PRIMARY KEY,
  started_at          INTEGER NOT NULL,
  finished_at         INTEGER,
  tokens_discovered   INTEGER DEFAULT 0,
  tokens_harvested    INTEGER DEFAULT 0,
  wallets_new         INTEGER DEFAULT 0,
  wallets_updated     INTEGER DEFAULT 0,
  sightings_added     INTEGER DEFAULT 0,
  errors              TEXT DEFAULT '[]',
  status              TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS provider_run_metrics (
  run_id              TEXT NOT NULL REFERENCES runs(run_id),
  provider            TEXT NOT NULL,
  calls_used          INTEGER NOT NULL DEFAULT 0,
  rate_limit_hits     INTEGER NOT NULL DEFAULT 0,
  stopped_early       INTEGER NOT NULL DEFAULT 0,
  wallets_extracted   INTEGER NOT NULL DEFAULT 0,
  sightings_extracted INTEGER NOT NULL DEFAULT 0,
  metadata            TEXT NOT NULL DEFAULT '{}',
  created_at          INTEGER NOT NULL,
  PRIMARY KEY (run_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_sightings_wallet ON sightings(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sightings_mint ON sightings(mint);
CREATE INDEX IF NOT EXISTS idx_sightings_run ON sightings(run_id);
CREATE INDEX IF NOT EXISTS idx_wallets_token_count ON wallets(token_count DESC);
CREATE INDEX IF NOT EXISTS idx_wallets_last_seen ON wallets(last_seen DESC);

-- Hypothesis testing views

CREATE VIEW IF NOT EXISTS v_recurrence_pnl AS
SELECT
  address,
  token_count,
  pnl_usd,
  win_rate,
  CASE WHEN token_count >= 3 THEN 'high_freq' ELSE 'low_freq' END AS freq_group
FROM wallets
WHERE pnl_usd IS NOT NULL;

CREATE VIEW IF NOT EXISTS v_cross_source AS
SELECT
  address,
  sources,
  json_array_length(sources) AS source_count,
  CASE
    WHEN sources LIKE '%gmgn%' AND sources LIKE '%okx%' THEN 'dual'
    WHEN sources LIKE '%gmgn%' THEN 'gmgn_only'
    ELSE 'okx_only'
  END AS source_type
FROM wallets;

CREATE VIEW IF NOT EXISTS v_sighting_freq AS
SELECT
  wallet_address,
  COUNT(DISTINCT mint) AS unique_tokens,
  COUNT(*) AS total_sightings
FROM sightings
GROUP BY wallet_address
ORDER BY total_sightings DESC;
`;

// ---------------------------------------------------------------------------
// Store class
// ---------------------------------------------------------------------------

export class HarvesterStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
    this.migrateWalletMetadataColumns();
  }

  // -------------------------------------------------------------------------
  // Run tracking
  // -------------------------------------------------------------------------

  createRun(runId: string): void {
    this.db.prepare(`
      INSERT INTO runs (run_id, started_at, status)
      VALUES (?, ?, 'running')
    `).run(runId, Date.now());
  }

  completeRun(runId: string, stats: Partial<RunRecord>): void {
    this.db.prepare(`
      UPDATE runs SET
        finished_at = ?,
        tokens_discovered = COALESCE(?, tokens_discovered),
        tokens_harvested = COALESCE(?, tokens_harvested),
        wallets_new = COALESCE(?, wallets_new),
        wallets_updated = COALESCE(?, wallets_updated),
        sightings_added = COALESCE(?, sightings_added),
        errors = COALESCE(?, errors),
        status = ?
      WHERE run_id = ?
    `).run(
      Date.now(),
      stats.tokensDiscovered ?? null,
      stats.tokensHarvested ?? null,
      stats.walletsNew ?? null,
      stats.walletsUpdated ?? null,
      stats.sightingsAdded ?? null,
      stats.errors ? JSON.stringify(stats.errors) : null,
      stats.status ?? "completed",
      runId,
    );
  }

  getLastRun(): RunRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM runs ORDER BY started_at DESC LIMIT 1
    `).get() as Record<string, unknown> | undefined;
    return row ? this.mapRunRow(row) : null;
  }

  upsertProviderRunMetric(metric: Omit<ProviderRunMetric, "createdAt">): void {
    this.db.prepare(`
      INSERT INTO provider_run_metrics (
        run_id, provider, calls_used, rate_limit_hits, stopped_early,
        wallets_extracted, sightings_extracted, metadata, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_id, provider) DO UPDATE SET
        calls_used = excluded.calls_used,
        rate_limit_hits = excluded.rate_limit_hits,
        stopped_early = excluded.stopped_early,
        wallets_extracted = excluded.wallets_extracted,
        sightings_extracted = excluded.sightings_extracted,
        metadata = excluded.metadata
    `).run(
      metric.runId,
      metric.provider,
      metric.callsUsed,
      metric.rateLimitHits,
      metric.stoppedEarly ? 1 : 0,
      metric.walletsExtracted,
      metric.sightingsExtracted,
      JSON.stringify(metric.metadata),
      Date.now(),
    );
  }

  getProviderRunMetrics(runId: string): ProviderRunMetric[] {
    const rows = this.db.prepare(`
      SELECT * FROM provider_run_metrics
      WHERE run_id = ?
      ORDER BY provider
    `).all(runId) as Record<string, unknown>[];
    return rows.map(r => ({
      runId: r.run_id as string,
      provider: r.provider as Source,
      callsUsed: r.calls_used as number,
      rateLimitHits: r.rate_limit_hits as number,
      stoppedEarly: Boolean(r.stopped_early),
      walletsExtracted: r.wallets_extracted as number,
      sightingsExtracted: r.sightings_extracted as number,
      metadata: JSON.parse(r.metadata as string) as Record<string, unknown>,
      createdAt: r.created_at as number,
    }));
  }

  getLatestProviderRunMetrics(): ProviderRunMetric[] {
    const lastRun = this.getLastRun();
    return lastRun ? this.getProviderRunMetrics(lastRun.runId) : [];
  }

  // -------------------------------------------------------------------------
  // Token upsert
  // -------------------------------------------------------------------------

  upsertToken(token: DiscoveredToken): void {
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO tokens (mint, symbol, name, mcap_at_harvest, volume_24h_usd,
        holder_count, smart_wallet_count, kol_count, created_at,
        first_harvested_at, last_harvested_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(mint) DO UPDATE SET
        mcap_at_harvest = excluded.mcap_at_harvest,
        volume_24h_usd = excluded.volume_24h_usd,
        holder_count = excluded.holder_count,
        smart_wallet_count = excluded.smart_wallet_count,
        kol_count = excluded.kol_count,
        last_harvested_at = excluded.last_harvested_at
    `).run(
      token.mint,
      token.symbol,
      token.name,
      token.marketCapUsd,
      token.volume24hUsd,
      token.holderCount,
      token.smartWalletCount,
      token.kolCount,
      token.createdAt,
      now,
      now,
    );
  }

  // -------------------------------------------------------------------------
  // Wallet upsert (with source/tag merging)
  // -------------------------------------------------------------------------

  upsertWallet(wallet: ExtractedWallet): { isNew: boolean } {
    const existing = this.db.prepare(`
      SELECT sources, tags, token_count, first_seen, wallet_label, twitter_username,
        twitter_name, avatar_url, provider_tags, token_tags, metadata_snapshot_at
      FROM wallets WHERE address = ?
    `).get(wallet.address) as {
      sources: string;
      tags: string;
      token_count: number;
      first_seen: number;
      wallet_label: string | null;
      twitter_username: string | null;
      twitter_name: string | null;
      avatar_url: string | null;
      provider_tags: string;
      token_tags: string;
      metadata_snapshot_at: number | null;
    } | undefined;

    const now = Date.now();
    const countsAsNewToken = wallet.mint
      ? !this.hasWalletTokenSighting(wallet.address, wallet.mint)
      : false;

    if (!existing) {
      this.db.prepare(`
        INSERT INTO wallets (address, sources, tags, first_seen, last_seen,
          token_count, pnl_usd, win_rate, avg_buy_usd, pnl_snapshot_at,
          wallet_label, twitter_username, twitter_name, avatar_url,
          provider_tags, token_tags, metadata_snapshot_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        wallet.address,
        JSON.stringify([wallet.source]),
        JSON.stringify(wallet.tags),
        now,
        now,
        countsAsNewToken ? 1 : 0,
        wallet.pnlUsd,
        wallet.winRate,
        wallet.avgBuyUsd,
        wallet.pnlUsd != null ? now : null,
        normalizedText(wallet.walletLabel),
        normalizedText(wallet.twitterUsername),
        normalizedText(wallet.twitterName),
        normalizedText(wallet.avatarUrl),
        JSON.stringify(uniqueStrings(wallet.providerTags ?? [])),
        JSON.stringify(uniqueStrings(wallet.tokenTags ?? [])),
        wallet.metadataSnapshotAt ?? (hasPublicMetadata(wallet) ? now : null),
      );
      return { isNew: true };
    }

    // Merge sources
    const existingSources: Source[] = JSON.parse(existing.sources);
    if (!existingSources.includes(wallet.source)) {
      existingSources.push(wallet.source);
    }

    // Merge tags
    const existingTags: WalletTag[] = JSON.parse(existing.tags);
    for (const tag of wallet.tags) {
      if (!existingTags.includes(tag)) {
        existingTags.push(tag);
      }
    }

    const providerTags = mergeStringArrays(parseStringArray(existing.provider_tags), wallet.providerTags ?? []);
    const tokenTags = mergeStringArrays(parseStringArray(existing.token_tags), wallet.tokenTags ?? []);
    const incomingMetadataAt = wallet.metadataSnapshotAt ?? (hasPublicMetadata(wallet) ? now : null);
    const metadataSnapshotAt = incomingMetadataAt
      ? Math.max(existing.metadata_snapshot_at ?? 0, incomingMetadataAt)
      : existing.metadata_snapshot_at;

    this.db.prepare(`
      UPDATE wallets SET
        sources = ?,
        tags = ?,
        wallet_label = COALESCE(NULLIF(?, ''), wallet_label),
        twitter_username = COALESCE(NULLIF(?, ''), twitter_username),
        twitter_name = COALESCE(NULLIF(?, ''), twitter_name),
        avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
        provider_tags = ?,
        token_tags = ?,
        metadata_snapshot_at = COALESCE(?, metadata_snapshot_at),
        last_seen = ?,
        token_count = token_count + ?,
        pnl_usd = COALESCE(?, pnl_usd),
        win_rate = COALESCE(?, win_rate),
        avg_buy_usd = COALESCE(?, avg_buy_usd),
        pnl_snapshot_at = CASE WHEN ? IS NOT NULL THEN ? ELSE pnl_snapshot_at END
      WHERE address = ?
    `).run(
      JSON.stringify(existingSources),
      JSON.stringify(existingTags),
      normalizedText(wallet.walletLabel) ?? "",
      normalizedText(wallet.twitterUsername) ?? "",
      normalizedText(wallet.twitterName) ?? "",
      normalizedText(wallet.avatarUrl) ?? "",
      JSON.stringify(providerTags),
      JSON.stringify(tokenTags),
      metadataSnapshotAt,
      now,
      countsAsNewToken ? 1 : 0,
      wallet.pnlUsd,
      wallet.winRate,
      wallet.avgBuyUsd,
      wallet.pnlUsd, now,
      wallet.address,
    );
    return { isNew: false };
  }

  updateWalletPublicMetadata(wallet: ExtractedWallet): boolean {
    const existing = this.db.prepare(`
      SELECT sources, tags, wallet_label, twitter_username, twitter_name, avatar_url,
        provider_tags, token_tags, metadata_snapshot_at
      FROM wallets WHERE address = ?
    `).get(wallet.address) as {
      sources: string;
      tags: string;
      wallet_label: string | null;
      twitter_username: string | null;
      twitter_name: string | null;
      avatar_url: string | null;
      provider_tags: string;
      token_tags: string;
      metadata_snapshot_at: number | null;
    } | undefined;
    if (!existing) return false;

    const sources = mergeStringArrays(parseStringArray(existing.sources), [wallet.source]) as Source[];
    const tags = mergeStringArrays(parseStringArray(existing.tags), wallet.tags);
    const providerTags = mergeStringArrays(parseStringArray(existing.provider_tags), wallet.providerTags ?? []);
    const tokenTags = mergeStringArrays(parseStringArray(existing.token_tags), wallet.tokenTags ?? []);
    const metadataAt = wallet.metadataSnapshotAt ?? (hasPublicMetadata(wallet) ? Date.now() : null);
    const metadataSnapshotAt = metadataAt
      ? Math.max(existing.metadata_snapshot_at ?? 0, metadataAt)
      : existing.metadata_snapshot_at;

    this.db.prepare(`
      UPDATE wallets SET
        sources = ?,
        tags = ?,
        wallet_label = COALESCE(NULLIF(?, ''), wallet_label),
        twitter_username = COALESCE(NULLIF(?, ''), twitter_username),
        twitter_name = COALESCE(NULLIF(?, ''), twitter_name),
        avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
        provider_tags = ?,
        token_tags = ?,
        metadata_snapshot_at = COALESCE(?, metadata_snapshot_at)
      WHERE address = ?
    `).run(
      JSON.stringify(sources),
      JSON.stringify(tags),
      normalizedText(wallet.walletLabel) ?? "",
      normalizedText(wallet.twitterUsername) ?? "",
      normalizedText(wallet.twitterName) ?? "",
      normalizedText(wallet.avatarUrl) ?? "",
      JSON.stringify(providerTags),
      JSON.stringify(tokenTags),
      metadataSnapshotAt,
      wallet.address,
    );
    return true;
  }

  // -------------------------------------------------------------------------
  // Sighting insert (skip duplicates)
  // -------------------------------------------------------------------------

  insertSighting(sighting: SightingRecord): boolean {
    try {
      this.db.prepare(`
        INSERT INTO sightings (wallet_address, mint, action, amount_usd,
          token_mcap_usd, timestamp, source, signal_type, run_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sighting.walletAddress,
        sighting.mint,
        sighting.action,
        sighting.amountUsd,
        sighting.tokenMcapUsd,
        sighting.timestamp,
        sighting.source,
        sighting.signalType,
        sighting.runId,
      );
      return true;
    } catch (err: unknown) {
      // UNIQUE constraint violation = duplicate sighting, skip silently
      if (err instanceof Error && err.message.includes("UNIQUE constraint")) {
        return false;
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Batch operations (transactional)
  // -------------------------------------------------------------------------

  ingestWallets(wallets: ExtractedWallet[], runId: string): { newCount: number; updatedCount: number; sightingCount: number } {
    let newCount = 0;
    let updatedCount = 0;
    let sightingCount = 0;

    const txn = this.db.transaction(() => {
      for (const w of wallets) {
        const { isNew } = this.upsertWallet(w);
        if (isNew) newCount++;
        else updatedCount++;

        const inserted = this.insertSighting({
          walletAddress: w.address,
          mint: w.mint,
          action: w.action,
          amountUsd: w.amountUsd,
          tokenMcapUsd: w.tokenMcapUsd,
          timestamp: w.timestamp,
          source: w.source,
          signalType: w.signalType,
          runId,
        });
        if (inserted) sightingCount++;
      }
    });
    txn();

    return { newCount, updatedCount, sightingCount };
  }

  private hasWalletTokenSighting(walletAddress: string, mint: string): boolean {
    const row = this.db.prepare(`
      SELECT 1 FROM sightings
      WHERE wallet_address = ? AND mint = ?
      LIMIT 1
    `).get(walletAddress, mint);
    return Boolean(row);
  }

  // -------------------------------------------------------------------------
  // Query helpers
  // -------------------------------------------------------------------------

  getWalletCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM wallets").get() as { cnt: number };
    return row.cnt;
  }

  getSightingCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM sightings").get() as { cnt: number };
    return row.cnt;
  }

  getTokenCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM tokens").get() as { cnt: number };
    return row.cnt;
  }

  getRunCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) AS cnt FROM runs").get() as { cnt: number };
    return row.cnt;
  }

  getTopWalletsByTokenCount(limit = 50): WalletRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM wallets ORDER BY token_count DESC LIMIT ?
    `).all(limit) as Record<string, unknown>[];
    return rows.map(r => this.mapWalletRow(r));
  }

  getDualSourceWallets(): WalletRecord[] {
    const rows = this.db.prepare(`
      SELECT * FROM wallets
      WHERE sources LIKE '%gmgn%' AND sources LIKE '%okx%'
      ORDER BY token_count DESC
    `).all() as Record<string, unknown>[];
    return rows.map(r => this.mapWalletRow(r));
  }

  getWalletSourceCounts(): { gmgnOnly: number; okxOnly: number; dualSource: number } {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN sources LIKE '%gmgn%' AND sources NOT LIKE '%okx%' THEN 1 ELSE 0 END) AS gmgn_only,
        SUM(CASE WHEN sources LIKE '%okx%' AND sources NOT LIKE '%gmgn%' THEN 1 ELSE 0 END) AS okx_only,
        SUM(CASE WHEN sources LIKE '%gmgn%' AND sources LIKE '%okx%' THEN 1 ELSE 0 END) AS dual_source
      FROM wallets
    `).get() as { gmgn_only: number | null; okx_only: number | null; dual_source: number | null };
    return {
      gmgnOnly: row.gmgn_only ?? 0,
      okxOnly: row.okx_only ?? 0,
      dualSource: row.dual_source ?? 0,
    };
  }

  getSightingSourceCounts(): { gmgn: number; okx: number } {
    const row = this.db.prepare(`
      SELECT
        SUM(CASE WHEN source = 'gmgn' THEN 1 ELSE 0 END) AS gmgn,
        SUM(CASE WHEN source = 'okx' THEN 1 ELSE 0 END) AS okx
      FROM sightings
    `).get() as { gmgn: number | null; okx: number | null };
    return {
      gmgn: row.gmgn ?? 0,
      okx: row.okx ?? 0,
    };
  }

  getWalletReviewRows(limit = 2000): Array<{
    address: string;
    sources: Source[];
    tags: WalletTag[];
    walletLabel: string | null;
    twitterUsername: string | null;
    twitterName: string | null;
    avatarUrl: string | null;
    providerTags: string[];
    tokenTags: string[];
    metadataSnapshotAt: number | null;
    sourceType: "dual" | "gmgn_only" | "okx_only";
    tokenCount: number;
    totalSightings: number;
    gmgnSightings: number;
    okxSightings: number;
    pnlUsd: number | null;
    winRate: number | null;
    avgBuyUsd: number | null;
    firstSeen: number;
    lastSeen: number;
  }> {
    const rows = this.db.prepare(`
      SELECT
        w.address,
        w.sources,
        w.tags,
        w.wallet_label,
        w.twitter_username,
        w.twitter_name,
        w.avatar_url,
        w.provider_tags,
        w.token_tags,
        w.metadata_snapshot_at,
        w.token_count,
        w.pnl_usd,
        w.win_rate,
        w.avg_buy_usd,
        w.first_seen,
        w.last_seen,
        COUNT(s.id) AS total_sightings,
        SUM(CASE WHEN s.source = 'gmgn' THEN 1 ELSE 0 END) AS gmgn_sightings,
        SUM(CASE WHEN s.source = 'okx' THEN 1 ELSE 0 END) AS okx_sightings
      FROM wallets w
      LEFT JOIN sightings s ON s.wallet_address = w.address
      GROUP BY w.address
      ORDER BY
        CASE WHEN w.sources LIKE '%gmgn%' AND w.sources LIKE '%okx%' THEN 0 ELSE 1 END,
        w.token_count DESC,
        w.last_seen DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    return rows.map(r => {
      const sources = JSON.parse(r.sources as string) as Source[];
      const tags = JSON.parse(r.tags as string) as WalletTag[];
      const hasGmgn = sources.includes("gmgn");
      const hasOkx = sources.includes("okx");
      return {
        address: r.address as string,
        sources,
        tags,
        walletLabel: r.wallet_label as string | null,
        twitterUsername: r.twitter_username as string | null,
        twitterName: r.twitter_name as string | null,
        avatarUrl: r.avatar_url as string | null,
        providerTags: parseStringArray(r.provider_tags as string),
        tokenTags: parseStringArray(r.token_tags as string),
        metadataSnapshotAt: r.metadata_snapshot_at as number | null,
        sourceType: hasGmgn && hasOkx ? "dual" : hasGmgn ? "gmgn_only" : "okx_only",
        tokenCount: r.token_count as number,
        totalSightings: r.total_sightings as number,
        gmgnSightings: (r.gmgn_sightings as number | null) ?? 0,
        okxSightings: (r.okx_sightings as number | null) ?? 0,
        pnlUsd: r.pnl_usd as number | null,
        winRate: r.win_rate as number | null,
        avgBuyUsd: r.avg_buy_usd as number | null,
        firstSeen: r.first_seen as number,
        lastSeen: r.last_seen as number,
      };
    });
  }

  getGmgnRenownedMintContexts(limit?: number): DiscoveredToken[] {
    const limitClause = limit && limit > 0 ? "LIMIT ?" : "";
    const params = limit && limit > 0 ? [limit] : [];
    const rows = this.db.prepare(`
      SELECT
        s.mint,
        COALESCE(t.symbol, '') AS symbol,
        COALESCE(t.name, '') AS name,
        COALESCE(t.mcap_at_harvest, 0) AS market_cap_usd,
        COALESCE(t.volume_24h_usd, 0) AS volume_24h_usd,
        COALESCE(t.holder_count, 0) AS holder_count,
        COALESCE(t.smart_wallet_count, 0) AS smart_wallet_count,
        COALESCE(t.kol_count, 0) AS kol_count,
        COALESCE(t.created_at, 0) AS created_at,
        MAX(s.timestamp) AS last_seen
      FROM sightings s
      LEFT JOIN tokens t ON t.mint = s.mint
      WHERE s.source = 'gmgn'
        AND s.mint <> ''
        AND s.signal_type LIKE 'renowned_%'
      GROUP BY s.mint
      ORDER BY last_seen DESC
      ${limitClause}
    `).all(...params) as Record<string, unknown>[];

    return rows.map(row => ({
      mint: row.mint as string,
      symbol: row.symbol as string,
      name: row.name as string,
      chain: "sol",
      marketCapUsd: row.market_cap_usd as number,
      volume24hUsd: row.volume_24h_usd as number,
      holderCount: row.holder_count as number,
      smartWalletCount: row.smart_wallet_count as number,
      kolCount: row.kol_count as number,
      createdAt: (row.created_at as number) || (row.last_seen as number) || Date.now(),
      discoverySource: "gmgn",
      discoveryMethod: "gmgn_renowned_backfill",
    }));
  }

  /** Raw SQL query for hypothesis testing */
  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  // -------------------------------------------------------------------------
  // Row mappers
  // -------------------------------------------------------------------------

  private mapWalletRow(r: Record<string, unknown>): WalletRecord {
    return {
      address: r.address as string,
      sources: JSON.parse(r.sources as string) as Source[],
      tags: JSON.parse(r.tags as string) as WalletTag[],
      walletLabel: r.wallet_label as string | null,
      twitterUsername: r.twitter_username as string | null,
      twitterName: r.twitter_name as string | null,
      avatarUrl: r.avatar_url as string | null,
      providerTags: parseStringArray(r.provider_tags as string),
      tokenTags: parseStringArray(r.token_tags as string),
      metadataSnapshotAt: r.metadata_snapshot_at as number | null,
      firstSeen: r.first_seen as number,
      lastSeen: r.last_seen as number,
      tokenCount: r.token_count as number,
      pnlUsd: r.pnl_usd as number | null,
      winRate: r.win_rate as number | null,
      avgBuyUsd: r.avg_buy_usd as number | null,
      pnlSnapshotAt: r.pnl_snapshot_at as number | null,
    };
  }

  private mapRunRow(r: Record<string, unknown>): RunRecord {
    return {
      runId: r.run_id as string,
      startedAt: r.started_at as number,
      finishedAt: r.finished_at as number | null,
      tokensDiscovered: r.tokens_discovered as number,
      tokensHarvested: r.tokens_harvested as number,
      walletsNew: r.wallets_new as number,
      walletsUpdated: r.wallets_updated as number,
      sightingsAdded: r.sightings_added as number,
      errors: JSON.parse(r.errors as string) as string[],
      status: r.status as RunRecord["status"],
    };
  }

  close(): void {
    this.db.close();
  }

  private migrateWalletMetadataColumns(): void {
    const columns = this.db.prepare("PRAGMA table_info(wallets)").all() as Array<{ name: string }>;
    const existing = new Set(columns.map(column => column.name));
    const additions: Array<[string, string]> = [
      ["wallet_label", "TEXT"],
      ["twitter_username", "TEXT"],
      ["twitter_name", "TEXT"],
      ["avatar_url", "TEXT"],
      ["provider_tags", "TEXT NOT NULL DEFAULT '[]'"],
      ["token_tags", "TEXT NOT NULL DEFAULT '[]'"],
      ["metadata_snapshot_at", "INTEGER"],
    ];

    for (const [name, definition] of additions) {
      if (!existing.has(name)) {
        this.db.prepare(`ALTER TABLE wallets ADD COLUMN ${name} ${definition}`).run();
      }
    }
  }
}

function normalizedText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map(value => value.trim()).filter(Boolean))];
}

function mergeStringArrays(existing: string[], incoming: string[]): string[] {
  return uniqueStrings([...existing, ...incoming]);
}

function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? uniqueStrings(parsed.filter((item): item is string => typeof item === "string")) : [];
  } catch {
    return [];
  }
}

function hasPublicMetadata(wallet: ExtractedWallet): boolean {
  return Boolean(
    normalizedText(wallet.walletLabel) ||
    normalizedText(wallet.twitterUsername) ||
    normalizedText(wallet.twitterName) ||
    normalizedText(wallet.avatarUrl) ||
    (wallet.providerTags?.length ?? 0) > 0 ||
    (wallet.tokenTags?.length ?? 0) > 0
  );
}

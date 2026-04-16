import type { TokenInfo } from "../types";
import { Badge } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { ShieldCheck, ShieldAlert, Lock, Unlock, AlertTriangle, Users } from "lucide-react";

function fmtShortUsd(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function organicVariant(label: string): "gain" | "warning" | "loss" {
  if (label === "high") return "gain";
  if (label === "medium") return "warning";
  return "loss";
}

export function TokenInfoBadges({ info, compact = false }: { info: TokenInfo; compact?: boolean }) {
  const a = info.audit;
  const dangerSus = a.isSus === true;
  const dangerMint = !a.mintAuthorityDisabled;
  const dangerFreeze = !a.freezeAuthorityDisabled;
  const dangerConcentration = a.topHoldersPercentage > 30;
  const dangerDevHistory = a.devMigrations >= 5 || a.devMints >= 50;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Verified pill */}
      {info.verified ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="gain" className="gap-1">
                <ShieldCheck className="h-3 w-3" /> JUP
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Jupiter verified</TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="muted" className="gap-1">
                <ShieldAlert className="h-3 w-3" /> UNVERIFIED
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Not Jupiter verified — common for fresh meme tokens</TooltipContent>
        </Tooltip>
      )}

      {/* Organic score */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Badge variant={organicVariant(info.organicScoreLabel)} className="font-mono uppercase">
              ORGANIC {info.organicScoreLabel}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          Organic score {info.organicScore.toFixed(0)}/100 — {info.organicScoreLabel} genuine activity
          (filters wash & bot trading)
        </TooltipContent>
      </Tooltip>

      {/* Mint / freeze authority */}
      {dangerMint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="loss" className="gap-1">
                <Unlock className="h-3 w-3" /> MINT
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Mint authority NOT disabled — dev can mint more supply</TooltipContent>
        </Tooltip>
      )}
      {dangerFreeze && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="loss" className="gap-1">
                <Unlock className="h-3 w-3" /> FREEZE
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Freeze authority NOT disabled — dev can freeze your tokens</TooltipContent>
        </Tooltip>
      )}
      {!dangerMint && !dangerFreeze && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="muted" className="gap-1 text-muted-foreground">
                <Lock className="h-3 w-3" /> SAFE AUTH
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Mint &amp; freeze authority both disabled</TooltipContent>
        </Tooltip>
      )}

      {/* Sus flag */}
      {dangerSus && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="loss" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> SUS
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Jupiter flagged this token as suspicious</TooltipContent>
        </Tooltip>
      )}

      {/* Top holder concentration */}
      {dangerConcentration && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="warning" className="font-mono">
                TOP10 {a.topHoldersPercentage.toFixed(0)}%
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>Top 10 holders own {a.topHoldersPercentage.toFixed(1)}% — concentrated</TooltipContent>
        </Tooltip>
      )}

      {/* Dev migration history (NOT current dev hold — just informational) */}
      {dangerDevHistory && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <Badge variant="warning" className="font-mono">
                DEV {a.devMints}M / {a.devMigrations}MIG
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Dev created {a.devMints} tokens, migrated {a.devMigrations}. Past behavior only — informational.
          </TooltipContent>
        </Tooltip>
      )}

      {/* Compact mode hides the longer info row */}
      {!compact && (
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
          <Users className="inline h-3 w-3 mr-0.5 align-text-bottom" />{info.holderCount} ·
          mc {fmtShortUsd(info.mcapUsd)} ·
          liq {fmtShortUsd(info.liquidityUsd)}
        </span>
      )}
    </div>
  );
}

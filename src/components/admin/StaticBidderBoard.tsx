import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatINR } from "@/lib/auction-report";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Gavel,
  RotateCcw,
  Shield,
  Tag,
  UserPlus,
  Trophy,
  Users,
} from "lucide-react";

const TEAM_ACCENTS = [
  "border-amber-500/40 bg-amber-500/10",
  "border-sky-500/40 bg-sky-500/10",
  "border-emerald-500/40 bg-emerald-500/10",
  "border-violet-500/40 bg-violet-500/10",
  "border-pink-500/40 bg-pink-500/10",
  "border-teal-500/40 bg-teal-500/10",
];

const TEAM_BAR = [
  "bg-amber-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-pink-500",
  "bg-teal-500",
];

const BID_INCREMENTS = [100, 500, 1000, 5000];

type Player = {
  id: string;
  name: string;
  role: string;
  basePrice: number;
  teamId: string | null;
  isUnsold: boolean;
  photo?: string | null;
  age?: number | null;
  batsmanType?: string | null;
  bowlerType?: string | null;
};

type Sale = {
  playerId: string;
  teamId: string;
  price: number;
  player: { name: string; role?: string };
  team: { name: string };
};

type Props = {
  auctionName: string;
  completed: boolean;
  loading: boolean;
  summary: { sold: number; unsold: number; pending: number; total: number };
  currentPlayer: Player | null;
  amount: string;
  amountNum: number;
  selectedTeamId: string;
  selectedTeamName?: string;
  currentPlayerSale?: Sale;
  teams: Array<{
    team: {
      id: string;
      name: string;
      wallet: number;
      captain?: string | null;
    };
  }>;
  maxSquadSize: number;
  rosterByTeam: Map<string, Sale[]>;
  maxTeamSpent: number;
  orderedPlayers: Array<{ sortOrder: number; player: Player }>;
  saleByPlayer: Map<string, Sale>;
  unsoldSet: Set<string>;
  currentPlayerId: string | null;
  showTeamsDialog: boolean;
  showQueue: boolean;
  onAmountChange: (v: string) => void;
  onAddIncrement: (inc: number) => void;
  onSelectTeam: (id: string) => void;
  onRegisterSale: () => void;
  onRegisterUnsold: () => void;
  undoTarget: {
    playerId: string;
    name: string;
    kind: "sale" | "unsold";
    detail: string;
  } | null;
  commentary: string[];
  onUndoLast: () => void;
  onUndoPlayer: (playerId: string) => void;
  onSetCurrent: (playerId: string) => void;
  onExport: (type: "csv" | "pdf") => void;
  onComplete: () => void;
  onReopen: () => void;
  onStartFresh: () => void;
  onShowTeamsDialog: (open: boolean) => void;
  onShowQueue: (open: boolean) => void;
};

function PlayerQueueList({
  props,
  className,
}: {
  props: Props;
  className?: string;
}) {
  return (
    <div className={className}>
      {props.orderedPlayers.map((ap, idx) => {
        const p = ap.player;
        const sale = props.saleByPlayer.get(p.id);
        const isUnsold = p.isUnsold || props.unsoldSet.has(p.id);
        const isCurrent = props.currentPlayerId === p.id;
        const isPending = !sale && !isUnsold;

        return (
          <div
            key={p.id}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs ${
              isCurrent
                ? "bg-amber-500/15 border border-amber-500/30"
                : "hover:bg-white/5"
            }`}
          >
            <button
              type="button"
              className="flex-1 text-left min-w-0 truncate"
              disabled={props.completed || !isPending}
              onClick={() => isPending && props.onSetCurrent(p.id)}
            >
              <span className="text-gray-500 mr-1">{idx + 1}.</span>
              <span className="text-white">{p.name}</span>
              {sale && (
                <span className="text-emerald-400 ml-1 hidden xl:inline">
                  → {formatINR(sale.price)}
                </span>
              )}
              {isUnsold && !sale && (
                <span className="text-orange-400 ml-1">Unsold</span>
              )}
            </button>
            {!props.completed && (sale || isUnsold) && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={props.loading}
                onClick={() => props.onUndoPlayer(p.id)}
                className="shrink-0 h-6 w-6 p-0 text-violet-400 hover:text-violet-300"
                title={`Undo ${p.name}`}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StaticBidderBoard(props: Props) {
  const displayAmount =
    props.amountNum > 0
      ? props.amountNum
      : Math.round(props.currentPlayer?.basePrice || 0);

  const teamOptions = useMemo(
    () =>
      props.teams.map((at) => ({
        id: at.team.id,
        label: `${at.team.name} · ${formatINR(at.team.wallet)}`,
      })),
    [props.teams]
  );

  const playerTags = props.currentPlayer ? (
    <div className="flex flex-wrap gap-1">
      <span className="rounded-full bg-violet-600/80 px-2 py-0.5 text-[10px] font-medium text-white">
        {props.currentPlayer.role}
      </span>
      {props.currentPlayer.age ? (
        <span className="rounded-full bg-amber-600/80 px-2 py-0.5 text-[10px] text-white">
          {props.currentPlayer.age}y
        </span>
      ) : null}
      {props.currentPlayer.batsmanType ? (
        <span className="rounded-full bg-sky-600/80 px-2 py-0.5 text-[10px] text-white truncate max-w-[140px]">
          {props.currentPlayer.batsmanType}
        </span>
      ) : null}
      {props.currentPlayer.bowlerType &&
      props.currentPlayer.bowlerType !== "None" &&
      props.currentPlayer.bowlerType.toUpperCase() !== "N/A" ? (
        <span className="rounded-full bg-emerald-600/80 px-2 py-0.5 text-[10px] text-white truncate max-w-[140px]">
          {props.currentPlayer.bowlerType}
        </span>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-2 lg:gap-3 lg:h-[calc(100vh-5.5rem)] lg:max-h-[calc(100vh-5.5rem)] max-w-[1400px] mx-auto w-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 px-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-medium text-emerald-300">
              Admin
            </span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 truncate">
            {props.auctionName} · {props.summary.sold}/{props.summary.total}{" "}
            sold · {props.summary.pending} pending
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => props.onShowTeamsDialog(true)}
            className="h-8 border-white/15 bg-white/5 text-gray-200 text-xs"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" />
            Teams
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport("csv")}
            disabled={props.loading}
            className="h-8 text-gray-400 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport("pdf")}
            disabled={props.loading}
            className="h-8 text-gray-400 text-xs"
          >
            <FileText className="w-3.5 h-3.5" />
          </Button>
          {!props.completed ? (
            <Button
              size="sm"
              onClick={props.onComplete}
              disabled={props.loading}
              className="h-8 bg-amber-500/90 hover:bg-amber-500 text-black text-xs"
            >
              Complete
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={props.onReopen}
                disabled={props.loading}
                className="h-8 bg-emerald-600 text-white text-xs"
              >
                Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={props.onStartFresh}
                disabled={props.loading}
                className="h-8 text-gray-400 text-xs"
              >
                New
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main board — 3 columns on desktop */}
      <div className="flex-1 min-h-0 rounded-xl lg:rounded-2xl border border-white/10 bg-[#121820] overflow-hidden flex flex-col shadow-2xl">
        <div className="shrink-0 border-b border-white/5 px-3 py-2 lg:py-2.5 text-center lg:hidden">
          <h2 className="text-base font-bold text-white">Single Bidder Mode</h2>
        </div>

        {props.currentPlayer ? (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Player + amount + commentary */}
            <div className="shrink-0 lg:w-[240px] xl:w-[280px] lg:border-r border-white/5 p-3 lg:p-3 flex flex-col gap-2 lg:gap-2.5 lg:min-h-0 lg:overflow-hidden border-b lg:border-b-0 border-white/5">
              <div className="flex items-center gap-3 lg:flex-col lg:gap-2 lg:text-center shrink-0">
                {props.currentPlayer.photo ? (
                  <img
                    src={props.currentPlayer.photo}
                    alt=""
                    className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-full object-cover ring-2 ring-amber-500/60 shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 lg:w-[72px] lg:h-[72px] rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-amber-500/60 shrink-0">
                    {props.currentPlayer.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1 lg:flex-none">
                  <h3 className="text-lg font-bold text-white truncate">
                    {props.currentPlayer.name}
                  </h3>
                  <div className="mt-1 lg:flex lg:justify-center">{playerTags}</div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-center shrink-0">
                <p className="text-[10px] uppercase tracking-wide text-amber-400/80">
                  Sale amount
                </p>
                <p className="text-2xl font-bold text-amber-400 tabular-nums leading-tight">
                  {formatINR(displayAmount)}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                  {props.selectedTeamName
                    ? `→ ${props.selectedTeamName}`
                    : `Base ${formatINR(props.currentPlayer.basePrice)}`}
                </p>
              </div>

              <div className="hidden lg:flex flex-col flex-1 min-h-0 rounded-lg border border-amber-500/20 bg-[#0f1419]/80 overflow-hidden">
                <h4 className="shrink-0 px-2.5 py-2 text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Live Commentary
                </h4>
                <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-1.5 space-y-1">
                  {props.commentary.map((line, i) => (
                    <p
                      key={`${line}-${i}`}
                      className={`text-[11px] leading-snug border-b border-white/5 pb-1 ${
                        i === 0 ? "text-white" : "text-white/75"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions panel */}
            <div className="flex-1 min-h-0 flex flex-col p-3 lg:p-4 lg:justify-center gap-3">
              {!props.completed && (
                <>
                  <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-[10px] uppercase tracking-wide text-amber-400/90 font-medium">
                        Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={props.amount}
                          onChange={(e) =>
                            props.onAmountChange(e.target.value)
                          }
                          className="pl-7 h-10 w-full bg-[#1a2332] border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5 min-w-0">
                      <label className="text-[10px] uppercase tracking-wide text-amber-400/90 font-medium">
                        Winning team
                      </label>
                      <Select
                        value={props.selectedTeamId}
                        onValueChange={props.onSelectTeam}
                      >
                        <SelectTrigger className="h-10 w-full bg-[#1a2332] border-white/15 text-white text-sm">
                          <SelectValue placeholder="Select team" />
                        </SelectTrigger>
                        <SelectContent>
                          {teamOptions.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {BID_INCREMENTS.map((inc) => (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => props.onAddIncrement(inc)}
                        className="rounded-md border border-white/10 bg-[#1a2332] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/10"
                      >
                        +{inc.toLocaleString("en-IN")}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      onClick={props.onRegisterSale}
                      disabled={props.loading || !props.selectedTeamId}
                      className="h-11 lg:h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
                    >
                      <Gavel className="w-4 h-4 mr-1.5 shrink-0" />
                      Sold
                    </Button>
                    <Button
                      onClick={props.onRegisterUnsold}
                      disabled={props.loading}
                      className="h-11 lg:h-12 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-sm"
                    >
                      <Tag className="w-4 h-4 mr-1.5 shrink-0" />
                      Unsold
                    </Button>
                    <Button
                      onClick={props.onUndoLast}
                      disabled={props.loading || !props.undoTarget}
                      title={
                        props.undoTarget
                          ? `Undo ${props.undoTarget.name}`
                          : undefined
                      }
                      className="h-11 lg:h-12 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm disabled:opacity-40"
                    >
                      <RotateCcw className="w-4 h-4 mr-1.5 shrink-0" />
                      <span className="truncate">Undo</span>
                    </Button>
                  </div>

                  {props.undoTarget && (
                    <p className="text-[10px] text-gray-500 truncate hidden lg:block">
                      Undo last: {props.undoTarget.name}
                      {props.undoTarget.detail
                        ? ` · ${props.undoTarget.detail}`
                        : " · unsold"}
                    </p>
                  )}
                </>
              )}

              {/* Mobile commentary */}
              <div className="lg:hidden rounded-lg border border-amber-500/20 bg-[#0f1419]/80 overflow-hidden max-h-28">
                <h4 className="px-2.5 py-1.5 text-xs font-bold text-white flex items-center gap-1.5 border-b border-white/5">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  Commentary
                </h4>
                <div className="overflow-y-auto max-h-20 px-2.5 py-1 space-y-0.5">
                  {props.commentary.map((line, i) => (
                    <p
                      key={`m-${line}-${i}`}
                      className="text-[11px] text-white/85 border-b border-white/5 pb-0.5"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {/* Queue sidebar — desktop */}
            <div className="hidden lg:flex lg:w-[220px] xl:w-[260px] flex-col border-l border-white/5 min-h-0">
              <div className="shrink-0 px-3 py-2 border-b border-white/5">
                <p className="text-xs font-semibold text-white">
                  Queue
                </p>
                <p className="text-[10px] text-gray-500">
                  {props.summary.pending} pending · CSV order
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
                <PlayerQueueList props={props} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-gray-400 text-sm text-center">
            {props.completed
              ? "Auction completed — export PDF for full rosters."
              : "All players processed — export or mark complete."}
          </div>
        )}
      </div>

      {/* Queue — mobile collapsible */}
      <div className="lg:hidden rounded-xl border border-white/10 bg-[#121820] overflow-hidden shrink-0">
        <button
          type="button"
          onClick={() => props.onShowQueue(!props.showQueue)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left"
        >
          <span className="text-sm font-semibold text-white">
            Queue ({props.summary.pending} pending)
          </span>
          {props.showQueue ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {props.showQueue && (
          <div className="border-t border-white/5 max-h-48 overflow-y-auto p-1.5">
            <PlayerQueueList props={props} />
          </div>
        )}
      </div>

      <Dialog open={props.showTeamsDialog} onOpenChange={props.onShowTeamsDialog}>
        <DialogContent className="bg-[#121820] border-white/10 text-white max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Teams & rosters</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {props.teams.map((at, i) => {
              const roster = props.rosterByTeam.get(at.team.id) || [];
              const spent = roster.reduce((s, x) => s + x.price, 0);
              return (
                <div
                  key={at.team.id}
                  className={`rounded-xl border p-4 ${TEAM_ACCENTS[i % TEAM_ACCENTS.length]}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-white">
                        {at.team.name}
                      </div>
                      {at.team.captain && (
                        <div className="text-xs text-gray-400">
                          Captain: {at.team.captain}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <div className="text-amber-400">
                        {formatINR(spent)} spent
                      </div>
                      <div className="text-gray-400">
                        {formatINR(at.team.wallet)} left
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full ${TEAM_BAR[i % TEAM_BAR.length]}`}
                      style={{
                        width: `${Math.max((spent / props.maxTeamSpent) * 100, spent ? 4 : 0)}%`,
                      }}
                    />
                  </div>
                  <ul className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                    {roster.length === 0 ? (
                      <li className="text-xs text-gray-500 italic">
                        No players
                      </li>
                    ) : (
                      roster.map((s) => (
                        <li
                          key={s.playerId}
                          className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0"
                        >
                          <span>{s.player.name}</span>
                          <span className="text-emerald-400 font-medium">
                            {formatINR(s.price)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                  <div className="text-[11px] text-gray-500 mt-2">
                    Squad {roster.length}/{props.maxSquadSize || 25}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const MemoStaticBidderBoard = memo(StaticBidderBoard);
export { MemoStaticBidderBoard as default };

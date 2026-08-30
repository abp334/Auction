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
  Info,
  RotateCcw,
  Shield,
  Tag,
  UserPlus,
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
  onUndoCurrent: () => void;
  onSetCurrent: (playerId: string) => void;
  onExport: (type: "csv" | "pdf") => void;
  onComplete: () => void;
  onReopen: () => void;
  onStartFresh: () => void;
  onShowTeamsDialog: (open: boolean) => void;
  onShowQueue: (open: boolean) => void;
};

function StaticBidderBoard(props: Props) {
  const displayAmount =
    props.amountNum > 0
      ? props.amountNum
      : Math.round(props.currentPlayer?.basePrice || 0);

  const teamOptions = useMemo(
    () =>
      props.teams.map((at) => ({
        id: at.team.id,
        label: `${at.team.name} · ${formatINR(at.team.wallet)} left`,
      })),
    [props.teams]
  );

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-sm text-gray-500">
          {props.auctionName} · {props.summary.sold}/{props.summary.total} sold
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport("csv")}
            disabled={props.loading}
            className="text-gray-400 hover:text-white"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => props.onExport("pdf")}
            disabled={props.loading}
            className="text-gray-400 hover:text-white"
          >
            <FileText className="w-4 h-4 mr-1" /> PDF
          </Button>
          {!props.completed ? (
            <Button
              size="sm"
              onClick={props.onComplete}
              disabled={props.loading}
              className="bg-amber-500/90 hover:bg-amber-500 text-black text-xs"
            >
              Complete
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                onClick={props.onReopen}
                disabled={props.loading}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                Reopen
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={props.onStartFresh}
                disabled={props.loading}
                className="text-gray-400"
              >
                New ledger
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#121820] overflow-hidden shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 items-center border-b border-white/5">
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
              <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">
                  Admin Mode
                </div>
                <div className="text-[10px] text-emerald-400/70">
                  Only you can place bids
                </div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold text-white">
              Single Bidder Mode
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center justify-center gap-1">
              <Users className="w-3.5 h-3.5" />
              You are bidding on behalf of all teams
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => props.onShowTeamsDialog(true)}
              className="border-white/15 bg-white/5 text-gray-200 hover:bg-white/10"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              View Teams
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {props.currentPlayer ? (
            <>
              <div className="flex flex-col items-center text-center">
                {props.currentPlayer.photo ? (
                  <img
                    src={props.currentPlayer.photo}
                    alt=""
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover ring-4 ring-amber-500/60 ring-offset-4 ring-offset-[#121820]"
                  />
                ) : (
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-4xl font-bold text-white ring-4 ring-amber-500/60 ring-offset-4 ring-offset-[#121820]">
                    {props.currentPlayer.name.charAt(0)}
                  </div>
                )}
                <h3 className="mt-4 text-2xl sm:text-3xl font-bold text-white">
                  {props.currentPlayer.name}
                </h3>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  <span className="rounded-full bg-violet-600/80 px-3 py-1 text-xs font-medium text-white">
                    {props.currentPlayer.role}
                  </span>
                  {props.currentPlayer.age ? (
                    <span className="rounded-full bg-amber-600/80 px-3 py-1 text-xs font-medium text-white">
                      Age: {props.currentPlayer.age}
                    </span>
                  ) : null}
                  {props.currentPlayer.batsmanType ? (
                    <span className="rounded-full bg-sky-600/80 px-3 py-1 text-xs font-medium text-white">
                      🏏 {props.currentPlayer.batsmanType}
                    </span>
                  ) : null}
                  {props.currentPlayer.bowlerType &&
                  props.currentPlayer.bowlerType !== "None" &&
                  props.currentPlayer.bowlerType.toUpperCase() !== "N/A" ? (
                    <span className="rounded-full bg-emerald-600/80 px-3 py-1 text-xs font-medium text-white">
                      ⚾ {props.currentPlayer.bowlerType}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mx-auto max-w-md rounded-xl border border-amber-500/30 bg-amber-950/20 px-6 py-5 text-center">
                <p className="text-sm text-amber-400/90 font-medium">
                  Sale amount
                </p>
                <p className="text-4xl sm:text-5xl font-bold text-amber-400 mt-1 tabular-nums">
                  {formatINR(displayAmount)}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {props.selectedTeamName
                    ? `Assign to ${props.selectedTeamName}`
                    : props.currentPlayerSale
                      ? `Sold to ${props.currentPlayerSale.team.name}`
                      : `Base ${formatINR(props.currentPlayer.basePrice)}`}
                </p>
              </div>

              {!props.completed && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/10 bg-[#0f1419]/80 p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-amber-400">
                        Place Your Bid
                      </h4>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                          ₹
                        </span>
                        <Input
                          type="number"
                          value={props.amount}
                          onChange={(e) => props.onAmountChange(e.target.value)}
                          className="pl-8 bg-[#1a2332] border-white/10 text-white text-lg h-12"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {BID_INCREMENTS.map((inc) => (
                          <button
                            key={inc}
                            type="button"
                            onClick={() => props.onAddIncrement(inc)}
                            className="rounded-lg border border-white/10 bg-[#1a2332] py-2 text-xs font-medium text-gray-300 hover:bg-white/10 hover:text-white transition"
                          >
                            +{inc.toLocaleString("en-IN")}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={props.onRegisterSale}
                        disabled={props.loading || !props.selectedTeamId}
                        className="w-full h-12 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-base"
                      >
                        <Gavel className="w-5 h-5 mr-2" />
                        Bid {formatINR(displayAmount)}
                      </Button>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-[#0f1419]/80 p-4 space-y-2">
                      <h4 className="text-sm font-semibold text-amber-400 mb-3">
                        Record Outcome
                      </h4>
                      <button
                        type="button"
                        onClick={props.onRegisterSale}
                        disabled={props.loading || !props.selectedTeamId}
                        className="w-full flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-left hover:bg-emerald-500/20 transition disabled:opacity-40"
                      >
                        <Tag className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-emerald-300">
                            Sold
                          </div>
                          <div className="text-xs text-gray-400">
                            Assign this player to a team
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={props.onRegisterUnsold}
                        disabled={props.loading}
                        className="w-full flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-left hover:bg-orange-500/20 transition disabled:opacity-40"
                      >
                        <Users className="w-5 h-5 text-orange-400 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-orange-300">
                            Unsold
                          </div>
                          <div className="text-xs text-gray-400">
                            Player remains unsold
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={props.onUndoCurrent}
                        disabled={props.loading}
                        className="w-full flex items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3 text-left hover:bg-violet-500/20 transition disabled:opacity-40"
                      >
                        <RotateCcw className="w-5 h-5 text-violet-400 shrink-0" />
                        <div>
                          <div className="text-sm font-semibold text-violet-300">
                            Undo
                          </div>
                          <div className="text-xs text-gray-400">
                            Revert the last action on this player
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-amber-400">
                        Assign to Team (If Sold)
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Select the team this player will go to
                      </p>
                    </div>
                    <Select
                      value={props.selectedTeamId}
                      onValueChange={props.onSelectTeam}
                    >
                      <SelectTrigger className="w-full sm:w-64 bg-[#1a2332] border-white/15 text-white">
                        <SelectValue placeholder="Select Team" />
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

                  <div className="grid grid-cols-3 gap-3">
                    <Button
                      onClick={props.onRegisterSale}
                      disabled={props.loading || !props.selectedTeamId}
                      className="h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                      <Gavel className="w-5 h-5 mr-2" />
                      Sold
                    </Button>
                    <Button
                      onClick={props.onRegisterUnsold}
                      disabled={props.loading}
                      className="h-14 bg-orange-600 hover:bg-orange-500 text-white font-semibold"
                    >
                      <Tag className="w-5 h-5 mr-2" />
                      Unsold
                    </Button>
                    <Button
                      onClick={props.onUndoCurrent}
                      disabled={props.loading}
                      className="h-14 bg-violet-600 hover:bg-violet-500 text-white font-semibold"
                    >
                      <RotateCcw className="w-5 h-5 mr-2" />
                      Undo
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="py-16 text-center text-gray-400">
              {props.completed
                ? "Auction completed — export PDF for full rosters and charts."
                : "All players processed — export or mark complete."}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-sky-500/20 bg-sky-950/30 px-4 py-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-200/80 leading-relaxed">
              Note: You are the only one who can place bids in this auction. No
              timer — take as long as you need to record each sale from the
              physical floor.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#121820] overflow-hidden">
        <button
          type="button"
          onClick={() => props.onShowQueue(!props.showQueue)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition"
        >
          <span className="text-sm font-semibold text-white">
            Player queue · CSV order ({props.summary.pending} pending)
          </span>
          {props.showQueue ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>
        {props.showQueue && (
          <div className="border-t border-white/5 px-2 py-2 max-h-64 overflow-y-auto space-y-0.5">
            {props.orderedPlayers.map((ap, idx) => {
              const p = ap.player;
              const sale = props.saleByPlayer.get(p.id);
              const isUnsold = p.isUnsold || props.unsoldSet.has(p.id);
              const isCurrent = props.currentPlayerId === p.id;
              const isPending = !sale && !isUnsold;

              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                    isCurrent
                      ? "bg-amber-500/15 border border-amber-500/30"
                      : "hover:bg-white/5"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left min-w-0 text-sm"
                    disabled={props.completed || !isPending}
                    onClick={() => isPending && props.onSetCurrent(p.id)}
                  >
                    <span className="text-gray-500 mr-2">{idx + 1}.</span>
                    <span className="text-white">{p.name}</span>
                    {sale && (
                      <span className="text-emerald-400 text-xs ml-2">
                        → {sale.team.name} {formatINR(sale.price)}
                      </span>
                    )}
                    {isUnsold && !sale && (
                      <span className="text-orange-400 text-xs ml-2">
                        Unsold
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
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
                      <div className="text-amber-400">{formatINR(spent)} spent</div>
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
                      <li className="text-xs text-gray-500 italic">No players</li>
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

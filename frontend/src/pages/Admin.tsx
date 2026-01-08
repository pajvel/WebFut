import { useEffect, useMemo, useState } from "react";

import { Activity, GitMerge, Pencil, RefreshCw, Shield, Swords } from "lucide-react";

import {
  adminAddMatchMembers,
  adminBindStatePlayer,
  adminGetInteractionLogs,
  adminGetInteractions,
  adminRebuildInteractionLogs,
  adminRebuildRatingLogs,
  adminGetRatingLogs,
  adminPatchInteraction,
  adminGetState,
  adminListUsers,
  adminPatchSegment,
  adminPatchStatePlayer,
  adminRemoveMatchMember,
  fetchMatches,
  getMatch
} from "../lib/api";
import type { AdminUser, MatchDetail, MatchSummary } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { StatusCard } from "../components/StatusCard";
import { formatApiError } from "../lib/errors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

type StatePlayer = {
  player_id: string;
  global_rating: number;
  venue_ratings: Record<string, number>;
  role_tendencies?: Record<string, number>;
  is_guest: boolean;
  guest_matches: number;
  tier_bonus: number;
};

export function Admin() {
  const { me } = useAppContext();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statePlayers, setStatePlayers] = useState<StatePlayer[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("player");
  const [memberCanEdit, setMemberCanEdit] = useState(false);
  const [sortKey, setSortKey] = useState<"name" | "global" | "venueA" | "venueB">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editPlayer, setEditPlayer] = useState<StatePlayer | null>(null);
  const [editValues, setEditValues] = useState({
    global: "",
    venueA: "",
    venueB: "",
    bindTg: ""
  });
  const [bindSearch, setBindSearch] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [logPlayerId, setLogPlayerId] = useState("");
  const [logMatchId, setLogMatchId] = useState("");
  const [logItems, setLogItems] = useState<Array<{
    id: number;
    match_id: number;
    player_id: string;
    venue: string;
    delta: number;
    pre_global: number;
    post_global: number;
    pre_venue: number;
    post_venue: number;
    goals: number;
    assists: number;
    details?: Record<string, number>;
    created_at: string;
  }>>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixKind, setMatrixKind] = useState<"synergy" | "domination">("synergy");
  const [matrixVenue, setMatrixVenue] = useState("__global__");
  const [matrixPlayers, setMatrixPlayers] = useState<string[]>([]);
  const [matrixValues, setMatrixValues] = useState<number[][]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [cellEdit, setCellEdit] = useState<{ a: string; b: string; value: string } | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [interactionLogs, setInteractionLogs] = useState<Array<{
    id: number;
    context_id: number;
    match_id: number | null;
    venue: string;
    kind: string;
    player_a: string;
    player_b: string;
    value_before: number;
    value_after: number;
    source: string;
    created_at: string;
  }>>([]);
  const [interactionLogPlayer, setInteractionLogPlayer] = useState("");

  const isAdmin = !!me?.is_admin;
  const venueA = "Эксперт";
  const venueB = "Маракана";
  const venueAliases: Record<string, string[]> = {
    [venueA]: [venueA, "зал1", "Зал 1", "зал 1"],
    [venueB]: [venueB, "зал2", "Зал 2", "зал 2"]
  };

  const loadUsers = () => {
    adminListUsers()
      .then((data) => setUsers(data?.users || []))
      .catch((err) => setError(formatApiError(err)));
  };

  const loadState = () => {
    adminGetState(1)
      .then((data) => setStatePlayers(data?.players || []))
      .catch((err) => setError(formatApiError(err)));
  };

  const loadMatches = () => {
    fetchMatches()
      .then((data) => setMatches(data?.matches || []))
      .catch((err) => setError(formatApiError(err)));
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    loadState();
    loadMatches();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedMatchId) {
      setMatchDetail(null);
      return;
    }
    getMatch(selectedMatchId)
      .then(setMatchDetail)
      .catch((err) => setError(formatApiError(err)));
  }, [selectedMatchId]);

  const displayName = (playerId: string) => {
    const tgId = Number(playerId);
    if (!Number.isNaN(tgId)) {
      const user = users.find((u) => u.tg_id === tgId);
      if (user) {
        return user.custom_name || user.tg_name || String(user.tg_id);
      }
    }
    return playerId;
  };
  const roleLabel = (roleKey: string) => {
    if (roleKey === "attack") return "Атака";
    if (roleKey === "defense") return "Защита";
    return "-";
  };
  const venueLabel = (venue: string) => {
    if (venue === "__global__") return "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f";
    for (const [label, keys] of Object.entries(venueAliases)) {
      if (keys.includes(venue)) return label;
    }
    return venue;
  };
  const sourceLabel = (source: string) => {
    if (source === "feedback") return "\u0437\u0430 \u0444\u0438\u0434\u0431\u0435\u043a";
    return "\u0437\u0430 \u043c\u0430\u0442\u0447";
  };
  const getVenueRating = (player: StatePlayer, venue: string) => {
    const keys = venueAliases[venue] || [venue];
    for (const key of keys) {
      if (player.venue_ratings[key] !== undefined) {
        return player.venue_ratings[key];
      }
    }
    return null;
  };
  const loadMatrix = async (kind: "synergy" | "domination", venue: string) => {
    setMatrixLoading(true);
    try {
      const result = await adminGetInteractions({ kind, venue });
      setMatrixPlayers(result.players);
      setMatrixValues(result.values);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setMatrixLoading(false);
    }
  };
  const loadInteractionLogs = async (kind: "synergy" | "domination", venue: string, player?: string) => {
    try {
      const result = await adminGetInteractionLogs({
        kind,
        venue: venue === "all" || venue === "__global__" ? undefined : venue,
        player: player || undefined
      });
      setInteractionLogs(result.logs || []);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleAddMember = async () => {
    if (!selectedMatchId) return;
    if (!memberUserId) return;
    try {
      await adminAddMatchMembers(selectedMatchId, [
        {
          tg_id: Number(memberUserId),
          role: memberRole,
          can_edit: memberCanEdit
        }
      ]);
      setMemberUserId("");
      setMemberRole("player");
      setMemberCanEdit(false);
      setMatchDetail(await getMatch(selectedMatchId));
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleRemoveMember = async (tgId: number) => {
    if (!selectedMatchId) return;
    try {
      await adminRemoveMatchMember(selectedMatchId, tgId);
      setMatchDetail(await getMatch(selectedMatchId));
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handlePatchSegment = async (segmentId: number, scoreA: number, scoreB: number) => {
    if (!selectedMatchId) return;
    try {
      await adminPatchSegment(selectedMatchId, segmentId, { score_a: scoreA, score_b: scoreB });
      setMatchDetail(await getMatch(selectedMatchId));
      loadMatches();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) || null,
    [matches, selectedMatchId]
  );
  const sortedPlayers = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const getVenue = (player: StatePlayer, venue: string) => getVenueRating(player, venue) ?? 0;
    return [...statePlayers].sort((a, b) => {
      if (sortKey === "name") {
        return displayName(a.player_id).localeCompare(displayName(b.player_id)) * dir;
      }
      if (sortKey === "global") {
        return (a.global_rating - b.global_rating) * dir;
      }
      if (sortKey === "venueA") {
        return (getVenue(a, venueA) - getVenue(b, venueA)) * dir;
      }
      return (getVenue(a, venueB) - getVenue(b, venueB)) * dir;
    });
  }, [statePlayers, sortKey, sortDir, venueA, venueB, users]);

  if (!isAdmin) {
    return <StatusCard title="Недоступно" message="Требуются права администратора." />;
  }

  return (
    <div className="space-y-6">
      {error ? <StatusCard title="Ошибка" message={error} /> : null}

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Рейтинги игроков</div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={loadState}
                aria-label="Обновить"
                className="h-10 w-10"
              >
                <RefreshCw className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Синергия"
                className="h-10 w-10"
                onClick={() => {
                  setMatrixKind("synergy");
                  setMatrixVenue("__global__");
                  setMatrixOpen(true);
                  loadMatrix("synergy", "__global__");
                  loadInteractionLogs("synergy", "__global__");
                }}
              >
                <GitMerge className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Доминация"
                className="h-10 w-10"
                onClick={() => {
                  setMatrixKind("domination");
                  setMatrixVenue("__global__");
                  setMatrixOpen(true);
                  loadMatrix("domination", "__global__");
                  loadInteractionLogs("domination", "__global__");
                }}
              >
                <Swords className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                aria-label="Роли"
                className="h-10 w-10"
                onClick={() => {
                  loadState();
                  setRolesOpen(true);
                }}
              >
                <Shield className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setLogsOpen(true)}
                aria-label="Логи"
                className="h-10 w-10"
              >
                <Activity className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("name");
                        setSortDir((prev) => (sortKey === "name" && prev === "asc" ? "desc" : "asc"));
                      }}
                    >
                      Игрок
                    </button>
                  </th>
                  <th className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("venueA");
                        setSortDir((prev) => (sortKey === "venueA" && prev === "asc" ? "desc" : "asc"));
                      }}
                    >
                      {venueA}
                    </button>
                  </th>
                  <th className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("venueB");
                        setSortDir((prev) => (sortKey === "venueB" && prev === "asc" ? "desc" : "asc"));
                      }}
                    >
                      {venueB}
                    </button>
                  </th>
                  <th className="py-2 pr-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey("global");
                        setSortDir((prev) => (sortKey === "global" && prev === "asc" ? "desc" : "asc"));
                      }}
                    >
                      Глобальный
                    </button>
                  </th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player) => (
                  <tr key={player.player_id} className="border-t border-border/60">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{displayName(player.player_id)}</div>
                      <div className="text-xs text-muted-foreground">ID: {player.player_id}</div>
                    </td>
                    <td className="py-2 pr-3">
                      {getVenueRating(player, venueA) !== null
                        ? Math.round(getVenueRating(player, venueA) as number)
                        : "-"}
                    </td>
                    <td className="py-2 pr-3">
                      {getVenueRating(player, venueB) !== null
                        ? Math.round(getVenueRating(player, venueB) as number)
                        : "-"}
                    </td>
                    <td className="py-2 pr-3">{player.global_rating.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditPlayer(player);
                          setEditValues({
                            global: String(player.global_rating ?? ""),
                            venueA: String(getVenueRating(player, venueA) ?? ""),
                            venueB: String(getVenueRating(player, venueB) ?? ""),
                            bindTg: ""
                          });
                          setBindSearch("");
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">Матчи</div>
          <div className="grid gap-2">
            {matches.map((match) => (
              <button
                key={match.id}
                type="button"
                onClick={() => setSelectedMatchId(match.id)}
                className={`rounded-xl border px-3 py-2 text-left text-sm ${
                  selectedMatchId === match.id ? "border-primary bg-primary/10" : "border-border/60"
                }`}
              >
                Матч #{match.id} • {match.venue}
              </button>
            ))}
          </div>

          {selectedMatch && matchDetail ? (
            <div className="space-y-4 pt-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Матч #{selectedMatch.id}
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Состав</div>
                <div className="grid gap-2">
                  {matchDetail.members.map((member) => (
                    <div
                      key={member.tg_id}
                      className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
                    >
                      <span>
                        {member.name} • {member.role}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRemoveMember(member.tg_id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2">
                  <Input
                    value={memberUserId}
                    onChange={(e) => setMemberUserId(e.target.value)}
                    placeholder="TG ID"
                  />
                  <Input
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    placeholder="Роль (player/organizer/spectator)"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={memberCanEdit}
                      onChange={(e) => setMemberCanEdit(e.target.checked)}
                    />
                    Может редактировать
                  </label>
                  <Button onClick={handleAddMember}>Добавить</Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-semibold">Сегменты</div>
                <div className="grid gap-2">
                  {matchDetail.segments.map((segment) => (
                    <div
                      key={segment.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/60 px-3 py-2"
                    >
                      <div className="text-sm">Сегмент {segment.seg_no}</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-16 rounded-lg border border-input bg-card/70 px-2 py-1 text-sm"
                          defaultValue={segment.score_a}
                          onBlur={(e) =>
                            handlePatchSegment(segment.id, Number(e.target.value), segment.score_b)
                          }
                        />
                        <span>:</span>
                        <input
                          type="number"
                          className="w-16 rounded-lg border border-input bg-card/70 px-2 py-1 text-sm"
                          defaultValue={segment.score_b}
                          onBlur={(e) =>
                            handlePatchSegment(segment.id, segment.score_a, Number(e.target.value))
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={!!editPlayer}
        onOpenChange={(open) => {
          if (!open) {
            setEditPlayer(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать рейтинг</DialogTitle>
          </DialogHeader>
          {editPlayer ? (
            <div className="space-y-3">
              <div className="text-sm font-semibold">{displayName(editPlayer.player_id)}</div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Input
                  value={editValues.venueA}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, venueA: e.target.value }))}
                  placeholder={venueA}
                />
                <Input
                  value={editValues.venueB}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, venueB: e.target.value }))}
                  placeholder={venueB}
                />
                <Input
                  value={editValues.global}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, global: e.target.value }))}
                  placeholder="Глобальный"
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Привязать Telegram
                </div>
                <Input
                  value={bindSearch}
                  onChange={(e) => setBindSearch(e.target.value)}
                  placeholder="Поиск по имени"
                />
                <div className="max-h-40 space-y-2 overflow-auto rounded-xl border border-border/60 p-2">
                  {users
                    .filter((user) =>
                      (user.custom_name || user.tg_name || "")
                        .toLowerCase()
                        .includes(bindSearch.toLowerCase())
                    )
                    .map((user) => (
                      <button
                        key={user.tg_id}
                        type="button"
                        onClick={() =>
                          setEditValues((prev) => ({ ...prev, bindTg: String(user.tg_id) }))
                        }
                        className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm ${
                          editValues.bindTg === String(user.tg_id)
                            ? "bg-primary/15 text-primary"
                            : "hover:bg-muted"
                        }`}
                      >
                        <span>{user.custom_name || user.tg_name}</span>
                        <span className="text-xs text-muted-foreground">{user.tg_id}</span>
                      </button>
                    ))}
                </div>
                <Input
                  value={editValues.bindTg}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, bindTg: e.target.value }))}
                  placeholder="TG ID вручную"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    if (!editPlayer) return;
                    try {
                      const nextVenueRatings: Record<string, number> = {};
                      if (editValues.venueA !== "") {
                        nextVenueRatings[venueA] = Number(editValues.venueA);
                      }
                      if (editValues.venueB !== "") {
                        nextVenueRatings[venueB] = Number(editValues.venueB);
                      }
                      await adminPatchStatePlayer({
                        player_id: editPlayer.player_id,
                        global_rating: editValues.global === "" ? undefined : Number(editValues.global),
                        venue_ratings: Object.keys(nextVenueRatings).length ? nextVenueRatings : undefined
                      });
                      if (editValues.bindTg && editValues.bindTg !== editPlayer.player_id) {
                        await adminBindStatePlayer({
                          player_id: editPlayer.player_id,
                          tg_id: Number(editValues.bindTg)
                        });
                      }
                      setEditPlayer(null);
                      loadState();
                    } catch (err) {
                      setError(formatApiError(err));
                    }
                  }}
                >
                  Сохранить
                </Button>
                <Button variant="secondary" onClick={() => setEditPlayer(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Логи рейтингов</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                value={logMatchId}
                onChange={(e) => setLogMatchId(e.target.value)}
                placeholder="Матч ID"
              />
              <Input
                value={logPlayerId}
                onChange={(e) => setLogPlayerId(e.target.value)}
                placeholder="Игрок ID"
              />
            </div>
            <div className="max-h-32 space-y-2 overflow-auto rounded-xl border border-border/60 p-2">
              {users.map((user) => (
                <button
                  key={user.tg_id}
                  type="button"
                  onClick={() => setLogPlayerId(String(user.tg_id))}
                  className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm ${
                    logPlayerId === String(user.tg_id)
                      ? "bg-primary/15 text-primary"
                      : "hover:bg-muted"
                  }`}
                >
                  <span>{user.custom_name || user.tg_name}</span>
                  <span className="text-xs text-muted-foreground">{user.tg_id}</span>
                </button>
              ))}
            </div>
            <Button
              onClick={async () => {
                setLogsLoading(true);
                try {
                  const result = await adminGetRatingLogs({
                    player_id: logPlayerId ? logPlayerId : undefined,
                    match_id: logMatchId ? Number(logMatchId) : undefined
                  });
                  setLogItems(result.logs || []);
                } catch (err) {
                  setError(formatApiError(err));
                } finally {
                  setLogsLoading(false);
                }
              }}
            >
              {logsLoading ? "Загружаю..." : "Показать"}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setRebuildLoading(true);
                try {
                  await adminRebuildRatingLogs(1);
                  const result = await adminGetRatingLogs({
                    player_id: logPlayerId ? logPlayerId : undefined,
                    match_id: logMatchId ? Number(logMatchId) : undefined
                  });
                  setLogItems(result.logs || []);
                } catch (err) {
                  setError(formatApiError(err));
                } finally {
                  setRebuildLoading(false);
                }
              }}
            >
              {rebuildLoading ? "\u041f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u044b\u0432\u0430\u044e..." : "\u041f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044c \u043b\u043e\u0433\u0438"}
            </Button>
            <div className="max-h-64 space-y-2 overflow-auto">
              {logItems.length === 0 ? (
                <div className="text-xs text-muted-foreground">Логов нет</div>
              ) : (
                logItems.map((log) => (
                  <Card key={log.id}>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span>Матч #{log.match_id}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {displayName(log.player_id)} | {venueLabel(log.venue)}
                      </div>
                      <div>
                        Δ {log.delta.toFixed(2)} | {log.pre_global.toFixed(2)} → {log.post_global.toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Голы: {log.goals}, Ассисты: {log.assists}
                      </div>
                      {log.details ? (
                        <div className="text-xs text-muted-foreground">
                          Победа/поражение: {log.details.result_delta?.toFixed(2) ?? "0.00"} | Гол:{" "}
                          {log.details.goal_delta?.toFixed(2) ?? "0.00"} | Ассист:{" "}
                          {log.details.assist_delta?.toFixed(2) ?? "0.00"} | Фидбек:{" "}
                          {log.details.quick_delta?.toFixed(2) ?? "0.00"} (MVP{" "}
                          {log.details.mvp_delta?.toFixed(2) ?? "0.00"}, сравнения{" "}
                          {log.details.pairwise_delta?.toFixed(2) ?? "0.00"}, fan{" "}
                          {log.details.fan_delta?.toFixed(2) ?? "0.00"})
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={matrixOpen}
        onOpenChange={(open) => {
          if (!open) {
            setMatrixOpen(false);
            setCellEdit(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {matrixKind === "synergy" ? "Матрица синергии" : "Матрица доминации"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "__global__", label: "\u0413\u043b\u043e\u0431\u0430\u043b\u044c\u043d\u0430\u044f" },
                { key: venueA, label: venueA },
                { key: venueB, label: venueB }
              ].map((item) => (
                <Button
                  key={item.key}
                  size="sm"
                  variant={matrixVenue === item.key ? "default" : "outline"}
                  onClick={() => {
                    setMatrixVenue(item.key);
                    loadMatrix(matrixKind, item.key);
                    loadInteractionLogs(matrixKind, item.key, interactionLogPlayer);
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-xl border border-border/60">
              {matrixLoading ? (
                <div className="p-3 text-sm text-muted-foreground">Загрузка...</div>
              ) : matrixPlayers.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Нет данных</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-card/90 px-2 py-2 text-left">Игрок</th>
                      {matrixPlayers.map((player) => (
                        <th key={player} className="px-2 py-2 text-left">
                          {displayName(player)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrixPlayers.map((rowPlayer, rowIndex) => (
                      <tr key={rowPlayer} className="border-t border-border/60">
                        <td className="sticky left-0 bg-card/90 px-2 py-2 font-medium">
                          {displayName(rowPlayer)}
                        </td>
                        {matrixPlayers.map((colPlayer, colIndex) => {
                          const value = matrixValues[rowIndex]?.[colIndex] ?? 0;
                          const isDiagonal = rowPlayer === colPlayer;
                          return (
                            <td key={`${rowPlayer}-${colPlayer}`} className="px-2 py-1">
                              <button
                                type="button"
                                disabled={isDiagonal || matrixVenue === "all"}
                                onClick={() =>
                                  setCellEdit({
                                    a: rowPlayer,
                                    b: colPlayer,
                                    value: value.toFixed(2)
                                  })
                                }
                                className={`w-full rounded-md px-2 py-1 text-left ${
                                  isDiagonal ? "text-muted-foreground" : "hover:bg-muted"
                                }`}
                              >
                                {value.toFixed(2)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {cellEdit ? (
              <div className="space-y-2 rounded-xl border border-border/60 p-3">
                <div className="text-sm font-semibold">
                  {displayName(cellEdit.a)} → {displayName(cellEdit.b)}
                </div>
                <Input
                  value={cellEdit.value}
                  onChange={(e) =>
                    setCellEdit((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                  }
                />
                <div className="flex gap-2">
                  <Button
                    onClick={async () => {
                      if (!cellEdit) return;
                      try {
                        await adminPatchInteraction({
                          kind: matrixKind,
                          venue: matrixVenue,
                          player_a: cellEdit.a,
                          player_b: cellEdit.b,
                          value: Number(cellEdit.value)
                        });
                        setCellEdit(null);
                        loadMatrix(matrixKind, matrixVenue);
                        loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer);
                      } catch (err) {
                        setError(formatApiError(err));
                      }
                    }}
                    disabled={matrixVenue === "all"}
                  >
                    Сохранить
                  </Button>
                  <Button variant="secondary" onClick={() => setCellEdit(null)}>
                    Отмена
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Логи изменений
              </div>
              <div className="flex gap-2">
                <Input
                  value={interactionLogPlayer}
                  onChange={(e) => setInteractionLogPlayer(e.target.value)}
                  placeholder="Игрок ID"
                />
                <Button
                  onClick={async () => {
                    await loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer);
                  }}
                >
                  Показать
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await adminRebuildInteractionLogs(1);
                      await loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer);
                    } catch (err) {
                      setError(formatApiError(err));
                    }
                  }}
                >
                  {"\u041f\u0435\u0440\u0435\u0441\u0447\u0438\u0442\u0430\u0442\u044c"}
                </Button>
              </div>
              <div className="max-h-40 space-y-2 overflow-auto">
                {interactionLogs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Логов нет</div>
                ) : (
                  interactionLogs.map((log) => (
                    <Card key={log.id}>
                      <CardContent className="space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span>
                            {displayName(log.player_a)} → {displayName(log.player_b)}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("ru-RU")}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          {venueLabel(log.venue)} | {log.kind} | {sourceLabel(log.source)}
                        </div>
                        {log.match_id ? (
                          <div className="text-muted-foreground">Матч #{log.match_id}</div>
                        ) : null}
                        <div>
                          {log.value_before.toFixed(2)} → {log.value_after.toFixed(2)}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent className="w-[92vw] max-w-[680px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Роли игроков</DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead>
                <tr className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="py-2 pr-3">Игрок</th>
                  <th className="py-2 pr-3">Атака</th>
                  <th className="py-2 pr-3">Защита</th>
                  <th className="py-2 pr-3">Ближе к</th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((player) => {
                  const roles = player.role_tendencies || {};
                  const attack =
                    (roles.attacker ?? 0) +
                    (roles.offball ?? 0) +
                    (roles.ball_retention ?? 0) +
                    (roles.decision ?? 0) +
                    (roles.attack ?? 0);
                  const defense =
                    (roles.defender ?? 0) +
                    (roles.discipline ?? 0) +
                    (roles.defense ?? 0);
                  const best =
                    attack === 0 && defense === 0
                      ? { key: "", value: 0 }
                      : attack >= defense
                        ? { key: "attack", value: attack }
                        : { key: "defense", value: defense };
                  return (
                    <tr key={player.player_id} className="border-t border-border/60">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{displayName(player.player_id)}</div>
                        <div className="text-[10px] text-muted-foreground">ID: {player.player_id}</div>
                      </td>
                      <td className="py-2 pr-3">{attack.toFixed(2)}</td>
                      <td className="py-2 pr-3">{defense.toFixed(2)}</td>
                      <td className="py-2 pr-3">{roleLabel(best.key)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

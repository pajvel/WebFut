import { useEffect, useMemo, useState } from "react";

import {
  Activity,
  GitMerge,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Shield,
  Swords,
  Trash,
  UserPlus,
  Users
} from "lucide-react";

import {
  adminAddMatchMembers,
  adminBindStatePlayer,
  adminCreateUser,
  adminDeleteMatch,
  customTeams,
  deleteEvent,
  deleteSegment,
  goal,
  adminGetInteractionLogs,
  adminGetInteractions,
  adminGetPositionLogs,
  adminRebuildInteractionLogs,
  adminRebuildState,
  adminRebuildRatingLogs,
  adminGetRatingLogs,
  adminGetFeedbackVotes,
  adminPatchInteraction,
  adminPatchUser,
  adminGetState,
  adminListUsers,
  adminPatchSegment,
  adminPatchStatePlayer,
  adminRemoveMatchMember,
  apiFetch,
  fetchMatches,
  getMatch,
  newSegment,
  ownGoal,
  patchEvent
} from "../lib/api";
import type { AdminUser, MatchDetail, MatchEvent, MatchMember, MatchSummary } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { StatusCard } from "../components/StatusCard";
import { formatApiError } from "../lib/errors";
import { TgUser, ManualUser, TgUsersResponse } from "../lib/types";
import { resolveMediaUrl } from "../lib/media";

type StatePlayer = {
  player_id: string;
  global_rating: number;
  base_rating?: number | null;
  venue_ratings: Record<string, number>;
  role_tendencies?: Record<string, number>;
  is_guest: boolean;
  guest_matches: number;
  tier_bonus: number;
};

const roleOptions = [
  { value: "player", label: "Игрок" },
  { value: "organizer", label: "Организатор" },
  { value: "spectator", label: "Зритель" }
];

const getRoleLabel = (role: string) => {
  const option = roleOptions.find(r => r.value === role);
  return option?.label || role;
};

type AdminTab =
  | "USERS"
  | "MATCHES"
  | "TG_LINK"
  | "RATING_LOGS"
  | "POSITION_LOGS"
  | "INTERACTIONS"
  | "FEEDBACK";

export function Admin() {
  const { me } = useAppContext();
  const [activeTab, setActiveTab] = useState<AdminTab>("USERS");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [statePlayers, setStatePlayers] = useState<StatePlayer[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [matchFilter, setMatchFilter] = useState<"all" | "created" | "live" | "finished" | "generating">("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [editingEvent, setEditingEvent] = useState<{ segmentId: number; event?: MatchEvent } | null>(null);
  const [eventForm, setEventForm] = useState({
    type: "goal" as "goal" | "own_goal",
    team: "A" as "A" | "B",
    scorer: "",
    assist: ""
  });
  const [error, setError] = useState<string | null>(null);
  const [memberRole, setMemberRole] = useState("player");
  const [memberCanEdit, setMemberCanEdit] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [memberRating, setMemberRating] = useState("");
  const [memberInvitedBy, setMemberInvitedBy] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerTgId, setNewPlayerTgId] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Новые состояния для TG профилей
  const [showTgProfiles, setShowTgProfiles] = useState(false);
  const [tgUsers, setTgUsers] = useState<TgUser[]>([]);
  const [manualUsers, setManualUsers] = useState<ManualUser[]>([]);
  const [selectedTgUser, setSelectedTgUser] = useState<TgUser | null>(null);
  const [selectedManualUser, setSelectedManualUser] = useState<ManualUser | null>(null);
  const [sortKey, setSortKey] = useState<"name" | "global" | "venueA" | "venueB">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editPlayer, setEditPlayer] = useState<StatePlayer | null>(null);
  const [editValues, setEditValues] = useState({
    name: "",
    base: "",
    bindTg: ""
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createValues, setCreateValues] = useState({
    name: "",
    tgId: "",
    base: ""
  });
  const [createSaving, setCreateSaving] = useState(false);
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
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [ratingSearchPlayer, setRatingSearchPlayer] = useState("");
  const [ratingSearchMatch, setRatingSearchMatch] = useState("");
  const [positionSearch, setPositionSearch] = useState("");
  const [positionLogItems, setPositionLogItems] = useState<
    Array<{
      id: number;
      match_id: number;
      player_id: string;
      source: string;
      old_attacker: number;
      new_attacker: number;
      delta_attacker: number;
      old_defender: number;
      new_defender: number;
      delta_defender: number;
      created_at: string;
    }>
  >([]);
  const [positionLogsLoading, setPositionLogsLoading] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackVotesOpen, setFeedbackVotesOpen] = useState(false);
  const [feedbackVotesLoading, setFeedbackVotesLoading] = useState(false);
  const [feedbackMatchId, setFeedbackMatchId] = useState("");
  const [feedbackVotesItems, setFeedbackVotesItems] = useState<
    Array<{
      match_id: number;
      tg_id: number;
      mvp_vote_tg_id: number | null;
      answers_json: Record<string, unknown> | null;
    }>
  >([]);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixKind, setMatrixKind] = useState<"synergy" | "domination">("synergy");
  const [matrixVenue, setMatrixVenue] = useState("__global__");
  const [matrixPlayers, setMatrixPlayers] = useState<string[]>([]);
  const [matrixValues, setMatrixValues] = useState<number[][]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [matrixSort, setMatrixSort] = useState<{
    playerId: string | null;
    axis: "row" | "col" | "none";
    dir: "asc" | "desc" | "none";
  }>({ playerId: null, axis: "none", dir: "none" });
  const [cellEdit, setCellEdit] = useState<{ a: string; b: string; value: string } | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<
    | { kind: "deleteMatch" }
    | { kind: "deleteSegment"; segmentId: number }
    | { kind: "removeMember"; tgId: number; name: string }
    | { kind: "deleteEvent"; eventId: number; label: string }
    | null
  >(null);
  const [addRole, setAddRole] = useState<"player" | "organizer" | "spectator">("player");
  const [teamNameA, setTeamNameA] = useState("");
  const [teamNameB, setTeamNameB] = useState("");
  const [teamNamesSaving, setTeamNamesSaving] = useState(false);
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
  const safeTgUsers = tgUsers ?? [];
  const safeManualUsers = manualUsers ?? [];

  // Функции для TG профилей
  const loadTgProfiles = async () => {
    try {
      setError(null);
      const response = await apiFetch<TgUsersResponse>("/admin/tg-users");
      if (response) {
        setTgUsers(response.tg_users || []);
        setManualUsers(response.manual_users || []);
      }
    } catch (err) {
      setTgUsers([]);
      setManualUsers([]);
      setError(formatApiError(err));
    }
  };

  const linkProfiles = async () => {
    if (!selectedTgUser || !selectedManualUser) return;
    
    try {
      setError(null);
      await apiFetch("/admin/link-profiles", {
        method: "POST",
        body: JSON.stringify({
          tg_id: selectedTgUser.tg_id,
          manual_id: selectedManualUser.id
        })
      });
      
      // Обновляем списки
      await loadTgProfiles();
      setSelectedTgUser(null);
      setSelectedManualUser(null);
    } catch (err) {
      setError(formatApiError(err));
    }
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

  const refreshMatchDetail = async () => {
    if (!selectedMatchId) return;
    const fresh = await getMatch(selectedMatchId);
    setMatchDetail(fresh);
  };

  const applyNewSegmentLocally = (segmentId: number, segNo: number) => {
    if (!matchDetail) return;
    const nowIso = new Date().toISOString();
    const endedFixed = matchDetail.segments.map((seg) =>
      seg.ended_at ? seg : { ...seg, ended_at: nowIso }
    );
    const exists = endedFixed.some((seg) => seg.id === segmentId);
    const nextSegments = exists
      ? endedFixed
      : [...endedFixed, { id: segmentId, seg_no: segNo, ended_at: null, score_a: 0, score_b: 0, is_butt_game: false }];
    nextSegments.sort((a, b) => a.seg_no - b.seg_no);
    setMatchDetail({ ...matchDetail, segments: nextSegments });
  };

  const maybeRebuildFinishedMatch = async () => {
    if (matchMeta?.status !== "finished") return;
    try {
      setRecalcLoading(true);
      await adminRebuildRatingLogs(1);
      await adminRebuildState(1);
      await adminRebuildInteractionLogs(1);
      loadState();
      if (activeTab === "INTERACTIONS") {
        await loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer);
      }
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setRecalcLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
    loadState();
    loadMatches();
  }, [isAdmin]);

  useEffect(() => {
    const handleOpenMenu = () => setIsMenuOpen(true);
    window.addEventListener("admin-open-menu", handleOpenMenu);
    return () => window.removeEventListener("admin-open-menu", handleOpenMenu);
  }, []);

  useEffect(() => {
    if (activeTab === "TG_LINK") {
      loadTgProfiles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedMatchId) {
      setMatchDetail(null);
      return;
    }
    getMatch(selectedMatchId)
      .then(setMatchDetail)
      .catch((err) => setError(formatApiError(err)));
  }, [selectedMatchId]);

  useEffect(() => {
    if (activeTab === "RATING_LOGS" && logItems.length === 0 && !logsLoading) {
      setLogsLoading(true);
      adminGetRatingLogs({})
        .then((result) => setLogItems(result.logs || []))
        .catch((err) => setError(formatApiError(err)))
        .finally(() => setLogsLoading(false));
    }
    if (activeTab === "FEEDBACK" && feedbackVotesItems.length === 0 && !feedbackVotesLoading) {
      setFeedbackVotesLoading(true);
      adminGetFeedbackVotes({})
        .then((result) => setFeedbackVotesItems(result.items || []))
        .catch((err) => setError(formatApiError(err)))
        .finally(() => setFeedbackVotesLoading(false));
    }
    if (activeTab === "INTERACTIONS" && matrixPlayers.length === 0 && !matrixLoading) {
      loadMatrix(matrixKind, matrixVenue);
      loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer);
    }
    if (activeTab === "POSITION_LOGS") {
      if (positionLogItems.length === 0 && !positionLogsLoading) {
        setPositionLogsLoading(true);
        adminGetPositionLogs({ limit: 500 })
          .then((result) => setPositionLogItems(result.logs || []))
          .catch((err) => setError(formatApiError(err)))
          .finally(() => setPositionLogsLoading(false));
      }
    }
  }, [
    activeTab,
    logItems.length,
    logsLoading,
    feedbackVotesItems.length,
    feedbackVotesLoading,
    matrixPlayers.length,
    matrixLoading,
    matrixKind,
    matrixVenue,
    interactionLogPlayer,
    positionLogItems.length,
    positionLogsLoading
  ]);

  useEffect(() => {
    const current = matchDetail?.team_current?.current_teams as ({ name_a?: string; name_b?: string } | null | undefined);
    const fallback = matchDetail?.team_variants?.[0]?.teams as ({ name_a?: string; name_b?: string } | null | undefined);
    setTeamNameA(current?.name_a || fallback?.name_a || "");
    setTeamNameB(current?.name_b || fallback?.name_b || "");
  }, [matchDetail]);

  // Загружаем TG профили при открытии модалки
  useEffect(() => {
    if (showTgProfiles) {
      loadTgProfiles();
    }
  }, [showTgProfiles]);

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
  const getGlobalRatingByTgId = (tgId: number) => {
    const player = statePlayers.find((p) => String(p.player_id) === String(tgId));
    return player?.global_rating ?? null;
  };
  const nameById = (value: unknown) => {
    if (value === null || value === undefined || value === "") return "—";
    if (typeof value === "number") return displayName(String(value));
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return displayName(String(asNumber));
    return String(value);
  };
  const formatPair = (pair: unknown) => {
    if (!Array.isArray(pair) || pair.length < 2) return null;
    return `${nameById(pair[0])} vs ${nameById(pair[1])}`;
  };
  const formatKey = (value: string) => value.replace(/_/g, " ");
  const extractFanEntries = (answers: Record<string, unknown>) => {
    const entries: Array<[string, unknown]> = [];
    for (const [key, value] of Object.entries(answers)) {
      if (/^(syn|dom|role)_\d+$/i.test(key)) {
        entries.push([key, value]);
      }
    }
    const nested = answers.fan || answers.fan_responses;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      for (const [key, value] of Object.entries(nested as Record<string, unknown>)) {
        entries.push([`fan.${key}`, value]);
      }
    }
    return entries;
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
  const matchStatusLabel = (status: MatchSummary["status"]) => {
    if (status === "live") return "ACTIVE";
    if (status === "finished") return "FINISHED";
    if (status === "generating") return "GENERATING";
    return "PENDING";
  };
  const matchStatusClass = (status: MatchSummary["status"]) => {
    if (status === "live") return "bg-[var(--bg-contrast)] text-[var(--text-contrast)]";
    if (status === "finished") return "bg-green-600 text-white";
    if (status === "generating") return "bg-yellow-500 text-black";
    return "bg-[var(--bg-surface)] text-[var(--text-main)]";
  };
  const sourceLabel = (source: string) => {
    if (source.startsWith("feedback")) return "\u0437\u0430 \u0444\u0438\u0434\u0431\u0435\u043a";
    return "\u0437\u0430 \u043c\u0430\u0442\u0447";
  };
  const feedbackAuthorFromSource = (source: string) => {
    if (!source.startsWith("feedback:")) return null;
    const tgId = source.split(":")[1];
    if (!tgId) return null;
    return nameById(tgId);
  };
  const positionSourceLabel = (source: string) => {
    if (source === "match") return "MATCH";
    if (source.startsWith("feedback")) return "FEEDBACK";
    return source.toUpperCase();
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
    
    let tgId: number;
    
    if (isCreatingNew) {
      // Создаем нового пользователя в системе
      if (!newPlayerName) return;
      
      try {
        const createUserResult = await adminCreateUser({
          tg_id: newPlayerTgId ? Number(newPlayerTgId) : undefined,
          name: newPlayerName
        });
        tgId = createUserResult.tg_id;
        
        // Если указан рейтинг, устанавливаем его в state
        if (memberRating) {
          await adminPatchStatePlayer({
            player_id: String(tgId),
            base_rating: Number(memberRating)
          });
        }
      } catch (err) {
        setError(formatApiError(err));
        return;
      }
    } else {
      // Используем существующего пользователя
      tgId = Number(selectedUserId);
      if (!tgId) return;
    }
    
    try {
      await adminAddMatchMembers(selectedMatchId, [
        {
          tg_id: tgId,
          role: memberRole,
          can_edit: memberCanEdit,
          name: isCreatingNew ? (memberName || undefined) : undefined,
          rating: isCreatingNew ? (memberRating ? Number(memberRating) : undefined) : undefined,
          invited_by_tg_id: memberInvitedBy && memberInvitedBy !== "none" ? Number(memberInvitedBy) : undefined,
        }
      ]);
      
      // Сброс формы
      setSelectedUserId("");
      setMemberName("");
      setMemberRating("");
      setMemberInvitedBy("");
      setNewPlayerName("");
      setNewPlayerTgId("");
      setIsCreatingNew(false);
      setMemberRole("player");
      setMemberCanEdit(false);
      loadUsers(); // Обновляем список пользователей
      loadState(); // Обновляем state игроков
      await refreshMatchDetail();
      await maybeRebuildFinishedMatch();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleRemoveMember = async (tgId: number) => {
    if (!selectedMatchId) return;
    try {
      await adminRemoveMatchMember(selectedMatchId, tgId);
      await refreshMatchDetail();
      await maybeRebuildFinishedMatch();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handlePatchSegment = async (segmentId: number, scoreA: number, scoreB: number) => {
    if (!selectedMatchId) return;
    try {
      await adminPatchSegment(selectedMatchId, segmentId, { score_a: scoreA, score_b: scoreB });
      await refreshMatchDetail();
      await maybeRebuildFinishedMatch();
      loadMatches();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleDeleteMatch = async () => {
    if (!selectedMatchId) return;
    try {
      await adminDeleteMatch(selectedMatchId);
      setSelectedMatchId(null);
      setMatchDetail(null);
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
  const filteredRatingLogs = useMemo(() => {
    return logItems.filter((log) => {
      const playerName = displayName(log.player_id).toLowerCase();
      const matchLabel = String(log.match_id ?? "");
      const byPlayer = !ratingSearchPlayer || playerName.includes(ratingSearchPlayer.toLowerCase());
      const byMatch = !ratingSearchMatch || matchLabel.includes(ratingSearchMatch);
      return byPlayer && byMatch;
    });
  }, [logItems, ratingSearchPlayer, ratingSearchMatch, users]);
  const filteredPositionLogs = useMemo(() => {
    if (!positionSearch) return positionLogItems;
    const needle = positionSearch.toLowerCase();
    return positionLogItems.filter((item) => {
      const player = displayName(item.player_id).toLowerCase();
      const source = item.source.toLowerCase();
      const mid = String(item.match_id);
      return player.includes(needle) || source.includes(needle) || mid.includes(needle);
    });
  }, [positionLogItems, positionSearch, users]);
  const filteredFeedbackItems = useMemo(() => {
    if (!feedbackSearch) return feedbackVotesItems;
    const needle = feedbackSearch.toLowerCase();
    return feedbackVotesItems.filter((item) => {
      const voter = nameById(item.tg_id).toLowerCase();
      const matchLabel = String(item.match_id ?? "");
      return voter.includes(needle) || matchLabel.includes(needle);
    });
  }, [feedbackVotesItems, feedbackSearch, users]);
  const interactionLogsLatest = useMemo(() => {
    const map = new Map<string, (typeof interactionLogs)[number]>();
    for (const log of interactionLogs) {
      const pairKey =
        log.kind === "synergy"
          ? [log.player_a, log.player_b].sort().join("|")
          : `${log.player_a}|${log.player_b}`;
      const key = `${log.source}|${log.match_id ?? "none"}|${log.kind}|${log.venue}|${pairKey}`;
      if (!map.has(key)) {
        map.set(key, log);
      }
    }
    return Array.from(map.values());
  }, [interactionLogs]);
  const filteredMatches = useMemo(
    () => matches.filter((m) => matchFilter === "all" || m.status === matchFilter),
    [matches, matchFilter]
  );
  const matchMeta = matchDetail?.match || null;
  const isWaitingMatch = matchMeta?.status === "created";
  const teamSource = matchDetail?.team_current?.current_teams ?? matchDetail?.team_variants[0]?.teams ?? null;
  const teamAIds = teamSource?.A ?? matchMeta?.team_a_members?.map((m) => String(m.tg_id)) ?? [];
  const teamBIds = teamSource?.B ?? matchMeta?.team_b_members?.map((m) => String(m.tg_id)) ?? [];
  const memberMap = useMemo(() => {
    return new Map((matchDetail?.members || []).map((m) => [String(m.tg_id), m]));
  }, [matchDetail?.members]);
  const matchTeamsA = teamAIds.map((id) => memberMap.get(String(id))).filter(Boolean) as MatchMember[];
  const matchTeamsB = teamBIds.map((id) => memberMap.get(String(id))).filter(Boolean) as MatchMember[];
  const finalScore = useMemo(() => {
    if (!matchDetail || !matchDetail.segments.length) return { A: 0, B: 0 };
    const lastEnded = [...matchDetail.segments].reverse().find((seg) => seg.ended_at);
    const fallback = matchDetail.segments[matchDetail.segments.length - 1];
    const target = lastEnded || fallback;
    return { A: target.score_a, B: target.score_b };
  }, [matchDetail]);
  const availableUsers = useMemo(() => {
    if (!matchMeta) return [] as AdminUser[];
    const memberIds = (matchDetail?.members || []).map((m) => m.tg_id);
    const teamIds = new Set(
      (isWaitingMatch ? memberIds : [...teamAIds, ...teamBIds].map((id) => Number(id)))
    );
    const needle = playerSearch.trim().toLowerCase();
    return users.filter((u) => {
      if (teamIds.has(u.tg_id)) return false;
      const name = (u.custom_name || u.tg_name || "").toLowerCase();
      return !needle || name.includes(needle);
    });
  }, [matchMeta, playerSearch, users, teamAIds, teamBIds, matchDetail?.members, isWaitingMatch]);
  const memberNameById = (id: number | null) =>
    matchDetail?.members.find((m) => m.tg_id === id)?.name || "—";
  const openEventEditor = (segmentId: number, event?: MatchEvent) => {
    setEditingEvent({ segmentId, event });
    setEventForm({
      type: event?.event_type ?? "goal",
      team: event?.team ?? "A",
      scorer: event?.scorer_tg_id ? String(event.scorer_tg_id) : "",
      assist: event?.assist_tg_id ? String(event.assist_tg_id) : ""
    });
  };
  const saveEvent = async () => {
    if (!selectedMatchId || !editingEvent) return;
    try {
      const desiredType = eventForm.type;
      const desiredTeam = eventForm.team;
      const scorerId = eventForm.scorer ? Number(eventForm.scorer) : null;
      const assistId = eventForm.assist ? Number(eventForm.assist) : null;
      if (editingEvent.event) {
        const prev = editingEvent.event;
        const sameType = prev.event_type === desiredType;
        const sameTeam = prev.team === desiredTeam;
        if (sameType && sameTeam) {
          await patchEvent(selectedMatchId, prev.id, {
            scorer_tg_id: scorerId,
            assist_tg_id: assistId
          });
        } else {
          await deleteEvent(selectedMatchId, prev.id);
          if (desiredType === "own_goal") {
            const offender = desiredTeam === "A" ? "B" : "A";
              await ownGoal(selectedMatchId, offender, editingEvent.segmentId);
          } else {
            if (!scorerId) {
              setError("Выберите игрока для гола.");
              return;
            }
              await goal(selectedMatchId, {
                team: desiredTeam,
                scorer_tg_id: scorerId,
                assist_tg_id: assistId ?? undefined,
                segment_id: editingEvent.segmentId
              });
          }
        }
      } else {
        if (desiredType === "own_goal") {
          const offender = desiredTeam === "A" ? "B" : "A";
            await ownGoal(selectedMatchId, offender, editingEvent.segmentId);
        } else {
          if (!scorerId) {
            setError("Выберите игрока для гола.");
            return;
          }
            await goal(selectedMatchId, {
              team: desiredTeam,
              scorer_tg_id: scorerId,
              assist_tg_id: assistId ?? undefined,
              segment_id: editingEvent.segmentId
            });
        }
      }
      await refreshMatchDetail();
      await maybeRebuildFinishedMatch();
      setEditingEvent(null);
    } catch (err) {
      setError(formatApiError(err));
    }
  };
  const addToTeam = async (tgId: number, team: "A" | "B", role: "player" | "organizer" | "spectator" = "player") => {
    if (!selectedMatchId) return;
    try {
      await adminAddMatchMembers(selectedMatchId, [{ tg_id: tgId, role, can_edit: false }]);
      if (isWaitingMatch || role !== "player") {
        const refreshedWaiting = await getMatch(selectedMatchId);
        setMatchDetail(refreshedWaiting);
        return;
      }
      let refreshed = await getMatch(selectedMatchId);
      const baseVariant =
        refreshed.team_current?.base_variant_no ?? refreshed.team_variants[0]?.variant_no ?? 1;
      const teams = refreshed.team_current?.current_teams ?? refreshed.team_variants[0]?.teams ?? { A: [], B: [] };
      const nextTeams = { A: [...teams.A], B: [...teams.B] };
      const idStr = String(tgId);
      if (team === "A" && !nextTeams.A.includes(idStr)) nextTeams.A.push(idStr);
      if (team === "B" && !nextTeams.B.includes(idStr)) nextTeams.B.push(idStr);
      await customTeams(selectedMatchId, { base_variant_no: baseVariant, teams: nextTeams });
      refreshed = await getMatch(selectedMatchId);
      setMatchDetail(refreshed);
    } catch (err) {
      setError(formatApiError(err));
    }
  };
  const matrixValueByIds = useMemo(() => {
    const map = new Map<string, number>();
    matrixPlayers.forEach((rowId, rowIndex) => {
      matrixPlayers.forEach((colId, colIndex) => {
        map.set(`${rowId}_${colId}`, matrixValues[rowIndex]?.[colIndex] ?? 0);
      });
    });
    return map;
  }, [matrixPlayers, matrixValues]);
  const displayMatrixRows = useMemo(() => {
    const list = [...matrixPlayers];
    if (matrixSort.axis !== "col" || !matrixSort.playerId || matrixSort.dir === "none") return list;
    list.sort((a, b) => {
      const va = matrixValueByIds.get(`${a}_${matrixSort.playerId}`) ?? 0;
      const vb = matrixValueByIds.get(`${b}_${matrixSort.playerId}`) ?? 0;
      return matrixSort.dir === "desc" ? vb - va : va - vb;
    });
    return list;
  }, [matrixPlayers, matrixSort, matrixValueByIds]);
  const displayMatrixCols = useMemo(() => {
    const list = [...matrixPlayers];
    if (matrixSort.axis !== "row" || !matrixSort.playerId || matrixSort.dir === "none") return list;
    list.sort((a, b) => {
      const va = matrixValueByIds.get(`${matrixSort.playerId}_${a}`) ?? 0;
      const vb = matrixValueByIds.get(`${matrixSort.playerId}_${b}`) ?? 0;
      return matrixSort.dir === "desc" ? vb - va : va - vb;
    });
    return list;
  }, [matrixPlayers, matrixSort, matrixValueByIds]);
  const toggleMatrixSort = (playerId: string, axis: "row" | "col") => {
    setMatrixSort((prev) => {
      if (prev.playerId === playerId && prev.axis === axis) {
        if (prev.dir === "desc") return { playerId, axis, dir: "asc" };
        if (prev.dir === "asc") return { playerId: null, axis: "none", dir: "none" };
      }
      return { playerId, axis, dir: "desc" };
    });
  };
  const matrixSortIcon = (playerId: string, axis: "row" | "col") => {
    if (matrixSort.playerId !== playerId || matrixSort.axis !== axis || matrixSort.dir === "none") return "";
    return matrixSort.dir === "desc" ? " ↓" : " ↑";
  };
  const saveTeamNames = async () => {
    if (!selectedMatchId || !matchDetail) return;
    try {
      setTeamNamesSaving(true);
      const baseVariant =
        matchDetail.team_current?.base_variant_no ?? matchDetail.team_variants[0]?.variant_no ?? 1;
      const teams = matchDetail.team_current?.current_teams ?? matchDetail.team_variants[0]?.teams ?? { A: [], B: [] };
      await customTeams(selectedMatchId, {
        base_variant_no: baseVariant,
        teams: { A: [...teams.A], B: [...teams.B] },
        team_name_a: teamNameA.trim() || undefined,
        team_name_b: teamNameB.trim() || undefined
      });
      await refreshMatchDetail();
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setTeamNamesSaving(false);
    }
  };
  const removeFromTeams = async (tgId: number) => {
    if (!selectedMatchId) return;
    try {
      await adminRemoveMatchMember(selectedMatchId, tgId);
      if (isWaitingMatch) {
        const refreshedWaiting = await getMatch(selectedMatchId);
        setMatchDetail(refreshedWaiting);
        return;
      }
      let refreshed = await getMatch(selectedMatchId);
      const baseVariant =
        refreshed.team_current?.base_variant_no ?? refreshed.team_variants[0]?.variant_no ?? 1;
      const teams = refreshed.team_current?.current_teams ?? refreshed.team_variants[0]?.teams ?? { A: [], B: [] };
      const nextTeams = {
        A: teams.A.filter((id) => id !== String(tgId)),
        B: teams.B.filter((id) => id !== String(tgId))
      };
      await customTeams(selectedMatchId, { base_variant_no: baseVariant, teams: nextTeams });
      refreshed = await getMatch(selectedMatchId);
      setMatchDetail(refreshed);
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const navItems = [
    { id: "USERS", label: "ПОЛЬЗОВАТЕЛИ" },
    { id: "MATCHES", label: "МАТЧИ" },
    { id: "TG_LINK", label: "TG - ПРОФИЛИ" },
    { id: "RATING_LOGS", label: "RATING LOGS" },
    { id: "POSITION_LOGS", label: "POSITION LOGS" },
    { id: "INTERACTIONS", label: "INTERACTIONS" },
    { id: "FEEDBACK", label: "FEEDBACK LOGS" }
  ];
  const handleTabChange = (id: AdminTab) => {
    setActiveTab(id);
    setIsMenuOpen(false);
  };
  const openCreateUser = () => {
    setEditPlayer(null);
    setIsCreatingUser(true);
    setCreateValues({
      name: "",
      tgId: "",
      base: ""
    });
  };
  const closeUserModal = () => {
    setEditPlayer(null);
    setIsCreatingUser(false);
  };
  const modalInputClass =
    "w-full bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] px-3 py-2 text-[10px] font-black uppercase italic tracking-tight outline-none focus:outline-none focus:ring-0 focus:border-[var(--border-main)]";

  if (!isAdmin) {
    return (
      <>
        <StatusCard title="Недоступно" message="Требуются права администратора." />
        <div className="min-h-screen bg-[var(--bg-page)]" />
      </>
    );
  }

  return (
    <div className="flex h-screen bg-[var(--bg-page)] text-[var(--text-main)] font-sans overflow-hidden relative [&_button]:outline-none [&_button]:focus:outline-none [&_button]:focus:ring-0 [&_button]:focus-visible:outline-none"> {isMenuOpen ? (
        <div className="fixed inset-0 bg-black/60 z-[60] lg:hidden" onClick={() => setIsMenuOpen(false)} />
      ) : null}
      <main className="flex-1 bg-[var(--bg-page)] flex flex-col relative overflow-hidden min-w-0">
        <div className="relative z-10 flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="space-y-6"> {error ? <StatusCard title="Ошибка" message={error} onClose={() => setError(null)} /> : null}

            {activeTab === "USERS" ? (() => {
  const openEdit = (player: StatePlayer) => {
    const playerTgId = Number(player.player_id);
    const user = Number.isNaN(playerTgId) ? null : users.find((u) => u.tg_id === playerTgId) || null;
    setEditPlayer(player);
    setEditValues({
      name: user?.custom_name || user?.tg_name || "",
      base: player.base_rating != null ? String(player.base_rating) : "",
      bindTg: ""
    });
    setBindSearch("");
  };

  const SortButton = ({ field, label }: { field: typeof sortKey; label: string }) => {
    const isActive = sortKey === field;
    return (
      <button
        type="button"
        onClick={() => {
          const isSame = sortKey === field;
          setSortKey(field);
          if (isSame) {
            setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
            return;
          }
          setSortDir(field === "name" ? "asc" : "desc");
        }}
        className={`px-3 py-1.5 text-[10px] font-black uppercase italic tracking-tighter border transition-all flex items-center gap-1 ${
          isActive
            ? "bg-[var(--bg-contrast)] border-[var(--border-main)] text-[var(--text-contrast)]"
            : "border-[var(--border-main)] text-[var(--text-main)]/60 hover:text-[var(--text-main)] hover:border-[var(--border-main)]"
        }`}
      >
        {label}
        {isActive ? <span className="text-[8px] font-black">{sortDir === "desc" ? "↑" : "↓"}</span> : null}
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="mb-6 lg:mb-8 bg-[var(--bg-page)] lg:bg-transparent z-30 pt-1">
        <div className="flex flex-col gap-4 mb-6 border-b border-[var(--border-main)] pb-4">
          <div className="flex justify-between items-end">
            <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none text-[var(--text-main)]">
              ПОЛЬЗОВАТЕЛИ
            </h1>
            <button
              type="button"
              onClick={openCreateUser}
              className="bg-[var(--bg-contrast)] text-[var(--text-contrast)] px-4 lg:px-6 py-2 text-[11px] lg:text-[14px] font-black uppercase italic tracking-tighter border-2 border-transparent transition-all hover:bg-[var(--text-main)] hover:text-[var(--bg-page)] hover:border-[var(--text-main)]"
            >
              + ДОБАВИТЬ
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase text-[var(--text-main)]/60 mr-1">СОРТИРОВКА:</span>
            <SortButton field="name" label="ИМЯ" />
            <SortButton field="global" label="GLB" />
            <SortButton field="venueA" label="EXP" />
            <SortButton field="venueB" label="MAR" />
          </div>
        </div>
      </div>

      <div className="flex-1">
        <div className="hidden lg:block bg-[var(--bg-page)] border border-[var(--border-main)] overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[var(--bg-surface)] text-[var(--text-main)]/60 text-[10px] font-black uppercase z-20">
              <tr>
                <th className="p-4 border-b border-[var(--border-main)] w-16 text-center">AVA</th>
                <th className="p-4 border-b border-[var(--border-main)]">ИМЯ</th>
                <th className="p-4 border-b border-[var(--border-main)]">TG_ID</th>
                <th className="p-4 border-b border-[var(--border-main)] text-center">СПЕЦ.</th>
                <th className="p-4 border-b border-[var(--border-main)] text-center text-[var(--text-main)]/70">EXP</th>
                <th className="p-4 border-b border-[var(--border-main)] text-center text-[var(--text-main)]/70">MAR</th>
                <th className="p-4 border-b border-[var(--border-main)] text-center text-[var(--bg-contrast)]">GLB</th>
                <th className="p-4 border-b border-[var(--border-main)] text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="font-normal">
              {sortedPlayers.map((player) => {
                const playerTgId = Number(player.player_id);
                const user = Number.isNaN(playerTgId) ? null : users.find((u) => u.tg_id === playerTgId) || null;
                const avatar = user?.custom_avatar || user?.tg_avatar || null;
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
                return (
                  <tr key={player.player_id} className="hover:bg-[var(--bg-surface)]/70 transition-colors group">
                    <td className="p-4 border-b border-[var(--border-main)] flex justify-center">
                      {avatar ? (
                        <img
                          src={resolveMediaUrl(avatar)}
                          className="w-8 h-8 rounded-sm grayscale group-hover:grayscale-0 transition-all"
                          alt=""
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-sm border border-[var(--border-main)] flex items-center justify-center text-[10px] font-black text-[var(--text-main)]">
                          {displayName(player.player_id).slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] font-black uppercase italic text-lg tracking-tight text-[var(--text-main)]">
                      {displayName(player.player_id)}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] font-mono text-[var(--text-main)]/60 text-xs">
                      {user?.tg_id ?? player.player_id}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] text-center">
                      {attack === 0 && defense === 0 ? (
                        <span className="text-[var(--text-main)]/50 font-black italic tracking-tighter text-[10px]">СРЕДНИЙ</span>
                      ) : (
                        <div className="flex flex-col leading-tight">
                          {attack > 0 ? (
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-[var(--text-main)]/60 font-black text-[8px]">АТАКА</span>
                              <span className="text-[var(--text-main)] font-mono text-[11px] font-black">{attack.toFixed(2)}</span>
                            </div>
                          ) : null}
                          {defense > 0 ? (
                            <div className="flex items-center gap-1 justify-center">
                              <span className="text-[var(--text-main)]/60 font-black text-[8px]">ЗАЩИТА</span>
                              <span className="text-[var(--text-main)] font-mono text-[11px] font-black">{defense.toFixed(2)}</span>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] text-center font-mono text-xs text-[var(--text-main)]/50">
                      {getVenueRating(player, venueA) !== null ? Math.round(getVenueRating(player, venueA) as number) : "-"}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] text-center font-mono text-xs text-[var(--text-main)]/50">
                      {getVenueRating(player, venueB) !== null ? Math.round(getVenueRating(player, venueB) as number) : "-"}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] text-center text-[var(--bg-contrast)] font-black text-xl italic">
                      {player.global_rating.toFixed(2)}
                    </td>
                    <td className="p-4 border-b border-[var(--border-main)] text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(player)}
                        className="px-3 py-1 text-[10px] font-black uppercase italic tracking-tighter border-2 border-[var(--border-main)] text-[var(--text-main)] transition-all hover:bg-[var(--text-main)] hover:text-[var(--bg-page)] hover:border-[var(--text-main)]"
                      >
                        ПРАВКА
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden space-y-4 pb-32">
          {sortedPlayers.map((player) => {
            const playerTgId = Number(player.player_id);
            const user = Number.isNaN(playerTgId) ? null : users.find((u) => u.tg_id === playerTgId) || null;
            const avatar = user?.custom_avatar || user?.tg_avatar || null;
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
            return (
              <div key={player.player_id} className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-4">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    {avatar ? (
                      <img src={resolveMediaUrl(avatar)} className="w-12 h-12 rounded-sm grayscale" alt="" />
                    ) : (
                      <div className="w-12 h-12 rounded-sm border border-[var(--border-main)] flex items-center justify-center font-black text-[var(--text-main)]">
                        {displayName(player.player_id).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="font-black uppercase italic text-xl leading-none truncate text-[var(--text-main)]">
                        {displayName(player.player_id)}
                      </h3>
                      <div className="mt-2">
                        {attack === 0 && defense === 0 ? (
                          <span className="text-[var(--text-main)]/50 font-black text-[9px] uppercase italic">СПЕЦ: СРЕДНИЙ</span>
                        ) : (
                          <div className="flex gap-3">
                            {attack > 0 ? (
                              <span className="text-[var(--text-main)]/70 font-black text-[9px] uppercase italic">
                                ATK: <span className="text-[var(--text-main)]">{attack.toFixed(2)}</span>
                              </span>
                            ) : null}
                            {defense > 0 ? (
                              <span className="text-[var(--text-main)]/70 font-black text-[9px] uppercase italic">
                                DEF: <span className="text-[var(--text-main)]">{defense.toFixed(2)}</span>
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-[var(--bg-contrast)] text-3xl font-black italic leading-none">
                    {player.global_rating.toFixed(2)}
                    <div className="mt-2 space-y-1 text-[9px] font-black uppercase text-[var(--text-main)]/60 text-right">
                      <div>
                        РЕЙТИНГ ЭКСПЕРТА:{" "}
                        {getVenueRating(player, venueA) !== null
                          ? Math.round(getVenueRating(player, venueA) as number)
                          : "-"}
                      </div>
                      <div>
                        РЕЙТИНГ МАРАКАНЫ:{" "}
                        {getVenueRating(player, venueB) !== null
                          ? Math.round(getVenueRating(player, venueB) as number)
                          : "-"}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(player)}
                  className="w-full py-3 text-xs font-black bg-[var(--bg-contrast)] text-[var(--text-contrast)] uppercase"
                >
                  РЕДАКТИРОВАТЬ
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
})() : null}
{activeTab === "MATCHES" ? (
              <div className="h-full flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b-2 border-[var(--border-main)] pb-4">
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter">МАТЧИ</h1>
                  <select
                    className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-black uppercase px-2 py-2 outline-none"
                    value={matchFilter}
                    onChange={(e) => setMatchFilter(e.target.value as typeof matchFilter)}
                  >
                    <option value="all">ВСЕ</option>
                    <option value="created">PENDING</option>
                    <option value="live">ACTIVE</option>
                    <option value="finished">FINISHED</option>
                    <option value="generating">GENERATING</option>
                  </select>
                </div>{!selectedMatch ? (
                  <div className="flex-1 overflow-y-auto overflow-x-hidden">
                    <div className="hidden lg:block border-2 border-[var(--border-main)] bg-[var(--bg-surface)]">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-[var(--bg-page)] text-[var(--text-main)]/60 text-[10px] font-black uppercase z-20">
                          <tr>
                            <th className="p-3 border-b border-[var(--border-main)]">ID</th>
                            <th className="p-3 border-b border-[var(--border-main)]">ДАТА</th>
                            <th className="p-3 border-b border-[var(--border-main)] text-center">СТАТУС</th>
                            <th className="p-3 border-b border-[var(--border-main)] text-center">СЧЁТ</th>
                            <th className="p-3 border-b border-[var(--border-main)] text-right">ДЕЙСТВИЕ</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {filteredMatches.map((m) => (
                            <tr key={m.id} className="border-t border-[var(--border-main)]/30">
                              <td className="p-3 border-b border-[var(--border-main)]/30 text-[10px] opacity-60">#{m.id}</td>
                              <td className="p-3 border-b border-[var(--border-main)]/30 text-xs uppercase italic">{m.created_at ? new Date(m.created_at).toLocaleDateString("ru-RU") : "—"}
                              </td>
                              <td className="p-3 border-b border-[var(--border-main)]/30 text-center">
                                <span className={`px-2 py-1 text-[9px] font-black uppercase ${matchStatusClass(m.status)}`}>{matchStatusLabel(m.status)}
                                </span>
                              </td>
                              <td className="p-3 border-b border-[var(--border-main)]/30 text-center italic tracking-widest">
                                <span
                                  className={`font-black ${
                                    m.score_a === m.score_b || m.score_a > m.score_b
                                      ? "text-[var(--text-main)]"
                                      : "text-[var(--text-main)]/40"
                                  }`}
                                >
                                  {m.score_a}
                                </span>
                                <span className="mx-1 text-[var(--text-main)]/40">:</span>
                                <span
                                  className={`font-black ${
                                    m.score_a === m.score_b || m.score_b > m.score_a
                                      ? "text-[var(--text-main)]"
                                      : "text-[var(--text-main)]/40"
                                  }`}
                                >
                                  {m.score_b}
                                </span>
                              </td>
                              <td className="p-3 border-b border-[var(--border-main)]/30 text-right">
                                <button
                                  onClick={() => setSelectedMatchId(m.id)}
                                  className="px-3 py-1 text-[10px] font-black uppercase border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                                >
                                  УПРАВЛЕНИЕ
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="lg:hidden space-y-6 pb-10">
                      {filteredMatches.map((m) => (
                        <div
                          key={m.id}
                          className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] p-4 shadow-[4px_4px_0px_0px_var(--border-main)]"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <span className="block font-mono text-[10px] opacity-60 uppercase">#{m.id}</span>
                              <span className="block text-[11px] font-black uppercase mt-0.5 italic">
                                {m.created_at ? new Date(m.created_at).toLocaleDateString("ru-RU") : "—"}
                              </span>
                            </div>
                            <span
                              className={`px-2 py-1 text-[9px] font-black uppercase ${matchStatusClass(m.status)}`}
                            >
                              {matchStatusLabel(m.status)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center bg-[var(--bg-page)] p-4 border-2 border-[var(--border-main)] mb-4">
                            <div className="text-center flex-1">
                              <div className="text-[9px] opacity-60 font-black mb-1">TEAM A</div>
                      <div className="text-xl font-black italic">{m.team_a_members?.length ?? 0}</div>
                            </div>
                              <div className="text-3xl italic tracking-widest px-4">
                                <span
                                  className={`font-black ${
                                    m.score_a === m.score_b || m.score_a > m.score_b
                                      ? "text-[var(--text-main)]"
                                      : "text-[var(--text-main)]/40"
                                  }`}
                                >
                                  {m.score_a}
                                </span>
                                <span className="mx-1 text-[var(--text-main)]/40">:</span>
                                <span
                                  className={`font-black ${
                                    m.score_a === m.score_b || m.score_b > m.score_a
                                      ? "text-[var(--text-main)]"
                                      : "text-[var(--text-main)]/40"
                                  }`}
                                >
                                  {m.score_b}
                                </span>
                              </div>
                            <div className="text-center flex-1">
                              <div className="text-[9px] opacity-60 font-black mb-1">TEAM B</div>
                      <div className="text-xl font-black italic">{m.team_b_members?.length ?? 0}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedMatchId(m.id)}
                            className="w-full py-4 font-black uppercase border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                          >
                            РЕЖИМ КОНТРОЛЯ
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {selectedMatch && matchDetail && matchMeta ? (
                  <div className="h-full flex flex-col pb-10 overflow-y-auto overflow-x-hidden">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-4 border-[var(--border-main)] pb-4 sticky top-0 bg-[var(--bg-page)] z-20">
                      <h1 className="text-2xl lg:text-4xl font-black uppercase tracking-tighter italic leading-none">
                        КОНТРОЛЬ: <span className="text-[var(--bg-contrast)]">#{matchMeta.id}</span>
                      </h1>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setSelectedMatchId(null)}
                          className="flex-1 sm:flex-none border-2 border-[var(--border-main)] px-4 py-2 text-[10px] font-black uppercase bg-[var(--bg-page)]"
                        >
                          ЗАКРЫТЬ
                        </button>
                        <button
                          onClick={() => setConfirmState({ kind: "deleteMatch" })}
                          className="flex-1 sm:flex-none border-2 border-[var(--border-main)] px-4 py-2 text-[10px] font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                        >
                          УДАЛИТЬ
                        </button>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-[var(--bg-surface)] p-6 border-2 border-[var(--border-main)] flex flex-col lg:flex-row items-center gap-8 shadow-[4px_4px_0px_0px_var(--border-main)] relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-[var(--bg-contrast)]"></div>
                        <div className="flex-1 w-full text-center lg:text-left">
                          <label className="block text-[10px] opacity-60 font-black uppercase mb-1">VENUE & TIME</label>
                          <div className="text-2xl font-black italic uppercase leading-none">{matchMeta.venue || "—"}</div>
                          <div className="text-xs font-mono opacity-60 mt-2">
                            {matchMeta.scheduled_at
                              ? new Date(matchMeta.scheduled_at).toLocaleString("ru-RU")
                              : new Date(matchMeta.created_at).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <span className="block text-[8px] opacity-60 font-black mb-1 uppercase">FINAL SCORE A</span>
                            <div className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] text-4xl lg:text-5xl font-black italic text-center w-20 lg:w-24 py-2">
                              {finalScore.A}
                            </div>
                          </div>
                          <div className="text-4xl font-black italic mt-4 text-[var(--bg-contrast)]">:</div>
                          <div className="text-center">
                            <span className="block text-[8px] opacity-60 font-black mb-1 uppercase">FINAL SCORE B</span>
                            <div className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] text-4xl lg:text-5xl font-black italic text-center w-20 lg:w-24 py-2">
                              {finalScore.B}
                            </div>
                          </div>
                        </div>
                      </div>

                      {isWaitingMatch ? (
                        <div className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] p-4">
                          <div className="flex justify-between items-center mb-4 border-b border-[var(--border-main)] pb-2">
                            <h3 className="font-black uppercase italic text-lg">УЧАСТНИКИ МАТЧА</h3>
                            <div className="text-[10px] font-black uppercase border-2 border-[var(--border-main)] px-2 py-0.5">
                              {(matchDetail?.members || []).length}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {(matchDetail?.members || []).map((member) => (
                              <div
                                key={member.tg_id}
                                className="flex justify-between items-center bg-[var(--bg-surface)] p-2 border border-transparent hover:border-[var(--border-main)] transition-colors group"
                              >
                                <span className="text-[10px] font-black uppercase italic truncate max-w-[140px]">
                                  {member.name}
                                </span>
                                <button
                                  onClick={() => setConfirmState({ kind: "removeMember", tgId: member.tg_id, name: member.name })}
                                  className="text-red-500 text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  УДАЛИТЬ
                                </button>
                              </div>
                            ))}
                            {(matchDetail?.members || []).length === 0 ? (
                              <div className="text-[10px] opacity-60 uppercase">НЕТ УЧАСТНИКОВ</div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <h3 className="font-black uppercase italic text-lg">ИМЕНА КОМАНД</h3>
                              <button
                                onClick={saveTeamNames}
                                disabled={teamNamesSaving}
                                className="text-[10px] font-black uppercase border border-[var(--border-main)] px-3 py-1 bg-[var(--bg-contrast)] text-[var(--text-contrast)] disabled:opacity-50"
                              >
                                {teamNamesSaving ? "СОХРАНЕНИЕ..." : "СОХРАНИТЬ"}
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <Input
                                value={teamNameA}
                                onChange={(e) => setTeamNameA(e.target.value)}
                                placeholder="Название TEAM A"
                                className="!mb-0 !py-1.5 !text-xs bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-black uppercase italic"
                              />
                              <Input
                                value={teamNameB}
                                onChange={(e) => setTeamNameB(e.target.value)}
                                placeholder="Название TEAM B"
                                className="!mb-0 !py-1.5 !text-xs bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-black uppercase italic"
                              />
                            </div>
                          </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-[var(--border-main)] pb-2">
                              <h3 className="font-black uppercase italic text-lg">TEAM A</h3>
                              <div className="text-[10px] font-black uppercase border-2 border-[var(--border-main)] px-2 py-0.5">
                                {matchTeamsA.length}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {matchTeamsA.map((member) => (
                                <div
                                  key={member.tg_id}
                                  className="flex justify-between items-center bg-[var(--bg-surface)] p-2 border border-transparent hover:border-[var(--border-main)] transition-colors group"
                                >
                                  <span className="text-[10px] font-black uppercase italic truncate max-w-[140px]">
                                    {member.name}
                                  </span>
                                  <button
                                    onClick={() => setConfirmState({ kind: "removeMember", tgId: member.tg_id, name: member.name })}
                                    className="text-red-500 text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    УДАЛИТЬ
                                  </button>
                                </div>
                              ))}
                              {matchTeamsA.length === 0 ? (
                                <div className="text-[10px] opacity-60 uppercase">НЕТ ИГРОКОВ</div>
                              ) : null}
                            </div>
                          </div>
                          <div className="bg-[var(--bg-page)] border-2 border-[var(--bg-contrast)] p-4">
                            <div className="flex justify-between items-center mb-4 border-b border-[var(--border-main)] pb-2 text-[var(--bg-contrast)]">
                              <h3 className="font-black uppercase italic text-lg">TEAM B</h3>
                              <div className="text-[10px] font-black uppercase border-2 border-[var(--bg-contrast)] px-2 py-0.5 text-[var(--text-contrast)] bg-[var(--bg-contrast)]">
                                {matchTeamsB.length}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {matchTeamsB.map((member) => (
                                <div
                                  key={member.tg_id}
                                  className="flex justify-between items-center bg-[var(--bg-surface)] p-2 border border-transparent hover:border-[var(--border-main)] transition-colors group"
                                >
                                  <span className="text-[10px] font-black uppercase italic truncate max-w-[140px]">
                                    {member.name}
                                  </span>
                                  <button
                                    onClick={() => setConfirmState({ kind: "removeMember", tgId: member.tg_id, name: member.name })}
                                    className="text-red-500 text-[8px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    УДАЛИТЬ
                                  </button>
                                </div>
                              ))}
                              {matchTeamsB.length === 0 ? (
                                <div className="text-[10px] opacity-60 uppercase">НЕТ ИГРОКОВ</div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-[var(--border-main)] pb-2">
                          <h3 className="font-black uppercase italic text-xl">СЕГМЕНТЫ И СОБЫТИЯ</h3>
                          <div className="flex items-center gap-2">
                            {matchMeta?.status === "finished" ? (
                              <button
                                onClick={maybeRebuildFinishedMatch}
                                disabled={recalcLoading}
                                className="text-[10px] font-black uppercase border border-[var(--border-main)] px-2 py-1 bg-[var(--bg-contrast)] text-[var(--text-contrast)] disabled:opacity-40"
                              >
                                {recalcLoading ? "ПЕРЕСЧЕТ..." : "ПЕРЕСЧИТАТЬ РЕЙТИНГИ"}
                              </button>
                            ) : null}
                            <button
                              onClick={async () => {
                                if (!selectedMatchId) return;
                                try {
                                  const resp = await newSegment(selectedMatchId, false);
                                  if (resp?.segment_id && resp?.seg_no) {
                                    applyNewSegmentLocally(resp.segment_id, resp.seg_no);
                                  }
                                  await refreshMatchDetail();
                                  await maybeRebuildFinishedMatch();
                                } catch (err) {
                                  setError(formatApiError(err));
                                }
                              }}
                              className="text-[10px] font-black uppercase border border-[var(--border-main)] px-2 py-1 bg-[var(--bg-surface)]"
                            >
                              + СЕГМЕНТ
                            </button>
                          </div>
                        </div>
                        {matchDetail.segments.map((segment) => {
                          const segmentEvents = matchDetail.events.filter((e) => e.segment_id === segment.id);
                          return (
                            <div key={segment.id} className="bg-[var(--bg-surface)] border border-[var(--border-main)] overflow-hidden">
                              <div className="bg-[var(--bg-page)] p-3 flex justify-between items-center border-b border-[var(--border-main)]">
                                <div className="flex items-center gap-4">
                                  <span className="text-xs font-black uppercase italic text-[var(--text-main)]/60">
                                    СЕГМЕНТ {segment.seg_no}
                                  </span>
                                  <div className="text-lg font-black italic tracking-widest text-[var(--text-main)]">
                                    {segment.score_a}:{segment.score_b}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={async () => {
                                      if (!selectedMatchId) return;
                                      try {
                                        if (matchDetail) {
                                          setMatchDetail({
                                            ...matchDetail,
                                            segments: matchDetail.segments.map((s) =>
                                              s.id === segment.id ? { ...s, is_butt_game: !segment.is_butt_game } : s
                                            )
                                          });
                                        }
                                        await adminPatchSegment(selectedMatchId, segment.id, {
                                          is_butt_game: !segment.is_butt_game
                                        });
                                        await refreshMatchDetail();
                                      } catch (err) {
                                        setError(formatApiError(err));
                                      }
                                    }}
                                    className={`text-[9px] font-black uppercase px-2 py-1 border ${
                                      segment.is_butt_game
                                        ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border-[var(--border-main)]"
                                        : "bg-[var(--bg-surface)] text-[var(--text-main)] border-[var(--border-main)]"
                                    }`}
                                  >
                                    {segment.is_butt_game ? "ЖОПА: ДА" : "ЖОПА: НЕТ"}
                                  </button>
                                  <button
                                    onClick={() => openEventEditor(segment.id)}
                                    className="text-[9px] font-black uppercase text-[var(--bg-contrast)] hover:bg-[var(--bg-contrast)] hover:text-[var(--text-contrast)] px-2 py-1 transition-colors border border-[var(--bg-contrast)]/20"
                                  >
                                    НОВОЕ СОБЫТИЕ
                                  </button>
                                  <button
                                    onClick={() => setConfirmState({ kind: "deleteSegment", segmentId: segment.id })}
                                    className="text-[9px] font-black uppercase text-red-500/60 hover:text-red-500"
                                  >
                                    УДАЛИТЬ
                                  </button>
                                </div>
                              </div>
                              <div className="p-3 space-y-1">
                                {segmentEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className="flex items-center gap-4 bg-[var(--bg-page)] p-2 border border-[var(--border-main)]/40 hover:border-[var(--border-main)] group"
                                  >
                                    <div
                                      className={`w-2 h-2 rounded-full ${
                                        event.team === "A" ? "bg-[var(--text-main)]" : "bg-[var(--bg-contrast)]"
                                      }`}
                                    />
                                    <div className="flex-1">
                                      <span className="text-[10px] font-black uppercase italic">
                                        {event.event_type === "goal" ? "ГОЛ" : "АВТОГОЛ"}: {memberNameById(event.scorer_tg_id)}
                                      </span>
                                      {event.assist_tg_id ? (
                                        <span className="text-[8px] text-[var(--text-main)]/50 ml-2 uppercase font-black italic">
                                          АССИСТ: {memberNameById(event.assist_tg_id)}
                                        </span>
                                      ) : null}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => openEventEditor(segment.id, event)}
                                        className="text-[8px] font-black uppercase text-[var(--text-main)]/60 hover:text-[var(--text-main)]"
                                      >
                                        ПРАВКА
                                      </button>
                                      <button
                                        onClick={() =>
                                          setConfirmState({
                                            kind: "deleteEvent",
                                            eventId: event.id,
                                            label: `${event.event_type === "goal" ? "ГОЛ" : "АВТОГОЛ"}: ${memberNameById(event.scorer_tg_id)}`
                                          })
                                        }
                                        className="text-[8px] font-black uppercase text-red-500"
                                      >
                                        X
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                {segmentEvents.length === 0 ? (
                                  <div className="text-center py-4 text-[9px] text-[var(--text-main)]/40 font-black uppercase italic tracking-widest">
                                    НЕТ СОБЫТИЙ
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-[var(--bg-surface)] border-2 border-[var(--border-main)] flex flex-col overflow-hidden">
                        <div className="p-4 bg-[var(--bg-page)] border-b border-[var(--border-main)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <h3 className="font-black uppercase italic text-lg text-[var(--bg-contrast)] leading-none">
                              ПУЛ ВСЕХ ИГРОКОВ
                            </h3>
                            <p className="text-[10px] text-[var(--text-main)]/50 font-black mt-1 uppercase">
                              ДОБАВИТЬ В МАТЧ
                            </p>
                          </div>
                          <div className="w-full sm:w-64">
                            <Input
                              placeholder="БЫСТРЫЙ ПОИСК ПО ИМЕНИ..."
                              value={playerSearch}
                              onChange={(e) => setPlayerSearch(e.target.value)}
                              className="!mb-0 !py-1.5 !text-xs bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-black uppercase italic tracking-tight outline-none focus:outline-none focus:ring-0 focus:border-[var(--border-main)]"
                            />
                          </div>
                          <div className="w-full sm:w-48">
                            <select
                              value={addRole}
                              onChange={(e) => setAddRole(e.target.value as "player" | "organizer" | "spectator")}
                              className="w-full !mb-0 !py-1.5 !text-xs bg-[var(--bg-surface)] border-2 border-[var(--border-main)] text-[var(--text-main)] font-black uppercase italic tracking-tight"
                            >
                              <option value="player">ИГРОК</option>
                              <option value="organizer">ОРГАНИЗАТОР</option>
                              <option value="spectator">ЗРИТЕЛЬ</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[var(--border-main)] max-h-[400px] overflow-y-auto">
                          {availableUsers.map((user) => (
                            <div
                              key={user.tg_id}
                              className="bg-[var(--bg-page)] p-4 flex items-center justify-between hover:bg-[var(--bg-surface)] transition-all group"
                            >
                              <div className="flex items-center gap-4">
                                {user.custom_avatar || user.tg_avatar ? (
                                  <img
                                    src={resolveMediaUrl(user.custom_avatar || user.tg_avatar || "")}
                                    className="w-12 h-12 rounded-sm grayscale group-hover:grayscale-0"
                                    alt=""
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-sm border border-[var(--border-main)] flex items-center justify-center font-black text-[var(--text-main)]">
                                    {(user.custom_name || user.tg_name || "?").slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-black uppercase italic leading-none mb-1">
                                    {user.custom_name || user.tg_name}
                                  </div>
                                  <div className="text-[9px] text-[var(--text-main)]/50 font-black uppercase italic">
                                    GLOBAL: {getGlobalRatingByTgId(user.tg_id) ?? 0}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {isWaitingMatch ? (
                                  <button
                                    onClick={() => addToTeam(user.tg_id, "A", addRole)}
                                    className="h-10 px-3 border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-black hover:bg-[var(--text-main)] hover:text-[var(--bg-page)] italic uppercase"
                                  >
                                    + В СПИСОК
                                  </button>
                                ) : addRole !== "player" ? (
                                  <button
                                    onClick={() => addToTeam(user.tg_id, "A", addRole)}
                                    className="h-10 px-3 border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-black hover:bg-[var(--text-main)] hover:text-[var(--bg-page)] italic uppercase"
                                  >
                                    + В МАТЧ
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => addToTeam(user.tg_id, "A", addRole)}
                                      className="w-10 h-10 border border-[var(--border-main)] text-[var(--text-main)] text-[10px] font-black hover:bg-[var(--text-main)] hover:text-[var(--bg-page)] italic"
                                    >
                                      +A
                                    </button>
                                    <button
                                      onClick={() => addToTeam(user.tg_id, "B", addRole)}
                                      className="w-10 h-10 border border-[var(--bg-contrast)] text-[var(--bg-contrast)] text-[10px] font-black hover:bg-[var(--bg-contrast)] hover:text-[var(--text-contrast)] italic"
                                    >
                                      +B
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                          {availableUsers.length === 0 ? (
                            <div className="bg-[var(--bg-page)] p-6 text-center text-[10px] text-[var(--text-main)]/60 uppercase font-black">
                              НЕТ ДОСТУПНЫХ ИГРОКОВ
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {editingEvent && matchDetail ? (
                  <div
                    className="fixed inset-0 bg-[var(--bg-page)]/95 flex items-center justify-center z-[100] p-4"
                    onClick={() => setEditingEvent(null)}
                  >
                    <div
                      className="bg-[var(--bg-surface)] border-4 border-[var(--border-main)] w-full max-w-md p-8 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h2 className="text-2xl font-black uppercase italic mb-6 border-b-2 border-[var(--border-main)] pb-2">
                        {editingEvent.event ? "ПРАВКА СОБЫТИЯ" : "НОВОЕ СОБЫТИЕ"}
                      </h2>

                      <div className="space-y-4">
                        {(() => {
                          const fallback = matchDetail.members || [];
                          const teamPlayers = eventForm.team === "A" ? matchTeamsA : matchTeamsB;
                          const options = teamPlayers.length ? teamPlayers : fallback;
                          return (
                            <>
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--text-main)]/60 font-black uppercase italic">ТИП</label>
                          <select
                            className={modalInputClass}
                            value={eventForm.type}
                            onChange={(e) =>
                              setEventForm((prev) => ({
                                ...prev,
                                type: e.target.value as "goal" | "own_goal"
                              }))
                            }
                          >
                            <option value="goal">ГОЛ</option>
                            <option value="own_goal">АВТОГОЛ</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--text-main)]/60 font-black uppercase italic">
                            КОМАНДА
                          </label>
                          <select
                            className={modalInputClass}
                            value={eventForm.team}
                            onChange={(e) =>
                              setEventForm((prev) => ({
                                ...prev,
                                team: e.target.value as "A" | "B"
                              }))
                            }
                          >
                            <option value="A">TEAM A</option>
                            <option value="B">TEAM B</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--text-main)]/60 font-black uppercase italic">
                            ИГРОК
                          </label>
                          <select
                            className={modalInputClass}
                            value={eventForm.scorer}
                            disabled={eventForm.type === "own_goal"}
                            onChange={(e) =>
                              setEventForm((prev) => ({
                                ...prev,
                                scorer: e.target.value
                              }))
                            }
                          >
                            <option value="">ВЫБЕРИТЕ...</option>
                            {options.map((member) => (
                              <option key={member.tg_id} value={member.tg_id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-[var(--text-main)]/60 font-black uppercase italic">
                            АССИСТ
                          </label>
                          <select
                            className={modalInputClass}
                            value={eventForm.assist}
                            disabled={eventForm.type === "own_goal"}
                            onChange={(e) =>
                              setEventForm((prev) => ({
                                ...prev,
                                assist: e.target.value
                              }))
                            }
                          >
                            <option value="">БЕЗ АССИСТА</option>
                            {options.map((member) => (
                              <option key={member.tg_id} value={member.tg_id}>
                                {member.name}
                              </option>
                            ))}
                          </select>
                        </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="mt-8 flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingEvent(null)}
                          className="flex-1 py-4 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
                        >
                          ОТМЕНА
                        </button>
                        <button
                          type="button"
                          onClick={saveEvent}
                          className="flex-1 py-4 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                        >
                          СОХРАНИТЬ
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {confirmState ? (
              <div
                className="fixed inset-0 z-[120] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
                onClick={() => setConfirmState(null)}
              >
                <div
                  className="w-full max-w-md border-4 border-[var(--border-main)] bg-[var(--bg-surface)] p-8 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-2xl font-black uppercase italic mb-4 border-b-2 border-[var(--border-main)] pb-2">
                    {confirmState.kind === "deleteMatch"
                      ? "УДАЛИТЬ МАТЧ?"
                      : confirmState.kind === "deleteSegment"
                        ? "УДАЛИТЬ СЕГМЕНТ?"
                        : confirmState.kind === "removeMember"
                          ? "УДАЛИТЬ ИГРОКА?"
                          : "УДАЛИТЬ СОБЫТИЕ?"}
                  </div>
                  <div className="text-xs font-black uppercase tracking-wide text-[var(--text-main)]/60">
                    {confirmState.kind === "deleteMatch"
                      ? `Матч #${selectedMatchId ?? "—"} и все связанные данные будут удалены.`
                      : confirmState.kind === "deleteSegment"
                        ? "Сегмент и все события внутри будут удалены."
                        : confirmState.kind === "removeMember"
                          ? `Игрок ${confirmState.name} будет удален из матча.`
                          : `Событие «${confirmState.label}» будет удалено.`}
                  </div>
                  <div className="mt-8 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmState(null)}
                      className="flex-1 py-3 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
                    >
                      ОТМЕНА
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirmState.kind === "deleteMatch") {
                          await handleDeleteMatch();
                          setConfirmState(null);
                          return;
                        }
                        if (confirmState.kind === "removeMember") {
                          try {
                            await removeFromTeams(confirmState.tgId);
                          } finally {
                            setConfirmState(null);
                          }
                          return;
                        }
                        if (confirmState.kind === "deleteEvent") {
                          if (!selectedMatchId) return;
                          try {
                            await deleteEvent(selectedMatchId, confirmState.eventId);
                            await refreshMatchDetail();
                            await maybeRebuildFinishedMatch();
                          } catch (err) {
                            setError(formatApiError(err));
                          } finally {
                            setConfirmState(null);
                          }
                          return;
                        }
                        if (!selectedMatchId || confirmState.kind !== "deleteSegment") return;
                        try {
                          await deleteSegment(selectedMatchId, confirmState.segmentId);
                          await refreshMatchDetail();
                          await maybeRebuildFinishedMatch();
                        } catch (err) {
                          setError(formatApiError(err));
                        } finally {
                          setConfirmState(null);
                        }
                      }}
                      className="flex-1 py-3 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                    >
                      УДАЛИТЬ
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "TG_LINK" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between border-b border-[var(--border-main)] pb-4">
                  <h1 className="text-3xl font-black uppercase italic tracking-tighter">TG - ПРОФИЛИ</h1>
                  <Button onClick={loadTgProfiles} variant="outline">
                    Обновить
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase opacity-60">
                      TELEGRAM USERS ({safeTgUsers.length})
                    </div>
                    <div className="space-y-2">
                      {safeTgUsers.length === 0 ? (
                        <div className="text-xs opacity-60">Нет Telegram пользователей</div>
                      ) : (
                        safeTgUsers.map((user) => (
                          <button
                            key={user.tg_id}
                            type="button"
                            onClick={() => setSelectedTgUser(user)}
                            className={`w-full flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all ${
                              selectedTgUser?.tg_id === user.tg_id
                                ? "border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                                : "border-[var(--border-main)]/40 bg-[var(--bg-surface)]"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {user.tg_avatar ? (
                                <img
                                  src={resolveMediaUrl(user.tg_avatar)}
                                  className="w-8 h-8 rounded-md object-cover grayscale"
                                  alt=""
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-md border border-current/40 flex items-center justify-center text-[10px] font-black">
                                  {(user.custom_name || user.tg_name || "?").slice(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-black italic uppercase truncate">
                                  {user.custom_name || user.tg_name}
                                </div>
                                <div className="text-[10px] opacity-60">ID: {user.tg_id}</div>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-[10px] font-black uppercase opacity-60">
                      MANUAL USERS ({safeManualUsers.length})
                    </div>
                    <div className="space-y-2">
                      {safeManualUsers.length === 0 ? (
                        <div className="text-xs opacity-60">Нет ручных профилей</div>
                      ) : (
                        safeManualUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => setSelectedManualUser(user)}
                            className={`w-full flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left transition-all ${
                              selectedManualUser?.id === user.id
                                ? "border-[var(--border-main)] bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                                : "border-[var(--border-main)]/40 bg-[var(--bg-surface)]"
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-black italic uppercase truncate">{user.custom_name}</div>
                              <div className="text-[10px] opacity-60">ID: {user.id}</div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedManualUser(null);
                      setSelectedTgUser(null);
                    }}
                  >
                    Очистить
                  </Button>
                  <Button onClick={linkProfiles} disabled={!selectedTgUser || !selectedManualUser}>
                    Привязать профили
                  </Button>
                </div>
              </div>
            ) : null}
            {activeTab === "RATING_LOGS" ? (
              <div className="h-full flex flex-col">
                <div className="mb-6 flex items-center justify-between border-b border-[var(--border-main)] pb-3">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">RATING LOGS</h1>
                  <button
                    type="button"
                    onClick={async () => {
                      setRebuildLoading(true);
                      try {
                        await adminRebuildRatingLogs(1);
                        const result = await adminGetRatingLogs({});
                        setLogItems(result.logs || []);
                      } catch (err) {
                        setError(formatApiError(err));
                      } finally {
                        setRebuildLoading(false);
                      }
                    }}
                    className="border-2 border-[var(--border-main)] bg-[var(--bg-contrast)] px-4 py-2 text-[11px] font-black uppercase italic text-[var(--text-contrast)]"
                  >
                    {rebuildLoading ? "ПЕРЕСЧЕТ..." : "REBUILD ALL"}
                  </button>
                </div>
                <div className="mb-5 grid grid-cols-1 gap-2 bg-[var(--bg-surface)] p-2 border border-[var(--border-main)]/50 sm:grid-cols-3">
                  <input
                    placeholder="ПОИСК ПО ИГРОКУ..."
                    value={ratingSearchPlayer}
                    onChange={(e) => setRatingSearchPlayer(e.target.value)}
                    className="w-full bg-[var(--bg-page)] border border-[var(--border-main)] text-[var(--text-main)] px-3 py-2 text-[11px] font-black uppercase italic outline-none focus:border-[var(--text-accent)]"
                  />
                  <input
                    placeholder="ПОИСК ПО МАТЧУ..."
                    value={ratingSearchMatch}
                    onChange={(e) => setRatingSearchMatch(e.target.value)}
                    className="w-full bg-[var(--bg-page)] border border-[var(--border-main)] text-[var(--text-main)] px-3 py-2 text-[11px] font-black uppercase italic outline-none focus:border-[var(--text-accent)]"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setLogsLoading(true);
                      try {
                        const result = await adminGetRatingLogs({});
                        setLogItems(result.logs || []);
                      } catch (err) {
                        setError(formatApiError(err));
                      } finally {
                        setLogsLoading(false);
                      }
                    }}
                    className="w-full border-2 border-[var(--border-main)] bg-[var(--bg-page)] text-[var(--text-main)] px-3 py-2 text-[11px] font-black uppercase italic"
                  >
                    {logsLoading ? "ЗАГРУЖАЮ..." : "ОБНОВИТЬ"}
                  </button>
                </div>
                <div className="flex-1 overflow-auto space-y-1 pb-20">
                  {filteredRatingLogs.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-[var(--border-main)]/40 text-[10px] uppercase font-black italic opacity-60">
                      DATABASE EMPTY
                    </div>
                  ) : (
                    filteredRatingLogs.map((log) => (
                      <div
                        key={log.id}
                        className="bg-[var(--bg-surface)] border border-[var(--border-main)]/60 p-3 hover:border-[var(--border-main)] transition-colors"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <div className="text-xl font-black uppercase italic tracking-tighter">Матч #{log.match_id}</div>
                          <div className="text-[10px] font-mono opacity-60">
                            {new Date(log.created_at).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        <div className="mb-2 text-[11px] text-[var(--text-main)]/70 uppercase italic">
                          {displayName(log.player_id)} | {venueLabel(log.venue)}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-2xl font-black italic leading-none ${
                              log.delta >= 0 ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            Δ {log.delta.toFixed(2)}
                          </span>
                          <span className="text-[var(--text-main)]/40 text-lg font-black">|</span>
                          <span className="text-lg font-mono tracking-tighter text-[var(--text-main)]/80">
                            {log.pre_global.toFixed(2)} <span className="text-[var(--text-main)]/40">→</span>{" "}
                            {log.post_global.toFixed(2)}
                          </span>
                        </div>
                        {log.details ? (
                          <div className="mt-2 text-[10px] text-[var(--text-main)]/65 font-black uppercase tracking-tight">
                            Победа/поражение: {(log.details.result_delta ?? 0).toFixed(2)} | Голы:{" "}
                            {(log.details.goal_delta ?? 0).toFixed(2)} | Ассисты: {(log.details.assist_delta ?? 0).toFixed(2)}{" "}
                            | Фидбек: {(log.details.quick_delta ?? 0).toFixed(2)} (MVP {(log.details.mvp_delta ?? 0).toFixed(2)}
                            , Сравнения {(log.details.pairwise_delta ?? 0).toFixed(2)}, Fan {(log.details.fan_delta ?? 0).toFixed(2)})
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            {activeTab === "FEEDBACK" ? (
              <div className="h-full flex flex-col">
                <div className="mb-6 flex items-center justify-between border-b border-[var(--border-main)] pb-3">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">FEEDBACK LOGS</h1>
                </div>
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-[1fr_200px_auto] gap-2">
                  <input
                    placeholder="SEARCH VOTER / MATCH ID..."
                    value={feedbackSearch}
                    onChange={(e) => setFeedbackSearch(e.target.value)}
                    className="w-full bg-[var(--bg-page)] border-2 border-[var(--border-main)] text-[var(--text-main)] px-4 py-3 text-[13px] font-black uppercase italic outline-none focus:border-[var(--text-accent)]"
                  />
                  <Input
                    value={feedbackMatchId}
                    onChange={(e) => setFeedbackMatchId(e.target.value)}
                    placeholder="MATCH ID"
                    className={modalInputClass}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setFeedbackVotesLoading(true);
                      try {
                        const result = await adminGetFeedbackVotes({
                          match_id: feedbackMatchId ? Number(feedbackMatchId) : undefined
                        });
                        setFeedbackVotesItems(result.items || []);
                      } catch (err) {
                        setError(formatApiError(err));
                      } finally {
                        setFeedbackVotesLoading(false);
                      }
                    }}
                    className="border-2 border-[var(--border-main)] bg-[var(--bg-page)] px-4 py-3 text-[12px] font-black uppercase italic"
                  >
                    {feedbackVotesLoading ? "ЗАГРУЖАЮ..." : "REFRESH"}
                  </button>
                </div>
                <div className="flex-1 overflow-auto space-y-4 pb-40 pr-1">
                  {filteredFeedbackItems.map((item, index) => {
                    const answers = (item.answers_json || {}) as Record<string, unknown>;
                    const worst = answers.worst;
                    const comparisons = (answers.comparisons || {}) as Record<string, unknown>;
                    const pairs = (answers.comparison_pairs || {}) as Record<string, unknown>;
                    const expandedPairs = (answers.expanded_pairs || {}) as Record<string, unknown>;
                    const roleVote = (answers.role_vote || {}) as Record<string, unknown>;
                    const attackerPicked = answers.best_attacker || (roleVote.role === "attacker" ? roleVote.player_id : null);
                    const defenderPicked = answers.best_defender || (roleVote.role === "defender" ? roleVote.player_id : null);
                    const duelRows = [
                      { label: "DUEL 1", pair: pairs.cmp_own, pick: comparisons.cmp_own },
                      { label: "DUEL 2", pair: pairs.cmp_opp, pick: comparisons.cmp_opp },
                      { label: "DUEL 3", pair: pairs.cmp_cross, pick: comparisons.cmp_cross }
                    ];
                    return (
                      <div
                        key={`${item.match_id}-${item.tg_id}-${index}`}
                        className="bg-[var(--bg-page)] border-2 border-[var(--border-main)] hover:border-[var(--text-accent)]/50 transition-all flex flex-col overflow-hidden"
                      >
                        <div className="bg-[var(--bg-surface)] p-3 flex justify-between items-center border-b-2 border-[var(--border-main)]">
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="text-[var(--text-main)] text-2xl font-black uppercase italic leading-none tracking-tighter">
                              МАТЧ #{item.match_id}
                            </span>
                            <span className="text-[var(--text-accent)] text-[12px] font-black uppercase leading-none truncate tracking-tight">
                              {nameById(item.tg_id)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono opacity-60 uppercase italic leading-none shrink-0">
                            FEEDBACK
                          </span>
                        </div>
                        <div className="grid grid-cols-2 divide-x-2 divide-[var(--border-main)] border-b-2 border-[var(--border-main)]">
                          <div className="p-4 bg-[var(--bg-surface)]/30 min-w-0">
                            <div className="text-[10px] opacity-60 font-black mb-1 uppercase tracking-widest">MVP</div>
                            <div className="text-[26px] font-black uppercase italic leading-none tracking-tighter whitespace-normal break-words">
                              {nameById(item.mvp_vote_tg_id)}
                            </div>
                          </div>
                          <div className="p-4 bg-[var(--bg-page)] min-w-0">
                            <div className="text-[10px] opacity-60 font-black mb-1 uppercase tracking-widest">WORST</div>
                            <div className="text-[26px] text-[var(--text-main)]/60 font-black uppercase italic leading-none tracking-tighter whitespace-normal break-words">
                              {nameById(worst)}
                            </div>
                          </div>
                        </div>
                        <div className="p-3 space-y-3 bg-[var(--bg-page)]">
                          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-main)]/50">DUELS</div>
                          {duelRows.map((row) => {
                            const pair = Array.isArray(row.pair) ? row.pair : [];
                            if (pair.length < 2) return null;
                            const left = pair[0];
                            const right = pair[1];
                            const selected = row.pick;
                            const leftSelected = String(left) === String(selected);
                            const rightSelected = String(right) === String(selected);
                            return (
                              <div key={row.label} className="border border-[var(--border-main)]/40 p-2 text-[10px] font-black uppercase italic">
                                <span className="opacity-50 mr-2">{row.label}</span>
                                <span
                                  className={
                                    leftSelected
                                      ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border border-[var(--border-main)] rounded px-1"
                                      : "text-[var(--text-main)]/80"
                                  }
                                >
                                  {nameById(left)}
                                </span>
                                <span className="opacity-50 mx-2">VS</span>
                                <span
                                  className={
                                    rightSelected
                                      ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] border border-[var(--border-main)] rounded px-1"
                                      : "text-[var(--text-main)]/80"
                                  }
                                >
                                  {nameById(right)}
                                </span>
                              </div>
                            );
                          })}

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="border border-[var(--border-main)]/50 p-2 bg-[var(--bg-surface)]/20">
                              <div className="text-[9px] font-black uppercase opacity-50 mb-1">SYNERGY</div>
                              <div className="text-[10px] font-black uppercase italic text-[var(--text-main)]/80">
                                {nameById(expandedPairs.syn_team_a)} + {nameById(expandedPairs.syn_team_b)}
                              </div>
                              <div className="text-[10px] font-black uppercase italic text-[var(--text-main)]/80">
                                {nameById(expandedPairs.syn_opp_a)} + {nameById(expandedPairs.syn_opp_b)}
                              </div>
                            </div>
                            <div className="border border-[var(--border-main)]/50 p-2 bg-[var(--bg-surface)]/20">
                              <div className="text-[9px] font-black uppercase opacity-50 mb-1">DOMINATION</div>
                              <div className="text-[10px] font-black uppercase italic text-[var(--text-main)]/80">
                                {nameById(expandedPairs.dom_my)} {"->"} {nameById(expandedPairs.dom_opp_target)}
                              </div>
                              <div className="text-[10px] font-black uppercase italic text-[var(--text-main)]/80">
                                {nameById(expandedPairs.dom_opp)} {"->"} {nameById(expandedPairs.dom_my_target)}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="border border-[var(--border-main)]/50 p-2 bg-[var(--bg-surface)]/20">
                              <div className="text-[9px] font-black uppercase opacity-50">ATTACK</div>
                              <div className="text-[12px] font-black uppercase italic">{nameById(attackerPicked)}</div>
                            </div>
                            <div className="border border-[var(--border-main)]/50 p-2 bg-[var(--bg-surface)]/20">
                              <div className="text-[9px] font-black uppercase opacity-50">DEFENSE</div>
                              <div className="text-[12px] font-black uppercase italic">{nameById(defenderPicked)}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredFeedbackItems.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-[var(--border-main)]/40 text-[10px] uppercase font-black italic opacity-60">
                      DATABASE EMPTY
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {activeTab === "POSITION_LOGS" ? (
              <div className="h-full flex flex-col">
                <div className="mb-6 flex items-center justify-between border-b border-[var(--border-main)] pb-3">
                  <h1 className="text-4xl font-black uppercase italic tracking-tighter leading-none">POSITION LOGS</h1>
                  <button
                    type="button"
                    onClick={async () => {
                      setPositionLogsLoading(true);
                      try {
                        const result = await adminGetPositionLogs({ limit: 500 });
                        setPositionLogItems(result.logs || []);
                      } catch (err) {
                        setError(formatApiError(err));
                      } finally {
                        setPositionLogsLoading(false);
                      }
                    }}
                    className="border-2 border-[var(--border-main)] bg-[var(--bg-page)] px-4 py-2 text-[11px] font-black uppercase italic"
                  >
                    ОБНОВИТЬ
                  </button>
                </div>
                <div className="mb-4">
                  <input
                    placeholder="ПОИСК: ИГРОК / МАТЧ / SOURCE..."
                    value={positionSearch}
                    onChange={(e) => setPositionSearch(e.target.value)}
                    className="w-full bg-[var(--bg-page)] border border-[var(--border-main)] text-[var(--text-main)] px-3 py-2 text-[11px] font-black uppercase italic outline-none focus:border-[var(--text-accent)]"
                  />
                </div>
                <div className="flex-1 overflow-auto space-y-1 pb-20">
                  {positionLogsLoading ? (
                    <div className="py-12 text-center text-[10px] uppercase font-black italic opacity-60">LOADING...</div>
                  ) : null}
                  {filteredPositionLogs.map((log) => {
                    return (
                      <div
                        key={`${log.id}-${log.player_id}`}
                        className="bg-[var(--bg-surface)] border border-[var(--border-main)]/60 p-3 hover:border-[var(--border-main)] transition-all flex items-center justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-3">
                            <span className="text-sm font-black uppercase italic truncate">{displayName(log.player_id)}</span>
                            <span className="text-[9px] font-black px-1.5 py-0.5 uppercase tracking-tighter bg-[var(--bg-page)] border border-[var(--border-main)]/60">
                              {positionSourceLabel(log.source)}
                            </span>
                            <span className="text-[10px] opacity-60 font-black uppercase">MATCH #{log.match_id}</span>
                            {feedbackAuthorFromSource(log.source) ? (
                              <span className="text-[10px] opacity-60 font-black uppercase">
                                AUTHOR: {feedbackAuthorFromSource(log.source)}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[9px] opacity-50 font-black">ATTACKER</span>
                              <span className="text-sm font-mono tracking-tighter">
                                {log.old_attacker.toFixed(2)} → {log.new_attacker.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-[9px] opacity-50 font-black">DEFENDER</span>
                              <span className="text-sm font-mono tracking-tighter">
                                {log.old_defender.toFixed(2)} → {log.new_defender.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 text-right">
                          <div className={`text-sm font-black italic ${log.delta_attacker >= 0 ? "text-green-500" : "text-red-500"}`}>
                            A {log.delta_attacker > 0 ? "+" : ""}
                            {log.delta_attacker.toFixed(2)}
                          </div>
                          <div className={`text-sm font-black italic ${log.delta_defender >= 0 ? "text-green-500" : "text-red-500"}`}>
                            D {log.delta_defender > 0 ? "+" : ""}
                            {log.delta_defender.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!positionLogsLoading && filteredPositionLogs.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-[var(--border-main)]/40 text-[10px] uppercase font-black italic opacity-60">
                      DATABASE EMPTY
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {activeTab === "INTERACTIONS" ? (
              <div className="flex flex-col h-full w-full">
                <div className="mb-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6">
                    <h1 className="text-4xl font-black uppercase tracking-tighter italic leading-none">
                      ANALYTICS: <span className="text-[var(--text-accent)]">{matrixKind.toUpperCase()}</span>
                    </h1>
                    <div className="flex border-2 border-[var(--border-main)] bg-[var(--bg-page)] shrink-0">
                      {(["synergy", "domination"] as const).map((kind) => (
                        <button
                          key={kind}
                          onClick={() => {
                            setMatrixKind(kind);
                            setMatrixSort({ playerId: null, axis: "none", dir: "none" });
                            loadMatrix(kind, matrixVenue);
                            loadInteractionLogs(kind, matrixVenue, interactionLogPlayer);
                          }}
                          className={`px-5 py-2 text-[12px] font-black uppercase italic transition-all ${
                            matrixKind === kind
                              ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                              : "text-[var(--text-main)]/60 hover:text-[var(--text-main)]"
                          }`}
                        >
                          {kind === "synergy" ? "СЫГРАННОСТЬ" : "ДОМИНАЦИЯ"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[{ key: "__global__", label: "Глобальная" }, { key: venueA, label: venueA }, { key: venueB, label: venueB }].map((v) => (
                      <button
                        key={v.key}
                        onClick={() => {
                          setMatrixVenue(v.key);
                          setMatrixSort({ playerId: null, axis: "none", dir: "none" });
                          loadMatrix(matrixKind, v.key);
                          loadInteractionLogs(matrixKind, v.key, interactionLogPlayer);
                        }}
                        className={`px-5 py-2 border-2 text-[11px] font-black uppercase italic transition-all ${
                          matrixVenue === v.key
                            ? "bg-[var(--bg-contrast)] border-[var(--bg-contrast)] text-[var(--text-contrast)]"
                            : "bg-[var(--bg-page)] border-[var(--border-main)] text-[var(--text-main)]/60 hover:text-[var(--text-main)]"
                        }`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[var(--bg-page)] border border-[var(--border-main)] relative flex flex-col flex-1 min-h-0">
                  <div className="bg-[var(--bg-surface)] p-2 text-[8px] opacity-70 uppercase font-black tracking-widest flex justify-between shrink-0">
                    <div className="flex gap-4">
                      <span>{matrixKind.toUpperCase()} MATRIX</span>
                      <span className="italic">КЛИК ПО ИМЕНИ = СОРТИРОВКА</span>
                    </div>
                    <span>A = СТРОКА, B = СТОЛБЕЦ</span>
                  </div>
                  <div className="overflow-auto flex-1 max-h-[62vh]">
                    {matrixLoading ? (
                      <div className="p-3 text-sm opacity-60">Загрузка...</div>
                    ) : matrixPlayers.length === 0 ? (
                      <div className="p-3 text-sm opacity-60">Нет данных</div>
                    ) : (
                      <table className="border-separate border-spacing-0 table-auto min-w-max">
                        <thead>
                          <tr className="bg-[var(--bg-surface)]">
                            <th className="sticky top-0 left-0 z-50 bg-[var(--bg-surface)] border-b border-r border-[var(--border-main)] p-3 w-32 min-w-[128px]">
                              <div className="text-[10px] opacity-60 font-black uppercase text-left italic">A \ B</div>
                            </th>
                            {displayMatrixCols.map((player) => (
                              <th
                                key={player}
                                onClick={() => toggleMatrixSort(player, "col")}
                                className={`sticky top-0 z-40 border-b border-[var(--border-main)] p-3 text-[10px] font-black uppercase italic text-center min-w-[100px] cursor-pointer transition-colors ${
                                  matrixSort.playerId === player && matrixSort.axis === "col"
                                    ? "bg-[var(--bg-surface)] text-[var(--text-accent)]"
                                    : "bg-[var(--bg-surface)] text-[var(--text-main)]/60 hover:text-[var(--text-main)]"
                                }`}
                              >
                                <div className="flex items-center justify-center">
                                  {displayName(player)}
                                  <span className="text-[var(--text-accent)]">{matrixSortIcon(player, "col")}</span>
                                </div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {displayMatrixRows.map((rowPlayer) => (
                            <tr key={rowPlayer} className="hover:bg-[var(--bg-surface)]/30">
                              <td
                                onClick={() => toggleMatrixSort(rowPlayer, "row")}
                                className={`sticky left-0 z-30 bg-[var(--bg-surface)] border-b border-r border-[var(--border-main)] p-3 text-[11px] font-black uppercase italic cursor-pointer transition-colors ${
                                  matrixSort.playerId === rowPlayer && matrixSort.axis === "row"
                                    ? "text-[var(--text-accent)]"
                                    : "hover:text-[var(--text-accent)]"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  {displayName(rowPlayer)}
                                  <span className="text-[var(--text-accent)]">{matrixSortIcon(rowPlayer, "row")}</span>
                                </div>
                              </td>
                              {displayMatrixCols.map((colPlayer) => {
                                const isSelf = rowPlayer === colPlayer;
                                const val = matrixValueByIds.get(`${rowPlayer}_${colPlayer}`) ?? 0;
                                let textColor = "text-[var(--text-main)]/50";
                                let bgColor = "";
                                if (!isSelf) {
                                  if (val > 0) textColor = "text-green-500 font-bold";
                                  if (val < 0) textColor = "text-red-500 font-bold";
                                  if (Math.abs(val) > 1.0) bgColor = val > 0 ? "bg-green-500/10" : "bg-red-500/10";
                                  if (
                                    (matrixSort.axis === "col" && matrixSort.playerId === colPlayer) ||
                                    (matrixSort.axis === "row" && matrixSort.playerId === rowPlayer)
                                  ) {
                                    bgColor = val > 0 ? "bg-green-500/20" : val < 0 ? "bg-red-500/20" : "bg-white/5";
                                  }
                                }
                                return (
                                  <td
                                    key={`${rowPlayer}-${colPlayer}`}
                                    className={`border-b border-[var(--border-main)] p-3 text-center font-mono text-[11px] ${bgColor} ${textColor}`}
                                  >
                                    {isSelf ? "—" : val === 0 ? "0.00" : `${val > 0 ? "+" : ""}${val.toFixed(2)}`}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <div className="mt-8 shrink-0 pb-20">
                  <div className="flex justify-between items-center mb-4 border-b border-[var(--border-main)] pb-2 gap-2">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                      ЛОГИ: {matrixKind.toUpperCase()}
                    </h2>
                    <div className="flex gap-2">
                      <input
                        placeholder="ПОИСК ПО ИГРОКУ..."
                        value={interactionLogPlayer}
                        onChange={(e) => setInteractionLogPlayer(e.target.value)}
                        className="bg-[var(--bg-surface)] border border-[var(--border-main)] px-3 py-1 text-[10px] text-[var(--text-main)] outline-none focus:border-[var(--text-accent)] uppercase italic w-48"
                      />
                      <button
                        type="button"
                        onClick={async () => loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer)}
                        className="px-3 py-1 text-[10px] font-black uppercase border border-[var(--border-main)] bg-[var(--bg-page)]"
                      >
                        Обновить
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {interactionLogsLatest.map((log) => (
                      <div
                        key={log.id}
                        className="bg-[var(--bg-surface)] border border-[var(--border-main)] p-3 hover:border-[var(--border-main)] transition-colors"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-[12px] font-black uppercase italic flex items-center gap-2">
                            <span>{displayName(log.player_a)}</span>
                            <span className="text-[8px] opacity-60 font-black">
                              {matrixKind === "synergy" ? "↔" : "vs"}
                            </span>
                            <span className="text-[var(--text-accent)]">{displayName(log.player_b)}</span>
                          </div>
                          <div className="text-[8px] opacity-60 font-mono">
                            {new Date(log.created_at).toLocaleString("ru-RU")}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="opacity-60 font-mono text-[10px]">{log.value_before.toFixed(2)}</span>
                          <span className="text-[var(--text-accent)] text-[10px]">→</span>
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              log.value_after >= log.value_before ? "text-green-500" : "text-red-500"
                            }`}
                          >
                            {log.value_after.toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 text-[9px] opacity-60 uppercase italic truncate">
                          {venueLabel(log.venue)} | {sourceLabel(log.source)}
                        </div>
                        <div className="mt-1 text-[9px] opacity-60 uppercase italic">
                          Матч: {log.match_id ?? "—"} | Log: {log.id}
                          {feedbackAuthorFromSource(log.source) ? ` | Автор: ${feedbackAuthorFromSource(log.source)}` : ""}
                        </div>
                      </div>
                    ))}
                    {interactionLogsLatest.length === 0 ? (
                      <div className="col-span-full py-8 text-center border border-dashed border-[var(--border-main)]/40 text-[10px] opacity-60 uppercase italic font-black">
                        ЛОГИ ПУСТЫ
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      </main>

      <aside
        className={`
        fixed inset-y-0 right-0 z-[70] w-64 border-l border-[var(--border-main)] bg-[var(--bg-surface)] flex flex-col shrink-0 transition-transform duration-300
        lg:relative lg:translate-x-0 lg:border-l lg:border-r-0
        ${isMenuOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="p-6 border-b border-[var(--border-main)] bg-[var(--bg-surface)] flex justify-between items-center shrink-0">
          <h1 className="text-2xl lg:text-3xl font-black tracking-tighter italic leading-none">
            WEBFUT<br />
            <span className="text-[var(--text-accent)] text-[10px] lg:text-sm uppercase not-italic tracking-widest">
              ADMIN PANEL
            </span>
          </h1>
          <button onClick={() => setIsMenuOpen(false)} className="lg:hidden text-[var(--text-main)] opacity-60">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-6 mb-2 text-[10px] text-[var(--text-main)] opacity-60 font-black uppercase tracking-widest">ОСНОВНОЕ</div>
          <ul className="space-y-px">{navItems.slice(0, 2).map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleTabChange(item.id as AdminTab)}
                  className={`w-full text-left px-6 py-3 font-black uppercase italic tracking-tighter transition-all ${
                    activeTab === item.id
                      ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] -translate-x-1 lg:translate-x-1"
                      : "text-[var(--text-main)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="px-6 mt-8 mb-2 text-[10px] text-[var(--text-main)] opacity-60 font-black uppercase tracking-widest">
            АНАЛИТИКА И ЛОГИ
          </div>
          <ul className="space-y-px">{navItems.slice(2).map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => handleTabChange(item.id as AdminTab)}
                  className={`w-full text-left px-6 py-2 font-bold uppercase tracking-tight transition-all text-xs ${
                    activeTab === item.id
                      ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)] -translate-x-1 lg:translate-x-1"
                      : "text-[var(--text-main)] opacity-60 hover:opacity-100 hover:bg-[var(--bg-surface)]"
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {(editPlayer || isCreatingUser) ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={closeUserModal}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl animate-in zoom-in duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-black uppercase italic mb-8 border-b-4 border-[var(--bg-contrast)] pb-3 text-[var(--text-main)]">
              {isCreatingUser ? "НОВЫЙ ИГРОК" : `ПРАВКА: ${editPlayer ? displayName(editPlayer.player_id) : ""}`}
            </h2>

            {isCreatingUser ? (
              <div className="space-y-6">
                <Input
                  value={createValues.name}
                  onChange={(e) => setCreateValues((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ИМЯ В СИСТЕМЕ"
                  className={modalInputClass}
                />
                <Input
                  value={createValues.tgId}
                  onChange={(e) => setCreateValues((prev) => ({ ...prev, tgId: e.target.value }))}
                  placeholder="TELEGRAM ID (опционально)"
                  className={modalInputClass}
                />
                <div className="pt-6 border-t-2 border-[var(--border-main)]">
                  <label className="block text-[10px] font-black uppercase mb-2 tracking-widest text-[var(--text-main)]/60">
                    БАЗОВЫЙ РЕЙТИНГ (GLB)
                  </label>
                  <Input
                    value={createValues.base}
                    onChange={(e) => setCreateValues((prev) => ({ ...prev, base: e.target.value }))}
                    placeholder="500"
                    type="number"
                    className="!text-[var(--bg-contrast)] !text-6xl !font-black !bg-[var(--bg-page)] h-24 text-center border-2 border-[var(--border-main)] !mb-0 outline-none focus:outline-none focus:ring-0"
                  />
                </div>
              </div>
            ) : editPlayer ? (
              <div className="space-y-6">
                <Input
                  value={editValues.name}
                  onChange={(e) => setEditValues((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="ИМЯ В СИСТЕМЕ"
                  className={modalInputClass}
                />
                <div className="pt-6 border-t-2 border-[var(--border-main)]">
                  <label className="block text-[10px] font-black uppercase mb-2 tracking-widest text-[var(--text-main)]/60">
                    БАЗОВЫЙ РЕЙТИНГ (GLB)
                  </label>
                  <Input
                    value={editValues.base}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, base: e.target.value }))}
                    placeholder="500"
                    type="number"
                    className="!text-[var(--bg-contrast)] !text-6xl !font-black !bg-[var(--bg-page)] h-24 text-center border-2 border-[var(--border-main)] !mb-0 outline-none focus:outline-none focus:ring-0"
                  />
                </div>
                <div className="pt-6 border-t-2 border-[var(--border-main)] space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)]/60">
                    ПРИВЯЗАТЬ TELEGRAM
                  </div>
                  <Input
                    value={bindSearch}
                    onChange={(e) => setBindSearch(e.target.value)}
                    placeholder="Поиск по имени"
                    className={modalInputClass}
                  />
                  <div className="max-h-40 space-y-2 overflow-auto border-2 border-[var(--border-main)]/40 p-2">
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
                          className={`flex w-full items-center justify-between px-2 py-1 text-xs font-black uppercase ${
                            editValues.bindTg === String(user.tg_id)
                              ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                              : "border border-[var(--border-main)]/40 hover:border-[var(--border-main)]"
                          }`}
                        >
                          <span>{user.custom_name || user.tg_name}</span>
                          <span className="text-[10px] opacity-60">{user.tg_id}</span>
                        </button>
                      ))}
                  </div>
                  <Input
                    value={editValues.bindTg}
                    onChange={(e) => setEditValues((prev) => ({ ...prev, bindTg: e.target.value }))}
                    placeholder="TG ID вручную"
                    className={modalInputClass}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-10 flex gap-4">
              <button
                type="button"
                onClick={closeUserModal}
                className="flex-1 py-4 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
              >
                ОТМЕНА
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (isCreatingUser) {
                    if (createSaving) return;
                    const trimmedName = createValues.name.trim();
                    if (!trimmedName) return;
                    setCreateSaving(true);
                    try {
                      const created = await adminCreateUser({
                        tg_id: createValues.tgId ? Number(createValues.tgId) : undefined,
                        name: trimmedName
                      });
                      if (createValues.base !== "") {
                        await adminPatchStatePlayer({
                          player_id: String(created.tg_id),
                          base_rating: Number(createValues.base)
                        });
                      }
                      await adminRebuildRatingLogs(1);
                      await adminRebuildState(1);
                      await loadUsers();
                      await loadState();
                      closeUserModal();
                    } catch (err) {
                      setError(formatApiError(err));
                    } finally {
                      setCreateSaving(false);
                    }
                    return;
                  }
                  if (!editPlayer || editSaving) return;
                  setEditSaving(true);
                  try {
                    const trimmedName = editValues.name.trim();
                    const playerTgId = Number(editPlayer.player_id);
                    if (trimmedName && !Number.isNaN(playerTgId)) {
                      await adminPatchUser(playerTgId, { custom_name: trimmedName });
                    }
                    await adminPatchStatePlayer({
                      player_id: editPlayer.player_id,
                      base_rating: editValues.base === "" ? undefined : Number(editValues.base)
                    });
                    await adminRebuildRatingLogs(1);
                    await adminRebuildState(1);
                    if (editValues.bindTg && editValues.bindTg !== editPlayer.player_id) {
                      await adminBindStatePlayer({
                        player_id: editPlayer.player_id,
                        tg_id: Number(editValues.bindTg)
                      });
                    }
                    closeUserModal();
                    await loadUsers();
                    await loadState();
                  } catch (err) {
                    setError(formatApiError(err));
                  } finally {
                    setEditSaving(false);
                  }
                }}
                className="flex-1 py-4 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
              >
                {isCreatingUser
                  ? createSaving
                    ? "СОХРАНЯЮ..."
                    : "СОХРАНИТЬ"
                  : editSaving
                    ? "СОХРАНЯЮ..."
                    : "СОХРАНИТЬ"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logsOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={() => setLogsOpen(false)}
        >
          <div
            className="w-full max-w-3xl border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-black uppercase italic mb-8 border-b-4 border-[var(--bg-contrast)] pb-3 text-[var(--text-main)]">
              ЛОГИ РЕЙТИНГОВ
            </h2>
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={logMatchId}
                  onChange={(e) => setLogMatchId(e.target.value)}
                  placeholder="Матч ID"
                  className={modalInputClass}
                />
                <Input
                  value={logPlayerId}
                  onChange={(e) => setLogPlayerId(e.target.value)}
                  placeholder="Игрок ID"
                  className={modalInputClass}
                />
              </div>
              <div className="max-h-32 space-y-2 overflow-auto border-2 border-[var(--border-main)]/40 p-2">
                {users.map((user) => (
                  <button
                    key={user.tg_id}
                    type="button"
                    onClick={() => setLogPlayerId(String(user.tg_id))}
                    className={`flex w-full items-center justify-between px-2 py-1 text-xs font-black uppercase ${
                      logPlayerId === String(user.tg_id)
                        ? "bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                        : "border border-[var(--border-main)]/40 hover:border-[var(--border-main)]"
                    }`}
                  >
                    <span>{user.custom_name || user.tg_name}</span>
                    <span className="text-[10px] opacity-60">{user.tg_id}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
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
                  className="px-4 py-2 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                >
                  {logsLoading ? "ЗАГРУЖАЮ..." : "ПОКАЗАТЬ"}
                </button>
                <button
                  type="button"
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
                  className="px-4 py-2 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
                >
                  {rebuildLoading ? "ПЕРЕСЧИТЫВАЮ..." : "ПЕРЕСЧИТАТЬ ЛОГИ"}
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto">
                {logItems.length === 0 ? (
                  <div className="text-xs text-[var(--text-main)]/60">Логов нет</div>
                ) : (
                  logItems.map((log) => (
                    <div key={log.id} className="border-2 border-[var(--border-main)]/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-black">Матч #{log.match_id}</span>
                        <span className="text-xs text-[var(--text-main)]/60">
                          {new Date(log.created_at).toLocaleString("ru-RU")}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--text-main)]/60">
                        {displayName(log.player_id)} | {venueLabel(log.venue)}
                      </div>
                      <div>
                        DELTA {log.delta.toFixed(2)} | {log.pre_global.toFixed(2)} {" > "}{" "}
                        {log.post_global.toFixed(2)}
                      </div>
                      <div className="text-xs text-[var(--text-main)]/60">
                        Голы: {log.goals}, Ассисты: {log.assists}
                      </div>
                      {log.details ? (
                        <div className="text-xs text-[var(--text-main)]/60">
                          Победа/поражение: {log.details.result_delta?.toFixed(2) ?? "0.00"} | Гол:{" "}
                          {log.details.goal_delta?.toFixed(2) ?? "0.00"} | Ассист:{" "}
                          {log.details.assist_delta?.toFixed(2) ?? "0.00"} | Фидбек:{" "}
                          {log.details.quick_delta?.toFixed(2) ?? "0.00"} (MVP{" "}
                          {log.details.mvp_delta?.toFixed(2) ?? "0.00"}, сравнения{" "}
                          {log.details.pairwise_delta?.toFixed(2) ?? "0.00"}, fan{" "}
                          {log.details.fan_delta?.toFixed(2) ?? "0.00"})
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setLogsOpen(false)}
                className="w-full py-3 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {feedbackVotesOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={() => setFeedbackVotesOpen(false)}
        >
          <div
            className="w-full max-w-3xl border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-black uppercase italic mb-8 border-b-4 border-[var(--bg-contrast)] pb-3 text-[var(--text-main)]">
              ГОЛОСА ФИДБЕКА
            </h2>
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={feedbackMatchId}
                  onChange={(e) => setFeedbackMatchId(e.target.value)}
                  placeholder="Матч ID (опционально)"
                />
                <button
                  type="button"
                  onClick={async () => {
                    setFeedbackVotesLoading(true);
                    try {
                      const result = await adminGetFeedbackVotes({
                        match_id: feedbackMatchId ? Number(feedbackMatchId) : undefined
                      });
                      setFeedbackVotesItems(result.items || []);
                    } catch (err) {
                      setError(formatApiError(err));
                    } finally {
                      setFeedbackVotesLoading(false);
                    }
                  }}
                  className="px-4 py-2 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)]"
                >
                  {feedbackVotesLoading ? "ЗАГРУЖАЮ..." : "ПОКАЗАТЬ"}
                </button>
              </div>
              <div className="max-h-64 space-y-2 overflow-auto">
                {feedbackVotesItems.length === 0 ? (
                  <div className="text-xs text-[var(--text-main)]/60">Нет голосов</div>
                ) : (
                  feedbackVotesItems.map((item, index) => {
                    const answers = (item.answers_json || {}) as Record<string, unknown>;
                    const quick = (answers.quick || {}) as Record<string, unknown>;
                    const worst = answers.worst;
                    const comparisons = (answers.comparisons || {}) as Record<string, unknown>;
                    const pairs = (answers.comparison_pairs || {}) as Record<string, unknown>;
                    const ownPair = formatPair(pairs.cmp_own);
                    const oppPair = formatPair(pairs.cmp_opp);
                    const crossPair = formatPair(pairs.cmp_cross);
                    const expandedPairs = (answers.expanded_pairs || {}) as Record<string, unknown>;
                    const roleVote = (answers.role_vote || {}) as Record<string, unknown>;
                    const fanEntries = extractFanEntries(answers);
                    return (
                      <div key={`${item.match_id}-${item.tg_id}-${index}`} className="border-2 border-[var(--border-main)]/40 p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-black">Матч #{item.match_id}</span>
                          <span className="text-xs text-[var(--text-main)]/60">{nameById(item.tg_id)}</span>
                        </div>
                        <div className="text-xs text-[var(--text-main)]/60">
                          Лучший {" > "} {nameById(answers.best)}
                        </div>
                        <div className="text-xs text-[var(--text-main)]/60">
                          MVP {" > "} {nameById(item.mvp_vote_tg_id)}
                        </div>
                        <div className="text-xs text-[var(--text-main)]/60">
                          Худший {" > "} {nameById(worst)}
                        </div>
                        {quick.best || quick.compare_left || quick.compare_right ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Быстрый: {nameById(quick.best)} • {nameById(quick.compare_left)} vs{" "}
                            {nameById(quick.compare_right)}
                          </div>
                        ) : null}
                        {ownPair ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Сравнение (своя): {ownPair} {" > "} {nameById(comparisons.cmp_own)}
                          </div>
                        ) : null}
                        {oppPair ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Сравнение (чужая): {oppPair} {" > "} {nameById(comparisons.cmp_opp)}
                          </div>
                        ) : null}
                        {crossPair ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Сравнение (своя vs чужая): {crossPair} {" > "} {nameById(comparisons.cmp_cross)}
                          </div>
                        ) : null}
                        {expandedPairs.syn_team_a || expandedPairs.syn_team_b ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Сыгранность (своя): {nameById(expandedPairs.syn_team_a)} +{" "}
                            {nameById(expandedPairs.syn_team_b)}
                          </div>
                        ) : null}
                        {expandedPairs.syn_opp_a || expandedPairs.syn_opp_b ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Сыгранность (чужая): {nameById(expandedPairs.syn_opp_a)} +{" "}
                            {nameById(expandedPairs.syn_opp_b)}
                          </div>
                        ) : null}
                        {expandedPairs.dom_my || expandedPairs.dom_opp_target ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Доминировал: {nameById(expandedPairs.dom_my)} над{" "}
                            {nameById(expandedPairs.dom_opp_target)}
                          </div>
                        ) : null}
                        {expandedPairs.dom_opp || expandedPairs.dom_my_target ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Доминировал (соперник): {nameById(expandedPairs.dom_opp)} над{" "}
                            {nameById(expandedPairs.dom_my_target)}
                          </div>
                        ) : null}
                        {roleVote.player_id || roleVote.role ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Роль: {formatKey(String(roleVote.role || "—"))} {nameById(roleVote.player_id)}
                          </div>
                        ) : null}
                        {fanEntries.length ? (
                          <div className="text-xs text-[var(--text-main)]/60">
                            Фан:{" "}
                            {fanEntries.map(([key, value]) => `${formatKey(key)} > ${nameById(value)}`).join(" • ")}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setFeedbackVotesOpen(false)}
                className="w-full py-3 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {matrixOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={() => {
            setMatrixOpen(false);
            setCellEdit(null);
          }}
        >
          <div
            className="w-full max-w-4xl border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-3xl font-black uppercase italic mb-8 border-b-4 border-[var(--bg-contrast)] pb-3 text-[var(--text-main)]">
              {matrixKind === "synergy" ? "МАТРИЦА СИНЕРГИИ" : "МАТРИЦА ДОМИНАЦИИ"}
            </h2>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "__global__", label: "Глобальная" },
                  { key: venueA, label: venueA },
                  { key: venueB, label: venueB }
                ].map((item) => (
                  <Button
                    key={item.key}
                    size="sm"
                    variant={matrixVenue === item.key ? "default" : "outline"}
                    onClick={() => {
                      setMatrixVenue(item.key);
                      setMatrixSort({ playerId: null, axis: "none", dir: "none" });
                      loadMatrix(matrixKind, item.key);
                      loadInteractionLogs(matrixKind, item.key, interactionLogPlayer);
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-xl border border-[var(--border-main)]/60">
                {matrixLoading ? (
                  <div className="p-3 text-sm text-[var(--text-main)]/60">Загрузка...</div>
                ) : matrixPlayers.length === 0 ? (
                  <div className="p-3 text-sm text-[var(--text-main)]/60">Нет данных</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="sticky left-0 bg-[var(--bg-surface)]/90 px-2 py-2 text-left">Игрок</th>
                        {displayMatrixCols.map((player) => (
                          <th
                            key={player}
                            className={`px-2 py-2 text-left cursor-pointer ${matrixSort.playerId === player && matrixSort.axis === "col" ? "bg-[var(--bg-surface)]/70" : ""}`}
                            onClick={() => toggleMatrixSort(player, "col")}
                          >
                            {displayName(player)}
                            {matrixSortIcon(player, "col")}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayMatrixRows.map((rowPlayer) => (
                        <tr key={rowPlayer} className="border-t border-[var(--border-main)]/60">
                          <td
                            className={`sticky left-0 bg-[var(--bg-surface)]/90 px-2 py-2 font-medium cursor-pointer ${matrixSort.playerId === rowPlayer && matrixSort.axis === "row" ? "bg-[var(--bg-surface)]" : ""}`}
                            onClick={() => toggleMatrixSort(rowPlayer, "row")}
                          >
                            {displayName(rowPlayer)}
                            {matrixSortIcon(rowPlayer, "row")}
                          </td>
                          {displayMatrixCols.map((colPlayer) => {
                            const value = matrixValueByIds.get(`${rowPlayer}_${colPlayer}`) ?? 0;
                            const isDiagonal = rowPlayer === colPlayer;
                            const isHighlighted =
                              (matrixSort.axis === "col" && matrixSort.playerId === colPlayer) ||
                              (matrixSort.axis === "row" && matrixSort.playerId === rowPlayer);
                            return (
                              <td key={`${rowPlayer}-${colPlayer}`} className={`px-2 py-1 ${isHighlighted ? "bg-[var(--bg-surface)]/40" : ""}`}>
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
                                    isDiagonal ? "text-[var(--text-main)]/60" : "hover:bg-[var(--bg-surface)]/70"
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
                <div className="space-y-2 rounded-xl border border-[var(--border-main)]/60 p-3">
                  <div className="text-sm font-semibold">
                    {displayName(cellEdit.a)} {" > "} {displayName(cellEdit.b)}
                  </div>
                  <Input
                    value={cellEdit.value}
                    onChange={(e) =>
                      setCellEdit((prev) => (prev ? { ...prev, value: e.target.value } : prev))
                    }
                    className={modalInputClass}
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
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-main)]/60">
                  Логи изменений
                </div>
                <div className="flex gap-2">
                  <Input
                    value={interactionLogPlayer}
                    onChange={(e) => setInteractionLogPlayer(e.target.value)}
                    placeholder="Игрок ID"
                    className={modalInputClass}
                  />
                  <Button onClick={async () => loadInteractionLogs(matrixKind, matrixVenue, interactionLogPlayer)}>
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
                    Пересчитать
                  </Button>
                </div>
                <div className="max-h-40 space-y-2 overflow-auto">
                  {interactionLogsLatest.length === 0 ? (
                    <div className="text-xs text-[var(--text-main)]/60">Логов нет</div>
                  ) : (
                    interactionLogsLatest.map((log) => (
                      <Card key={log.id}>
                        <CardContent className="space-y-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span>
                              {displayName(log.player_a)} {" > "} {displayName(log.player_b)}
                            </span>
                            <span className="text-[var(--text-main)]/60">
                              {new Date(log.created_at).toLocaleString("ru-RU")}
                            </span>
                          </div>
                          <div className="text-[var(--text-main)]/60">
                            {venueLabel(log.venue)} | {log.kind} | {sourceLabel(log.source)}
                          </div>
                          {feedbackAuthorFromSource(log.source) ? (
                            <div className="text-[var(--text-main)]/60">
                              Автор фидбека: {feedbackAuthorFromSource(log.source)}
                            </div>
                          ) : null}
                          {log.match_id ? (
                            <div className="text-[var(--text-main)]/60">Матч #{log.match_id}</div>
                          ) : null}
                          <div>
                            {log.value_before.toFixed(2)} {" > "} {log.value_after.toFixed(2)}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {rolesOpen ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={() => setRolesOpen(false)}
        >
          <div
            className="w-full max-w-3xl border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b-4 border-[var(--bg-contrast)] pb-3 mb-6">
              <h2 className="text-3xl font-black uppercase italic text-[var(--text-main)]">РОЛИ ИГРОКОВ</h2>
              <button
                type="button"
                onClick={() => setRolesOpen(false)}
                className="h-10 w-10 border-2 border-[var(--border-main)] text-[var(--text-main)] font-black"
              >
                ✕
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto rounded-xl border border-[var(--border-main)]/60">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.12em] text-[var(--text-main)]/60">
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
                      <tr key={player.player_id} className="border-t border-[var(--border-main)]/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium"> {displayName(player.player_id)}</div>
                          <div className="text-[10px] text-[var(--text-main)]/60">ID: {player.player_id}</div>
                        </td>
                        <td className="py-2 pr-3"> {attack.toFixed(2)}</td>
                        <td className="py-2 pr-3"> {defense.toFixed(2)}</td>
                        <td className="py-2 pr-3"> {roleLabel(best.key)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => setRolesOpen(false)}
                className="w-full py-3 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
              >
                ЗАКРЫТЬ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Модалка для TG профилей */}
      {showTgProfiles ? (
        <div
          className="fixed inset-0 z-[100] bg-[var(--bg-page)]/95 flex items-center justify-center p-4"
          onClick={() => setShowTgProfiles(false)}
        >
          <div
            className="w-full max-w-5xl border-4 border-[var(--border-main)] bg-[var(--bg-page)] p-8 shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b-4 border-[var(--bg-contrast)] pb-3 mb-6">
              <div>
                <h2 className="text-3xl font-black uppercase italic text-[var(--text-main)]">
                  УПРАВЛЕНИЕ TELEGRAM ПРОФИЛЯМИ
                </h2>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-main)]/60 mt-2">
                  ПРИВЯЖИТЕ РУЧНЫЕ ПРОФИЛИ К АККАУНТАМ TELEGRAM
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTgProfiles(false)}
                className="h-10 w-10 border-2 border-[var(--border-main)] text-[var(--text-main)] font-black"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[65vh] overflow-auto">
              <div>
                <h3 className="font-black uppercase italic text-sm mb-3 text-[var(--text-main)]">
                  Telegram пользователи ({safeTgUsers.length})
                </h3>
                <div className="space-y-2">
                  {safeTgUsers.length === 0 ? (
                    <div className="text-[var(--text-main)]/60 text-sm">Нет Telegram пользователей</div>
                  ) : (
                    safeTgUsers.map((user) => (
                      <div
                        key={user.tg_id}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedTgUser?.tg_id === user.tg_id
                            ? "border-[var(--border-main)] bg-[var(--bg-surface)]"
                            : "border-[var(--border-main)] hover:bg-[var(--bg-surface)]/70"
                        }`}
                        onClick={() => setSelectedTgUser(user)}
                      >
                        <div className="flex items-center gap-3">
                          {user.tg_avatar ? (
                            <img src={user.tg_avatar} alt={user.tg_name} className="w-10 h-10 rounded-full" />
                          ) : null}
                          <div>
                            <div className="font-black uppercase text-[var(--text-main)]">{user.tg_name}</div>
                            <div className="text-sm text-[var(--text-main)]/60">
                              {user.custom_name || "Нет кастомного имени"}
                            </div>
                            <div className="text-xs text-[var(--text-main)]/60">ID: {user.tg_id}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-black uppercase italic text-sm mb-3 text-[var(--text-main)]">
                  Ручные профили ({safeManualUsers.length})
                </h3>
                <div className="space-y-2">
                  {safeManualUsers.length === 0 ? (
                    <div className="text-[var(--text-main)]/60 text-sm">Нет ручных профилей</div>
                  ) : (
                    safeManualUsers.map((user) => (
                      <div
                        key={user.id}
                        className={`p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                          selectedManualUser?.id === user.id
                            ? "border-[var(--border-main)] bg-[var(--bg-surface)]"
                            : "border-[var(--border-main)] hover:bg-[var(--bg-surface)]/70"
                        }`}
                        onClick={() => setSelectedManualUser(user)}
                      >
                        <div>
                          <div className="font-black uppercase text-[var(--text-main)]">{user.custom_name}</div>
                          <div className="text-xs text-[var(--text-main)]/60">ID: {user.id}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowTgProfiles(false)}
                className="w-full py-3 text-xs font-black uppercase border-2 border-[var(--border-main)] text-[var(--text-main)]"
              >
                ОТМЕНА
              </button>
              <button
                type="button"
                onClick={linkProfiles}
                disabled={!selectedTgUser || !selectedManualUser}
                className="w-full py-3 text-xs font-black uppercase bg-[var(--bg-contrast)] text-[var(--text-contrast)] disabled:opacity-50"
              >
                ПРИВЯЗАТЬ ПРОФИЛИ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}













































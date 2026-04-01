import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Plus,
  Save,
  Trash2,
  Users,
  Crown,
  Shield,
  Search,
  UserPlus,
} from "lucide-react";

import {
  getLobbySettings,
  patchLobbySettings,
  createVenue,
  deleteVenue,
  patchLobbyMember,
  adminListUsers,
  addLobbyMember,
  deleteLobby,
} from "../lib/api";
import type { LobbyConfig, LobbyMember, LobbyVenue, AdminUser } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const ROLE_LABELS: Record<string, string> = {
  admin: "Админ",
  organizer: "Организатор",
  player: "Игрок",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  admin: Crown,
};

export function LobbySettings() {
  const { contextId } = useParams<{ contextId: string }>();
  const navigate = useNavigate();
  const lobbyId = Number(contextId);
  const { me } = useAppContext();

  const [title, setTitle] = useState("");
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState<LobbyConfig | null>(null);
  const [venues, setVenues] = useState<LobbyVenue[]>([]);
  const [members, setMembers] = useState<LobbyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<LobbyMember | null>(null);
  
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getLobbySettings(lobbyId);
      setTitle(data?.context?.title ?? "");
      setPassword(data?.context?.password ?? "");
      setConfig(data?.config ?? null);
      setVenues(data?.venues ?? []);
      setMembers(data?.members ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [lobbyId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await patchLobbySettings(lobbyId, { ...config, title, password });
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  const handleAddVenue = async () => {
    const name = newVenueName.trim();
    if (!name) return;
    try {
      const data = await createVenue(lobbyId, { name });
      setVenues((prev) => [...prev, { id: data?.id ?? 0, name, address: null }]);
      setNewVenueName("");
    } catch {
      /* ignore */
    }
  };

  const handleDeleteVenue = async (venueId: number) => {
    try {
      await deleteVenue(lobbyId, venueId);
      setVenues((prev) => prev.filter((v) => v.id !== venueId));
    } catch {
      /* ignore */
    }
  };

  const handleChangeRole = async (tgId: number, role: string) => {
    try {
      await patchLobbyMember(lobbyId, tgId, { role });
      setMembers(prev => prev.map(m => m.tg_id === tgId ? { ...m, role } : m));
      setRoleDialogOpen(false);
    } catch {
      /* ignore */
    }
  };

  const handleOpenAddMember = async () => {
    setAddMemberOpen(true);
    try {
      const data = await adminListUsers();
      setAllUsers(data?.users ?? []);
    } catch {
       /* ignore */
    }
  };

  const filteredUsers = useMemo(() => {
     const s = userSearch.toLowerCase();
     const memberIds = new Set(members.map(m => m.tg_id));
     return allUsers.filter(u => {
        if (memberIds.has(u.tg_id)) return false;
        const nameMatch = (u.custom_name || u.tg_name || "").toLowerCase().includes(s);
        const idMatch = String(u.tg_id).includes(s);
        return nameMatch || idMatch;
     }).slice(0, 10);
  }, [allUsers, userSearch, members]);

  const handleImportUser = async (tgId: number) => {
     try {
        await addLobbyMember(lobbyId, { tg_id: tgId });
        load();
        setAddMemberOpen(false);
     } catch {
        /* ignore */
     }
  };

  const handleDeleteLobby = async () => {
    if (!window.confirm("Удалить лобби навсегда? Это действие необратимо!")) return;
    setDeleting(true);
    try {
      await deleteLobby(lobbyId);
      navigate("/lobbies");
    } catch (e: any) {
      alert("Ошибка удаления: " + e.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-webfut-pink border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-1 pt-3 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => navigate("/lobbies")}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-gray-400 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-black uppercase tracking-tight text-white leading-none">
            Настройки
          </h1>
          <span className="text-[10px] text-gray-500 font-bold">
             ID: {me?.tg_id || "..."}
          </span>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-webfut-pink/20 text-webfut-pink transition-all hover:bg-webfut-pink/30 active:scale-95 disabled:opacity-50"
        >
          {saving ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-webfut-pink border-t-transparent" />
          ) : (
            <Save className="h-5 w-5" />
          )}
        </button>
      </motion.div>

      {/* Title */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border-2 border-[#333] bg-[#111] p-4 space-y-4"
      >
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Название лобби
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg bg-black/50 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 transition-all focus:ring-webfut-pink"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
            Пароль для входа (опц.)
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Оставь пустым, если вход свободный"
            className="w-full rounded-lg bg-black/50 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 transition-all focus:ring-webfut-pink"
          />
        </div>
      </motion.section>

      {/* Feature Toggles */}
      {config && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border-2 border-[#333] bg-[#111] p-4 space-y-3"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Функции
          </h2>

          <ToggleRow
            label="Платежи"
            description="Трекинг оплаты аренды"
            checked={config.payments_enabled}
            onChange={(v) => setConfig({ ...config, payments_enabled: v })}
          />
          <ToggleRow
            label="Лидерборд"
            description="Таблица лидеров в профиле"
            checked={config.leaderboard_enabled}
            onChange={(v) => setConfig({ ...config, leaderboard_enabled: v })}
          />
          <ToggleRow
            label="Батт-гейм"
            description="Режим «Матч Жоп»"
            checked={config.butt_game_allowed}
            onChange={(v) => setConfig({ ...config, butt_game_allowed: v })}
          />

          <div>
            <label className="mb-1 block text-xs text-gray-400">
              Макс. размер команды
            </label>
            <input
              type="number"
              min={2}
              max={11}
              value={config.max_team_size}
              onChange={(e) =>
                setConfig({
                  ...config,
                  max_team_size: Math.max(2, Math.min(11, Number(e.target.value))),
                })
              }
              className="w-20 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
            />
          </div>
        </motion.section>
      )}

      {/* Save Button */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        disabled={saving}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-webfut-pink bg-webfut-pink/20 py-3 text-sm font-bold text-webfut-pink transition-colors hover:bg-webfut-pink/30 disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Сохранение..." : "Сохранить параметры"}
      </motion.button>

      {/* Venues */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-2xl border-2 border-[#333] bg-[#111] p-4 space-y-3"
      >
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <MapPin className="h-3.5 w-3.5" /> Площадки
        </h2>

        <AnimatePresence mode="popLayout">
          {venues.map((venue) => (
            <motion.div
              key={venue.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-white">
                  {venue.name}
                </span>
                {venue.address && (
                  <span className="ml-2 text-xs text-gray-500">
                    {venue.address}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDeleteVenue(venue.id)}
                className="p-1 text-gray-500 transition-colors hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newVenueName}
            onChange={(e) => setNewVenueName(e.target.value)}
            placeholder="Название площадки"
            className="flex-1 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
            onKeyDown={(e) => e.key === "Enter" && handleAddVenue()}
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleAddVenue}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-webfut-pink/20 text-webfut-pink"
          >
            <Plus className="h-4 w-4" />
          </motion.button>
        </div>
      </motion.section>

      {/* Members */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border-2 border-[#333] bg-[#111] p-4 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            <Users className="h-3.5 w-3.5" /> Участники ({members.length})
          </h2>
          <button
            onClick={handleOpenAddMember}
            className="flex items-center gap-1 rounded-lg bg-webfut-pink/10 px-2 py-1 text-[10px] font-bold text-webfut-pink"
          >
             <Plus className="h-3 w-3" /> Добавить
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto hide-scrollbar">
          {members.map((member) => {
            const Icon = ROLE_ICONS[member.role];
            return (
              <button
                key={member.tg_id}
                onClick={() => {
                   setSelectedMember(member);
                   setRoleDialogOpen(true);
                }}
                className="w-full flex items-center gap-3 rounded-xl bg-black/30 px-3 py-2 text-left transition-colors hover:bg-white/5 active:scale-[0.98]"
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-white/10"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-gray-400">
                    {(member.name ?? "?")[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium text-white">
                    {member.name}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    {Icon && <Icon className="h-2.5 w-2.5 text-webfut-pink" />}
                    {ROLE_LABELS[member.role] ?? member.role}
                  </div>
                </div>
                <div className="text-[10px] text-gray-600 font-bold uppercase">Роль</div>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Global Admin Danger Zone */}
      {me?.is_admin && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border-2 border-red-900/50 bg-[#111] p-4 text-center mt-8"
        >
          <h2 className="text-xs font-semibold uppercase tracking-wider text-red-500 mb-3 block">
            Опасная зона
          </h2>
          <button
            onClick={handleDeleteLobby}
            disabled={deleting}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-500 transition-colors hover:bg-red-500/20 active:scale-[0.98] disabled:opacity-50"
          >
            {deleting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
            ) : (
              <>
                 <Trash2 className="h-4 w-4" /> Удалить лобби (только гл. админ)
              </>
            )}
          </button>
        </motion.section>
      )}

      {/* Role Management Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
         <DialogContent className="bg-[#111] border-[#333] text-white">
            <DialogHeader>
               <DialogTitle>Управление ролью</DialogTitle>
            </DialogHeader>
            {selectedMember && (
               <div className="py-4 space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-black/50">
                     <span className="font-bold text-white uppercase tracking-tight">{selectedMember.name}</span>
                     <span className="text-xs text-gray-500">TG ID: {selectedMember.tg_id}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                     {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <button
                          key={val}
                          onClick={() => handleChangeRole(selectedMember.tg_id, val)}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all active:scale-[0.98] ${
                             selectedMember.role === val ? 'bg-webfut-pink/20 border-webfut-pink text-white' : 'bg-black border-white/5 text-gray-400'
                          }`}
                        >
                           <span className="text-sm font-black uppercase tracking-widest">{label}</span>
                           {selectedMember.role === val && <div className="h-2 w-2 rounded-full bg-webfut-pink" />}
                        </button>
                     ))}
                  </div>
               </div>
            )}
         </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
         <DialogContent className="bg-[#111] border-[#333] text-white">
            <DialogHeader>
               <DialogTitle>Добавить участника</DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-4">
               <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Поиск по имени или ID..."
                    className="w-full rounded-xl bg-black px-10 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
                  />
               </div>
               
               <div className="space-y-2 max-h-60 overflow-y-auto">
                  {filteredUsers.length === 0 ? (
                     <div className="py-8 text-center text-sm text-gray-500 italic">Пользователи не найдены</div>
                  ) : (
                     filteredUsers.map(user => (
                        <button
                          key={user.tg_id}
                          onClick={() => handleImportUser(user.tg_id)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                        >
                           <div className="text-left">
                              <div className="text-sm font-bold text-white uppercase">{user.custom_name || user.tg_name}</div>
                              <div className="text-[10px] text-gray-500">ID: {user.tg_id}</div>
                           </div>
                           <UserPlus className="h-4 w-4 text-webfut-pink" />
                        </button>
                     ))
                  )}
               </div>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Toggle component ────────────────────────────────────────────────────

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2">
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        <p className="text-[10px] text-gray-600 leading-none mt-1">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-webfut-pink" : "bg-white/10"
        }`}
      >
        <motion.div
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}

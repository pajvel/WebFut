import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronRight, Crown, Star, Users, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { fetchLobbies, setDefaultLobby, createLobby, joinLobbyByPass } from "../lib/api";
import { useAppContext } from "../lib/app-context";
import type { Lobby } from "../lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Суперадмин",
  admin: "Админ",
  organizer: "Организатор",
  player: "Игрок",
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: "text-yellow-400",
  admin: "text-webfut-pink",
  organizer: "text-blue-400",
  player: "text-gray-400",
};

export function LobbySelector() {
  const { me } = useAppContext();
  const navigate = useNavigate();
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "join">("join");
  const [newTitle, setNewTitle] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [adminTgId, setAdminTgId] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchLobbies();
      setLobbies(data?.lobbies ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSetDefault = async (lobbyId: number) => {
    try {
      await setDefaultLobby(lobbyId);
      setLobbies((prev) =>
        prev.map((l) => ({ ...l, is_default: l.id === lobbyId }))
      );
    } catch {
      /* ignore */
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      let data;
      if (modalMode === "create") {
         data = await createLobby({ 
            title, 
            password: newPassword,
            admin_tg_id: adminTgId ? Number(adminTgId) : undefined 
         });
      } else {
         data = await joinLobbyByPass({ title, password: newPassword });
      }
      setCreateOpen(false);
      setNewTitle("");
      setNewPassword("");
      setAdminTgId("");
      load();
      if (modalMode === "create" && data?.id) navigate(`/lobbies/${data.id}/settings`);
    } catch (err: any) {
      if (err.status === 403) alert("Неверный пароль или доступ запрещен");
      else if (err.status === 404) alert("Лобби не найдено");
      else if (err.status === 400 && err.data?.error === "title_in_use") alert("Такое название уже занято");
      else alert("Ошибка при выполнении операции");
    } finally {
      setCreating(false);
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
    <div className="space-y-4 px-1 pt-3 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 flex items-start justify-between"
      >
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Мои лобби
          </h1>
          <p className="mt-1 text-sm flex items-center gap-2">
            <span className="text-gray-400">Переключайся между площадками</span>
            <span className="text-[10px] bg-white/10 text-white px-2 py-0.5 rounded-full font-bold">
              ID: {me?.tg_id || "..."}
            </span>
          </p>
        </div>
        {me && (
           <motion.button
             whileTap={{ scale: 0.95 }}
             onClick={() => { setModalMode("join"); setCreateOpen(true); }}
             className="flex h-10 w-10 items-center justify-center rounded-xl bg-webfut-pink text-white shadow-lg"
           >
             <Plus className="h-6 w-6" />
           </motion.button>
        )}
      </motion.div>

      {/* Lobby Cards */}
      <AnimatePresence mode="popLayout">
        {lobbies.map((lobby, idx) => (
          <motion.div
            key={lobby.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: idx * 0.06 }}
            className={`relative overflow-hidden rounded-2xl border-2 p-4 transition-colors ${
              lobby.is_default
                ? "border-webfut-pink bg-webfut-pink/10"
                : "border-[#333] bg-[#111]"
            }`}
          >
            {/* Default star */}
            {lobby.is_default && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute right-3 top-3"
              >
                <Star className="h-5 w-5 fill-webfut-pink text-webfut-pink" />
              </motion.div>
            )}

            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                  lobby.is_default
                    ? "bg-webfut-pink/20"
                    : "bg-white/5"
                }`}
              >
                <Building2
                  className={`h-6 w-6 ${
                    lobby.is_default ? "text-webfut-pink" : "text-gray-400"
                  }`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-white truncate">
                  {lobby.title}
                </h3>
                <div className="mt-1 flex items-center gap-3 text-xs">
                  <span className={ROLE_COLORS[lobby.role] ?? "text-gray-400"}>
                    <Crown className="mr-1 inline h-3 w-3" />
                    {ROLE_LABELS[lobby.role] ?? lobby.role}
                  </span>
                  <span className="text-gray-500">
                    <Users className="mr-1 inline h-3 w-3" />
                    {lobby.member_count}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-2">
              {!lobby.is_default && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSetDefault(lobby.id)}
                  className="rounded-lg bg-webfut-pink/20 px-3 py-1.5 text-xs font-semibold text-webfut-pink transition-colors hover:bg-webfut-pink/30"
                >
                  По умолчанию
                </motion.button>
              )}

              {(lobby.role === "admin" || lobby.role === "super_admin" || me?.is_admin) && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate(`/lobbies/${lobby.id}/settings`)}
                  className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10"
                >
                  Настройки
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(`/matches?lobby=${lobby.id}`)}
                className="ml-auto flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:bg-white/10"
              >
                Матчи
                <ChevronRight className="h-3 w-3" />
              </motion.button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {lobbies.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border-2 border-dashed border-[#333] p-8 text-center"
        >
          <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-600" />
          <p className="text-sm text-gray-400">
            У тебя ещё нет лобби
          </p>
        </motion.div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#111] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>
               {modalMode === "join" ? "Войти в лобби" : "Создать лобби"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 p-1 bg-black/50 rounded-lg mt-2 mb-2">
            <button
               onClick={() => setModalMode("join")}
               className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${modalMode === "join" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
            >
               Войти
            </button>
            {me?.is_admin && (
               <button
                  onClick={() => setModalMode("create")}
                  className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition-colors ${modalMode === "create" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
               >
                  Создать
               </button>
            )}
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Название</label>
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Напр. Московская лига"
                className="w-full rounded-xl bg-black px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Пароль (опционально)</label>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Оставьте пустым, если нет пароля"
                className="w-full rounded-xl bg-black px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            {modalMode === "create" && (
               <div className="space-y-2">
                 <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Telegram ID админа лобби (опционально)</label>
                 <input
                   type="text"
                   value={adminTgId}
                   onChange={(e) => setAdminTgId(e.target.value)}
                   placeholder="ID пользователя, который будет админом"
                   className="w-full rounded-xl bg-black px-4 py-3 text-sm outline-none ring-1 ring-white/10 focus:ring-webfut-pink"
                   onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                 />
                 <p className="text-[10px] text-gray-500 mt-1">Оставь пустым, лобби можно настроить позже.</p>
               </div>
            )}
            <button
              onClick={handleCreate}
              disabled={creating || !newTitle.trim()}
              className="w-full rounded-xl bg-webfut-pink py-3 font-bold text-white shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {creating ? "Ожидание..." : (modalMode === "join" ? "Войти" : "Создать лобби")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

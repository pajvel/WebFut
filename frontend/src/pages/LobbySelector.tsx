import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, ChevronRight, Crown, Star, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { fetchLobbies, setDefaultLobby } from "../lib/api";
import { useAppContext } from "../lib/app-context";
import type { Lobby } from "../lib/types";

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
        className="mb-6"
      >
        <h1 className="text-2xl font-black tracking-tight text-white">
          Мои лобби
        </h1>
        <p className="mt-1 text-sm text-gray-400">
          Переключайся между игровыми площадками
        </p>
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

              {(lobby.role === "admin" || lobby.role === "super_admin") && (
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
    </div>
  );
}

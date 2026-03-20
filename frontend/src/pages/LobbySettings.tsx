import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

import {
  getLobbySettings,
  patchLobbySettings,
  createVenue,
  deleteVenue,
} from "../lib/api";
import type { LobbyConfig, LobbyMember, LobbyVenue } from "../lib/types";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Суперадмин",
  admin: "Админ",
  organizer: "Организатор",
  player: "Игрок",
};

const ROLE_ICONS: Record<string, typeof Crown> = {
  super_admin: Shield,
  admin: Crown,
};

export function LobbySettings() {
  const { contextId } = useParams<{ contextId: string }>();
  const navigate = useNavigate();
  const lobbyId = Number(contextId);

  const [title, setTitle] = useState("");
  const [config, setConfig] = useState<LobbyConfig | null>(null);
  const [venues, setVenues] = useState<LobbyVenue[]>([]);
  const [members, setMembers] = useState<LobbyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getLobbySettings(lobbyId);
      setTitle(data?.context?.title ?? "");
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
      await patchLobbySettings(lobbyId, { ...config, title });
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
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">
            Настройки лобби
          </h1>
        </div>
      </motion.div>

      {/* Title */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border-2 border-[#333] bg-[#111] p-4"
      >
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">
          Название
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg bg-black/50 px-3 py-2 text-sm text-white outline-none ring-1 ring-white/10 transition-all focus:ring-webfut-pink"
        />
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
        {saving ? "Сохранение..." : "Сохранить"}
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
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          <Users className="h-3.5 w-3.5" /> Участники ({members.length})
        </h2>

        <div className="space-y-2 max-h-80 overflow-y-auto hide-scrollbar">
          {members.map((member) => {
            const Icon = ROLE_ICONS[member.role];
            return (
              <div
                key={member.tg_id}
                className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2"
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt=""
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
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
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {Icon && <Icon className="h-3 w-3" />}
                    {ROLE_LABELS[member.role] ?? member.role}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>
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
    <div className="flex items-center justify-between gap-3">
      <div>
        <span className="text-sm font-medium text-white">{label}</span>
        <span className="ml-2 text-xs text-gray-500">{description}</span>
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

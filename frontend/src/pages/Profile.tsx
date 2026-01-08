import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Moon, Pencil, Sun, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getProfile, patchMe, patchSettings, uploadAvatar } from "../lib/api";
import type { ProfileHistoryItem, ProfileStats } from "../lib/types";
import { useAppContext } from "../lib/app-context";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { SettingRow } from "../components/SettingRow";
import { MatchCard } from "../components/MatchCard";
import { formatApiError } from "../lib/errors";
import { resolveMediaUrl } from "../lib/media";
import { useMatText } from "../lib/mode18";

const emptyStats: ProfileStats = {
  matches: 0,
  wins: 0,
  losses: 0,
  goals: 0,
  assists: 0,
  mvp: 0
};

export function Profile() {
  const { me, settings, setTheme, refreshMe } = useAppContext();
  const navigate = useNavigate();
  const t = useMatText();
  const [stats, setStats] = useState<ProfileStats>(emptyStats);
  const [history, setHistory] = useState<ProfileHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarOverride, setAvatarOverride] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getProfile()
      .then((data) => {
        setStats(data?.stats || emptyStats);
        setHistory(data?.history || []);
      })
      .catch((err) => setError(formatApiError(err)));
  }, []);

  useEffect(() => {
    if (editOpen) {
      setDraftName(me?.custom_name || me?.tg_name || "");
      setDraftFile(null);
    }
  }, [editOpen, me?.custom_name, me?.tg_name]);

  const latestHistory = useMemo(() => history.slice(0, 5), [history]);

  const toggle18 = async () => {
    if (!settings) return;
    const next = !settings.mode_18plus;
    await patchSettings({ mode_18plus: next });
    refreshMe();
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      let uploadedUrl: string | null = null;
      const nextName = draftName.trim();
      const hasCustomName = Boolean(me?.custom_name);
      if (draftFile) {
        const result = await uploadAvatar(draftFile);
        uploadedUrl = result?.url || null;
      }
      if ((nextName && nextName !== (me?.custom_name || me?.tg_name)) || (!nextName && hasCustomName)) {
        await patchMe({ custom_name: nextName || null });
      }
      if (uploadedUrl) {
        setAvatarOverride(resolveMediaUrl(uploadedUrl));
      }
      await refreshMe();
      setEditOpen(false);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border border-border">
            {avatarOverride || me?.custom_avatar || me?.tg_avatar ? (
              <AvatarImage
                src={avatarOverride || resolveMediaUrl(me?.custom_avatar || me?.tg_avatar || "")}
              />
            ) : null}
            <AvatarFallback>{me?.tg_name?.slice(0, 2).toUpperCase() || "ME"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">
              {me?.custom_name || me?.tg_name}
            </div>
            <div className="truncate text-xs text-muted-foreground">ID: {me?.tg_id}</div>
          </div>
          <div className="flex items-center gap-2">
            {me?.is_admin ? (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Crown className="h-4 w-4" />
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? <div className="text-xs text-destructive">{t(error)}</div> : null}
      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">{t("Статистика")}</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Матчи", value: stats.matches },
              { label: "Победы", value: stats.wins },
              { label: "Поражения", value: stats.losses },
              { label: "Голы", value: stats.goals },
              { label: "Ассисты", value: stats.assists },
              { label: "MVP", value: stats.mvp }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-border/60 bg-card/80 p-3">
                <div className="text-lg font-semibold">{item.value}</div>
                <div className="text-xs text-muted-foreground">{t(item.label)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">{t("Настройки")}</div>
          <div className="space-y-2">
            <SettingRow
              title={t("Тема")}
              description={settings?.theme === "dark" ? t("Темная") : t("Светлая")}
              icon={settings?.theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              onClick={() => setTheme(settings?.theme === "dark" ? "light" : "dark")}
            />
            <SettingRow
              title={t("18+ режим")}
              description={settings?.mode_18plus ? t("Включен") : t("Выключен")}
              icon={<Trophy className="h-4 w-4" />}
              onClick={toggle18}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="text-sm font-semibold">{t("История матчей")}</div>
        <div className="space-y-3">
          {latestHistory.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t("Пока нет матчей")}</div>
          ) : (
            latestHistory.map((match) => <MatchCard key={match.id} match={match} />)
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Профиль")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-xs">
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={t("Имя")}
                className="text-center"
              />
            </div>
            <div className="mx-auto w-full max-w-xs">
              <div className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {t("Смена аватарки")}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => setDraftFile(event.target.files?.[0] || null)}
              />
              <div className="flex flex-col items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Выбрать файл
                </Button>
                <div className="text-xs text-muted-foreground">
                  {draftFile?.name || t("Файл не выбран")}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveProfile} disabled={saving}>
                Сохранить
              </Button>
              <Button variant="secondary" className="flex-1" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

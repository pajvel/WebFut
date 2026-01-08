import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Calendar, MapPin } from "lucide-react";

import {
  getMatch,
  joinMatch,
  leaveMatch,
  payerClear,
  payerOffer,
  payerRequest,
  payerRespond,
  payerSelect,
  spectateMatch
} from "../lib/api";
import { formatApiError } from "../lib/errors";
import type { MatchDetail, MatchMember } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { StatusCard } from "../components/StatusCard";
import { resolveMediaUrl } from "../lib/media";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { useMatText } from "../lib/mode18";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function MatchLobby() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const t = useMatText();
  const [data, setData] = useState<MatchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [payerDismissed, setPayerDismissed] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);

  const load = () => {
    if (!matchId) return;
    getMatch(Number(matchId))
      .then(setData)
      .catch((err) => setError(formatApiError(err)));
  };

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    const tick = () => {
      if (!alive) return;
      if (document.visibilityState !== "visible") return;
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select" || active.isContentEditable) {
          return;
        }
      }
      getMatch(Number(matchId))
        .then((result) => {
          if (alive) setData(result);
        })
        .catch((err) => setError(formatApiError(err)));
    };
    tick();
    const interval = window.setInterval(tick, 2000);
    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [matchId]);

  useEffect(() => {
    if (!data) return;
    const currentPayer = data.payments?.payer;
    if (!currentPayer || !currentPayer.payer_tg_id) {
      setPayerDismissed(false);
    }
  }, [data]);

  const myRole = useMemo(() => {
    if (!data) return null;
    return data.members.find((m) => m.tg_id === data.me.tg_id)?.role ?? null;
  }, [data]);
  const myMember = useMemo(
    () => data?.members.find((member) => member.tg_id === data?.me.tg_id) || null,
    [data]
  );

  const canManageTeams = useMemo(() => {
    if (!data) return false;
    return data.me.is_admin || myRole === "organizer";
  }, [data, myRole]);
  const canPayerAction = !!(data && (myMember?.role === "organizer" || myMember?.can_edit || data.me.is_admin));
  const isOrganizer = !!(data && (data.me.is_admin || myMember?.role === "organizer"));
  const payerInfo = data?.payments?.payer || null;
  const hasPayer = !!(payerInfo && payerInfo.payer_tg_id);
  const payerRequests = data?.payments?.requests || [];
  const hasRequested = !!(
    data && payerRequests.some((req) => req.tg_id === data.me.tg_id && req.status === "pending")
  );
  const isPayer = !!(payerInfo && payerInfo.payer_tg_id === data?.me.tg_id);
  const offerForMe = useMemo(
    () => payerRequests.find((req) => req.tg_id === data?.me.tg_id && req.status === "offered") || null,
    [payerRequests, data]
  );
  const offeredRequest = useMemo(
    () => payerRequests.find((req) => req.status === "offered") || null,
    [payerRequests]
  );
  const pendingRequests = useMemo(
    () => payerRequests.filter((req) => req.status === "pending"),
    [payerRequests]
  );

  const handleJoin = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await joinMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleSpectate = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await spectateMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  const handleLeave = async () => {
    if (!matchId) return;
    setError(null);
    try {
      await leaveMatch(Number(matchId));
      load();
    } catch (err) {
      setError(formatApiError(err));
    }
  };

  if (error) {
    return <StatusCard title={t("Ошибка")} message={error} />;
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">{t("Загрузка...")}</div>;
  }

  if (data.match.status === "finished") {
    return <Navigate to={`/matches/${data.match.id}/finished`} replace />;
  }
  if (data.match.status === "live") {
    return <Navigate to={`/matches/${data.match.id}/live`} replace />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div className="text-xl font-semibold">
            {t("Матч")} #{data.match.id}
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(data.match.scheduled_at || data.match.created_at)}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {data.match.venue}
            </div>
          </div>
          <div className={`grid gap-2 ${data.match.status === "created" && !canManageTeams ? "grid-cols-1" : "grid-cols-2"}`}>
            {myRole ? (
              <Button onClick={handleLeave} variant="secondary">
                Выйти из матча
              </Button>
            ) : (
              <Button onClick={() => setJoinOpen(true)} variant="secondary">
                Присоединиться
              </Button>
            )}
            {canManageTeams ? (
              <Button onClick={() => navigate(`/matches/${data.match.id}/teams`)}>
                Создать команды
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {offerForMe && !hasPayer ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">{t("Вас предложили плательщиком")}</div>
            <div className="text-xs text-muted-foreground">
              {t("Организатор предлагает вам оплатить матч. Согласны?")}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await payerRespond(Number(matchId), true);
                    load();
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
              >
                Да
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={async () => {
                  if (!matchId) return;
                  try {
                    await payerRespond(Number(matchId), false);
                    load();
                  } catch (err) {
                    setError(formatApiError(err));
                  }
                }}
              >
                Нет
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : canPayerAction && !hasPayer && !payerDismissed ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">{t("Стать плательщиком?")}</div>
            <div className="text-xs text-muted-foreground">
              {t("Плательщик оплачивает матч и подтверждает оплаты.")}
            </div>
            {offeredRequest ? (
              <div className="text-xs text-muted-foreground">
                {t("Предложено")}:{" "}
                {data.members.find((m) => m.tg_id === offeredRequest.tg_id)?.name || offeredRequest.tg_id}
              </div>
            ) : null}
            {hasRequested ? (
              <div className="text-xs text-muted-foreground">{t("Заявка отправлена")}</div>
            ) : (
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={async () => {
                    if (!matchId || !data) return;
                    try {
                      if (isOrganizer) {
                        await payerSelect(Number(matchId), data.me.tg_id);
                      } else {
                        await payerRequest(Number(matchId));
                      }
                      load();
                    } catch (err) {
                      setError(formatApiError(err));
                    }
                  }}
                >
                  Да
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    if (isOrganizer) {
                      setOfferOpen(true);
                    } else {
                      setPayerDismissed(true);
                    }
                  }}
                >
                  Нет
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {isOrganizer && pendingRequests.length > 0 && !hasPayer ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">{t("Запросы стать плательщиком")}</div>
            <div className="space-y-2">
              {pendingRequests.map((req) => {
                const member = data?.members.find((m) => m.tg_id === req.tg_id);
                return (
                  <div
                    key={req.tg_id}
                    className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
                  >
                    <span>{member?.name || req.tg_id}</span>
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!matchId) return;
                        try {
                          await payerSelect(Number(matchId), req.tg_id);
                          load();
                        } catch (err) {
                          setError(formatApiError(err));
                        }
                      }}
                    >
                      Назначить
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {hasPayer && isPayer ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="text-sm font-semibold">{t("Вы плательщик матча")}</div>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!matchId) return;
                try {
                  await payerClear(Number(matchId));
                  setPayerDismissed(false);
                  load();
                } catch (err) {
                  setError(formatApiError(err));
                }
              }}
            >
              Перестать быть плательщиком
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("Игроки")}
        </div>
        <div className="space-y-3">
          {data.members.map((member: MatchMember) => (
            <div
              key={member.tg_id}
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 border border-border">
                  {member.avatar ? <AvatarImage src={resolveMediaUrl(member.avatar)} /> : null}
                  <AvatarFallback>{member.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{member.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{member.role}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {payerInfo?.payer_tg_id === member.tg_id ? (
                  <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold">
                    $ {t("Плательщик")}
                  </span>
                ) : null}
                {offeredRequest?.tg_id === member.tg_id ? (
                  <span className="rounded-full bg-secondary/20 px-3 py-1 text-xs font-semibold">
                    {t("Предложено")}
                  </span>
                ) : null}
                {member.can_edit ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold">
                    {t("Редактор")}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Как присоединиться?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={async () => {
                await handleJoin();
                setJoinOpen(false);
              }}
            >
              Я игрок
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              onClick={async () => {
                await handleSpectate();
                setJoinOpen(false);
              }}
            >
              Я зритель
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Кому предложить оплату?")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {data.members.filter((member) => member.role !== "spectator").map((member) => (
              <div
                key={member.tg_id}
                className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2 text-sm"
              >
                <span>{member.name}</span>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (!matchId) return;
                    try {
                      await payerOffer(Number(matchId), member.tg_id);
                      setOfferOpen(false);
                      load();
                    } catch (err) {
                      setError(formatApiError(err));
                    }
                  }}
                >
                  Предложить
                </Button>
              </div>
            ))}
          </div>
          {offeredRequest ? (
            <div className="text-xs text-muted-foreground">
              {t("Предложено")}:{" "}
              {data.members.find((m) => m.tg_id === offeredRequest.tg_id)?.name || offeredRequest.tg_id}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import BracketBoard, {
  type BracketColumnDefinition,
} from "./components/BracketBoard";
import GroupCard from "./components/GroupCard";
import {
  CheckIcon,
  EditIcon,
  LockIcon,
  LogOutIcon,
  RefreshIcon,
  SwordsIcon,
  TrophyIcon,
  UsersIcon,
  XIcon,
} from "./components/Icons";
import LoginModal from "./components/LoginModal";
import Podium from "./components/Podium";
import SettingsModal from "./components/SettingsModal";
import VotePanel from "./components/VotePanel";
import {
  ApiError,
  castVote,
  getDashboard,
  login,
  logout,
  resetVotes as resetAllVotes,
  saveTournament,
  type DashboardResponse,
} from "./lib/api";
import {
  BRACKET_MATCH_IDS,
  GROUP_IDS,
  applyPlayerDrop,
  buildTournamentSnapshot,
  getPlayerDropTargets,
  getStageProgress,
  setMatchWinner,
} from "./lib/bracket";
import type { TournamentState } from "./types";

interface ActiveDrag {
  playerId: string;
  playerName: string;
  fromMatchId: string;
}

interface ToastState {
  id: number;
  kind: "success" | "error" | "warning";
  message: string;
}

const lastChanceColumns: BracketColumnDefinition[] = [
  {
    title: "Полуфиналы",
    subtitle: "Вторые места групп · BO1",
    matchIds: [
      BRACKET_MATCH_IDS.lastChanceSemi1,
      BRACKET_MATCH_IDS.lastChanceSemi2,
    ],
  },
  {
    title: "Финал",
    subtitle: "Путёвка в нижнюю сетку · BO1",
    matchIds: [BRACKET_MATCH_IDS.lastChanceFinal],
    finalIds: [BRACKET_MATCH_IDS.lastChanceFinal],
  },
];

const playoffColumns: BracketColumnDefinition[] = [
  {
    title: "Четвертьфиналы",
    subtitle: "Победители групп · BO3",
    matchIds: [
      BRACKET_MATCH_IDS.playoffQuarter1,
      BRACKET_MATCH_IDS.playoffQuarter2,
    ],
  },
  {
    title: "Верхний финал",
    subtitle: "Победитель — в гранд-финал",
    matchIds: [BRACKET_MATCH_IDS.upperFinal],
  },
  {
    title: "Нижний финал",
    subtitle: "Последний шанс · BO3",
    matchIds: [BRACKET_MATCH_IDS.lowerFinal],
  },
  {
    title: "Гранд-финал",
    subtitle: "Матч за первое место · BO3",
    matchIds: [BRACKET_MATCH_IDS.grandFinal],
    finalIds: [BRACKET_MATCH_IDS.grandFinal],
  },
];

function formattedTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "только что";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStageLabel(state: TournamentState): string {
  const overall = buildTournamentSnapshot(state).progress;
  if (overall.status === "complete") {
    return "Турнир завершён";
  }
  if (overall.status === "not-started") {
    return "Ожидает первого матча";
  }
  if (getStageProgress(state, "group").status !== "complete") {
    return "Групповой этап";
  }
  if (getStageProgress(state, "last-chance").status !== "complete") {
    return "Сетка последнего шанса";
  }
  return "Плей-офф";
}

function LoadingScreen() {
  return (
    <div className="app-shell">
      <div className="site-header-wrap">
        <header className="site-header">
          <div className="brand">
            <span className="brand-mark" />
            <div className="brand-copy">
              <p className="brand-title">Турнир CS2 1×1</p>
              <p className="brand-subtitle">Загружаем сетку</p>
            </div>
          </div>
          <span className="status-pill">Синхронизация</span>
        </header>
      </div>
      <main className="app-main">
        <div className="loading-panel" aria-live="polite">
          <span className="loading-spinner" />
          <h1>Подключаем турнир</h1>
          <p>Забираем актуальную сетку и голоса зрителей…</p>
        </div>
      </main>
    </div>
  );
}

function SetupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="app-shell">
      <main className="setup-error">
        <span className="brand-mark setup-error__mark" />
        <p className="eyebrow">Сайт собран, но API недоступен</p>
        <h1>Не удалось загрузить турнир</h1>
        <p>{message}</p>
        <p className="setup-error__hint">
          Для локального запуска используйте <code>npm run dev</code>. На
          Netlify задайте переменные <code>ADMIN_PIN</code> и{" "}
          <code>SESSION_SECRET</code>.
        </p>
        <button type="button" className="btn" onClick={onRetry}>
          <RefreshIcon />
          Повторить
        </button>
      </main>
    </div>
  );
}

export default function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loadError, setLoadError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [validDropIds, setValidDropIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastCounter = useRef(0);
  const busyRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 7 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const showToast = useCallback(
    (message: string, kind: ToastState["kind"] = "success") => {
      toastCounter.current += 1;
      setToast({ id: toastCounter.current, message, kind });
    },
    [],
  );

  useEffect(() => {
    if (!toast) {
      return;
    }
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) {
      setLoadError("");
    } else {
      setIsRefreshing(true);
    }

    try {
      const next = await getDashboard();
      setDashboard((current) => {
        if (!current || next.state.version >= current.state.version) {
          return next;
        }
        return {
          ...current,
          votes: next.votes,
          isAdmin: next.isAdmin,
        };
      });
      setLoadError("");
    } catch (error) {
      if (!quiet) {
        setLoadError(
          error instanceof Error ? error.message : "Неизвестная ошибка",
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (
        !busyRef.current &&
        !showLogin &&
        !showSettings &&
        document.visibilityState === "visible"
      ) {
        void load(true);
      }
    }, 5000);

    return () => window.clearInterval(interval);
  }, [load, showLogin, showSettings]);

  const snapshot = useMemo(
    () => (dashboard ? buildTournamentSnapshot(dashboard.state) : null),
    [dashboard],
  );

  const commitState = useCallback(
    async (nextState: TournamentState, successMessage: string) => {
      if (!dashboard || busyRef.current) {
        return false;
      }

      const previous = dashboard;
      busyRef.current = true;
      setIsBusy(true);
      setDashboard({ ...dashboard, state: nextState });

      try {
        const response = await saveTournament(nextState);
        setDashboard(response);
        showToast(successMessage);
        return true;
      } catch (error) {
        setDashboard(previous);

        if (error instanceof ApiError && error.status === 409) {
          await load(true);
          showToast(
            "Сетка уже изменилась в другой вкладке — данные обновлены",
            "warning",
          );
        } else {
          showToast(
            error instanceof Error ? error.message : "Не удалось сохранить",
            "error",
          );
        }
        return false;
      } finally {
        busyRef.current = false;
        setIsBusy(false);
      }
    },
    [dashboard, load, showToast],
  );

  const chooseWinner = useCallback(
    async (matchId: string, playerId: string) => {
      if (!dashboard?.isAdmin || busyRef.current) {
        return;
      }

      const currentState = dashboard.state;
      if (currentState.winners[matchId] === playerId) {
        return;
      }

      let nextState: TournamentState;
      try {
        nextState = setMatchWinner(currentState, matchId, playerId);
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Матч ещё не готов",
          "error",
        );
        return;
      }

      const invalidated = Object.keys(currentState.winners).filter(
        (id) => id !== matchId && nextState.winners[id] !== currentState.winners[id],
      );
      if (
        invalidated.length > 0 &&
        !window.confirm(
          `Этот выбор сбросит ${invalidated.length} зависим${
            invalidated.length === 1 ? "ый результат" : "ых результата"
          }. Продолжить?`,
        )
      ) {
        return;
      }

      const playerName =
        currentState.players.find((player) => player.id === playerId)?.name ??
        "Игрок";
      await commitState(nextState, `${playerName} продвинут по сетке`);
    },
    [commitState, dashboard, showToast],
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (!dashboard?.isAdmin) {
        return;
      }
      const data = event.active.data.current as ActiveDrag | undefined;
      if (!data?.playerId || !data.fromMatchId) {
        return;
      }

      setActiveDrag(data);
      const targets = getPlayerDropTargets(
        dashboard.state,
        data.playerId,
        data.fromMatchId,
      );
      const ids = new Set(targets.map((target) => target.toMatchId));
      if (data.fromMatchId === BRACKET_MATCH_IDS.grandFinal) {
        ids.add("podium");
      }
      setValidDropIds(ids);
    },
    [dashboard],
  );

  const clearDrag = useCallback(() => {
    setActiveDrag(null);
    setValidDropIds(new Set());
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const data = event.active.data.current as ActiveDrag | undefined;
      const targetId = event.over?.id ? String(event.over.id) : "";
      clearDrag();

      if (!dashboard?.isAdmin || !data || !targetId) {
        return;
      }

      if (
        targetId === "podium" &&
        data.fromMatchId === BRACKET_MATCH_IDS.grandFinal
      ) {
        await chooseWinner(data.fromMatchId, data.playerId);
        return;
      }

      try {
        const next = applyPlayerDrop(
          dashboard.state,
          data.playerId,
          targetId,
        );
        const changedMatch = Object.keys(next.winners).find(
          (id) => next.winners[id] !== dashboard.state.winners[id],
        );
        if (!changedMatch) {
          return;
        }
        await chooseWinner(changedMatch, next.winners[changedMatch]);
      } catch {
        showToast("Этого игрока нельзя перенести в выбранный матч", "warning");
      }
    },
    [chooseWinner, clearDrag, dashboard, showToast],
  );

  const handleLogin = useCallback(
    async (pin: string) => {
      setLoginError("");
      setIsBusy(true);
      busyRef.current = true;
      try {
        const response = await login(pin);
        setDashboard(response);
        setShowLogin(false);
        showToast("Режим организатора включён");
      } catch (error) {
        setLoginError(
          error instanceof Error ? error.message : "Не удалось войти",
        );
      } finally {
        setIsBusy(false);
        busyRef.current = false;
      }
    },
    [showToast],
  );

  const handleLogout = useCallback(async () => {
    setIsBusy(true);
    busyRef.current = true;
    try {
      await logout();
      setDashboard((current) =>
        current ? { ...current, isAdmin: false } : current,
      );
      showToast("Вы снова в гостевом режиме");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Не удалось выйти",
        "error",
      );
    } finally {
      setIsBusy(false);
      busyRef.current = false;
    }
  }, [showToast]);

  const handleVote = useCallback(
    async (playerId: string) => {
      if (busyRef.current) {
        return;
      }
      setIsBusy(true);
      busyRef.current = true;
      try {
        const response = await castVote(playerId);
        setDashboard(response);
        const player = response.state.players.find(
          (item) => item.id === playerId,
        );
        showToast(`Голос за ${player?.name ?? "игрока"} принят`);
      } catch (error) {
        if (error instanceof ApiError && error.code === "ALREADY_VOTED") {
          await load(true);
          showToast("С этого устройства уже голосовали", "warning");
        } else {
          showToast(
            error instanceof Error ? error.message : "Не удалось проголосовать",
            "error",
          );
        }
      } finally {
        setIsBusy(false);
        busyRef.current = false;
      }
    },
    [load, showToast],
  );

  const handleSettingsSave = useCallback(
    async ({
      state,
      resetVotes,
    }: {
      state: TournamentState;
      resetVotes: boolean;
    }) => {
      const saved = await commitState(state, "Настройки турнира сохранены");
      if (!saved) {
        return;
      }

      if (resetVotes) {
        setIsBusy(true);
        busyRef.current = true;
        try {
          const response = await resetAllVotes();
          setDashboard(response);
          showToast("Сетка и голоса готовы к новому турниру");
        } catch (error) {
          showToast(
            `Сетка сохранена, но голоса не сброшены: ${
              error instanceof Error ? error.message : "ошибка"
            }`,
            "warning",
          );
        } finally {
          setIsBusy(false);
          busyRef.current = false;
        }
      }
      setShowSettings(false);
    },
    [commitState, showToast],
  );

  if (!dashboard && !loadError) {
    return <LoadingScreen />;
  }

  if (!dashboard) {
    return <SetupError message={loadError} onRetry={() => void load()} />;
  }

  if (!snapshot) {
    return null;
  }

  const stageLabel = getStageLabel(dashboard.state);
  const lastUpdated = formattedTime(dashboard.state.updatedAt);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={clearDrag}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      <div className="app-shell">
        <a className="skip-link" href="#content">
          Перейти к сетке
        </a>

        <div className="site-header-wrap">
          <header className="site-header">
            <a className="brand" href="#top" aria-label="В начало страницы">
              <span className="brand-mark" />
              <span className="brand-copy">
                <span className="brand-title">Турнир CS2 1×1</span>
                <span className="brand-subtitle">{stageLabel}</span>
              </span>
            </a>
            <div className="header-actions">
              {dashboard.isAdmin ? (
                <>
                  <span className="admin-badge">Организатор</span>
                  <button
                    type="button"
                    className="btn btn--ghost header-logout"
                    onClick={() => void handleLogout()}
                    disabled={isBusy}
                  >
                    <LogOutIcon />
                    <span>Выйти</span>
                  </button>
                </>
              ) : (
                <>
                  <span className="guest-pill">Гость</span>
                  <button
                    type="button"
                    className="login-button"
                    onClick={() => {
                      setLoginError("");
                      setShowLogin(true);
                    }}
                  >
                    <LockIcon />
                    <span>Войти</span>
                  </button>
                </>
              )}
            </div>
          </header>
        </div>

        <main id="content" className="app-main">
          <section className="hero" id="top">
            <p className="hero-kicker">Community championship · Season 01</p>
            <h1 className="hero-title">{dashboard.state.title}</h1>
            <p className="hero-subtitle">
              Четыре GSL‑группы, сетка последнего шанса и плей‑офф до
              гранд‑финала. Следи за матчами и голосуй за будущего чемпиона.
            </p>
            <div className="hero-progress" aria-label={`Прогресс ${snapshot.progress.percent}%`}>
              <span
                className="hero-progress__ring"
                style={{
                  "--progress": `${snapshot.progress.percent * 3.6}deg`,
                } as React.CSSProperties}
              >
                <strong>{snapshot.progress.percent}%</strong>
              </span>
              <span>
                {snapshot.progress.completed} из {snapshot.progress.total}{" "}
                матчей завершено
              </span>
            </div>
          </section>

          <section className="stats-strip" aria-label="Параметры турнира">
            <div className="stat-item">
              <strong className="stat-value">16</strong>
              <span className="stat-label">Игроков</span>
            </div>
            <div className="stat-item">
              <strong className="stat-value">4 × 4</strong>
              <span className="stat-label">Группы</span>
            </div>
            <div className="stat-item">
              <strong className="stat-value">BO1</strong>
              <span className="stat-label">Групповой этап</span>
            </div>
            <div className="stat-item">
              <strong className="stat-value">BO3</strong>
              <span className="stat-label">Плей-офф</span>
            </div>
            <div className="stat-item">
              <strong className="stat-value">{dashboard.votes.total}</strong>
              <span className="stat-label">Голосов</span>
            </div>
          </section>

          {dashboard.isAdmin ? (
            <aside className="admin-toolbar admin-toolbar--inline">
              <div className="admin-toolbar__copy">
                <p className="admin-toolbar__title">
                  Режим организатора включён
                </p>
                <p className="admin-toolbar__hint">
                  Перетащи игрока в следующий матч или нажми кубок рядом с его
                  именем. Сохранено в {lastUpdated}.
                </p>
              </div>
              <div className="admin-toolbar__actions">
                <span
                  className={`sync-state ${isBusy || isRefreshing ? "is-syncing" : ""}`}
                >
                  {isBusy || isRefreshing ? "Синхронизация…" : "Сохранено"}
                </span>
                <button
                  type="button"
                  className="admin-action"
                  onClick={() => setShowSettings(true)}
                >
                  <EditIcon />
                  Настройки
                </button>
              </div>
            </aside>
          ) : null}

          <nav className="tabs-wrap" aria-label="Разделы турнира">
            <div className="tabs">
              <a className="tab" href="#groups">
                Группы
              </a>
              <a className="tab" href="#last-chance">
                Последний шанс
              </a>
              <a className="tab" href="#playoff">
                Плей-офф
              </a>
              <a className="tab" href="#voting">
                Голосование
              </a>
            </div>
          </nav>

          <div className="stack">
            <section className="section-card" id="groups">
              <header className="section-header">
                <div>
                  <p className="section-kicker">Этап 01 · BO1</p>
                  <h2 className="section-heading">Групповой этап</h2>
                  <p className="section-description">
                    Победитель группы сразу выходит в плей‑офф. Второе место
                    получает ещё один шанс.
                  </p>
                </div>
                <UsersIcon className="section-icon" width={34} height={34} />
              </header>
              <div className="groups-grid">
                {GROUP_IDS.map((group) => (
                  <GroupCard
                    key={group}
                    group={group}
                    state={dashboard.state}
                    matches={snapshot.matches}
                    standings={snapshot.groups[group]}
                    isAdmin={dashboard.isAdmin}
                    validDropIds={validDropIds}
                    onChooseWinner={(matchId, playerId) =>
                      void chooseWinner(matchId, playerId)
                    }
                  />
                ))}
              </div>
              <div className="stage-transfer">
                <div className="stage-transfer__item stage-transfer__item--green">
                  <TrophyIcon />
                  <span>
                    <strong>4 победителя групп</strong>
                    сразу проходят в плей‑офф
                  </span>
                </div>
                <div className="stage-transfer__item stage-transfer__item--gold">
                  <RefreshIcon />
                  <span>
                    <strong>4 вторых места</strong>
                    переходят в сетку последнего шанса
                  </span>
                </div>
              </div>
            </section>

            <section className="section-card" id="last-chance">
              <header className="section-header">
                <div>
                  <p className="section-kicker">Этап 02 · BO1</p>
                  <h2 className="section-heading">Сетка последнего шанса</h2>
                  <p className="section-description">
                    Один из четырёх игроков вернётся в борьбу через нижний
                    финал плей‑офф.
                  </p>
                </div>
                <RefreshIcon className="section-icon" width={34} height={34} />
              </header>
              <BracketBoard
                columns={lastChanceColumns}
                matches={snapshot.matches}
                isAdmin={dashboard.isAdmin}
                validDropIds={validDropIds}
                onChooseWinner={(matchId, playerId) =>
                  void chooseWinner(matchId, playerId)
                }
              />
            </section>

            <section className="section-card section-card--gold" id="playoff">
              <header className="section-header">
                <div>
                  <p className="section-kicker">Этап 03 · BO3</p>
                  <h2 className="section-heading section-heading--gold">
                    Плей-офф
                  </h2>
                  <p className="section-description">
                    Верхняя и нижняя траектории сходятся в матче за чемпионство.
                  </p>
                </div>
                <SwordsIcon className="section-icon" width={36} height={36} />
              </header>
              <BracketBoard
                columns={playoffColumns}
                matches={snapshot.matches}
                isAdmin={dashboard.isAdmin}
                validDropIds={validDropIds}
                onChooseWinner={(matchId, playerId) =>
                  void chooseWinner(matchId, playerId)
                }
              />

              <div className="podium-heading">
                <p className="section-kicker">Итоговое распределение</p>
                <h3>Пьедестал турнира</h3>
              </div>
              <Podium
                placements={snapshot.placements}
                isDropTarget={validDropIds.has("podium")}
              />
            </section>

            <section className="section-card" id="voting">
              <header className="section-header">
                <div>
                  <p className="section-kicker">Прогноз зрителей</p>
                  <h2 className="section-heading">Кто станет чемпионом?</h2>
                  <p className="section-description">
                    Выбери одного игрока. Результаты обновляются автоматически
                    для всех друзей.
                  </p>
                </div>
                <TrophyIcon className="section-icon" width={36} height={36} />
              </header>
              <VotePanel
                players={dashboard.state.players}
                votes={dashboard.votes}
                busy={isBusy}
                onVote={handleVote}
              />
            </section>
          </div>

          <footer className="site-footer">
            <span>CS2 Friends Tournament</span>
            <span>
              Сетка обновлена в {lastUpdated} · данные синхронизируются каждые 5
              секунд
            </span>
          </footer>
        </main>

        {showLogin ? (
          <LoginModal
            busy={isBusy}
            error={loginError}
            onClose={() => setShowLogin(false)}
            onSubmit={handleLogin}
          />
        ) : null}
        {showSettings ? (
          <SettingsModal
            state={dashboard.state}
            busy={isBusy}
            onClose={() => setShowSettings(false)}
            onSave={handleSettingsSave}
          />
        ) : null}

        <div className="toast-region" aria-live="polite" aria-atomic="true">
          {toast ? (
            <div className={`toast toast--${toast.kind}`} key={toast.id}>
              <span className="toast__icon">
                {toast.kind === "success" ? (
                  <CheckIcon />
                ) : toast.kind === "warning" ? (
                  <RefreshIcon />
                ) : (
                  <XIcon />
                )}
              </span>
              <span className="toast__message">{toast.message}</span>
              <button
                type="button"
                className="toast__close"
                aria-label="Закрыть уведомление"
                onClick={() => setToast(null)}
              >
                <XIcon width={16} height={16} />
              </button>
            </div>
          ) : null}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDrag ? (
            <div className="drag-overlay-card">
              <span className="player-avatar">
                {activeDrag.playerName.slice(0, 1).toUpperCase()}
              </span>
              <strong>{activeDrag.playerName}</strong>
              <span>перенести</span>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

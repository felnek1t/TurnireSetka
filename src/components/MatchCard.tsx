import { useDraggable, useDroppable } from "@dnd-kit/core";
import { useCallback, type CSSProperties } from "react";
import {
  getBracketEntrantDropId,
  getMatch,
  isBracketEntrantSlot,
  TOURNAMENT_MAPS,
} from "../lib/bracket";
import type {
  MatchSettings,
  ParticipantSource,
  Player,
  ResolvedMatch,
  TournamentMap,
} from "../types";
import { CheckIcon, GripIcon, TrophyIcon } from "./Icons";

interface MatchCardProps {
  match: ResolvedMatch;
  settings: MatchSettings;
  isAdmin: boolean;
  settingsPending?: boolean;
  validDropTarget?: boolean;
  isFinal?: boolean;
  compact?: boolean;
  shuffleMode?: boolean;
  validShuffleDropIds?: ReadonlySet<string>;
  onChooseWinner: (matchId: string, playerId: string) => void;
  onSetMap: (matchId: string, map: TournamentMap | null) => void;
  onSetCtPlayer: (matchId: string, playerId: string | null) => void;
}

interface PlayerLineProps {
  match: ResolvedMatch;
  player: Player | null;
  source: ParticipantSource;
  slot: 0 | 1;
  isAdmin: boolean;
  compact: boolean;
  ctPlayerId?: string;
  settingsPending: boolean;
  shuffleMode: boolean;
  validShuffleDropIds: ReadonlySet<string>;
  onChooseWinner: (matchId: string, playerId: string) => void;
  onSetCtPlayer: (matchId: string, playerId: string | null) => void;
}

function sourcePlaceholder(source: ParticipantSource): string {
  if (source.type === "seed") {
    return "Игрок";
  }

  const sourceMatch = getMatch(source.matchId);
  const name = sourceMatch?.label.split(" · ").at(-1) ?? "предыдущего матча";
  return `${source.type === "winner" ? "Победитель" : "Проигравший"}: ${name}`;
}

function PlayerLine({
  match,
  player,
  source,
  slot,
  isAdmin,
  compact,
  ctPlayerId,
  settingsPending,
  shuffleMode,
  validShuffleDropIds,
  onChooseWinner,
  onSetCtPlayer,
}: PlayerLineProps) {
  const isShuffleSlot = isBracketEntrantSlot(match.id, slot);
  const draggable = Boolean(
    isAdmin &&
      player &&
      match.status !== "locked" &&
      !settingsPending &&
      (!shuffleMode || isShuffleSlot),
  );
  const dragId = `${match.id}::${slot}::${player?.id ?? "empty"}`;
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    disabled: !draggable,
    data: player
      ? {
          playerId: player.id,
          fromMatchId: match.id,
          fromSlot: slot,
          playerName: player.name,
          dragMode: shuffleMode ? "shuffle" : "advance",
        }
      : undefined,
  });
  const shuffleDropId = getBracketEntrantDropId(match.id, slot);
  const validShuffleDropTarget =
    shuffleMode && validShuffleDropIds.has(shuffleDropId);
  const {
    setNodeRef: setShuffleDropNodeRef,
    isOver: isShuffleDropOver,
  } = useDroppable({
    id: shuffleDropId,
    disabled: !isAdmin || !shuffleMode || !isShuffleSlot,
    data: { matchId: match.id, slot, kind: "shuffle" },
  });
  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      setShuffleDropNodeRef(node);
    },
    [setDraggableNodeRef, setShuffleDropNodeRef],
  );

  const style = transform
    ? ({
        "--drag-x": `${transform.x}px`,
        "--drag-y": `${transform.y}px`,
      } as CSSProperties)
    : undefined;
  const isWinner = Boolean(player && match.winnerId === player.id);
  const isLoser = Boolean(player && match.loserId === player.id);
  const bothPlayersReady = match.participants.every(Boolean);
  const startingSide =
    player && ctPlayerId
      ? ctPlayerId === player.id
        ? "CT"
        : "T"
      : "";
  const opponent = player
    ? match.participants.find(
        (participant): participant is Player =>
          Boolean(participant && participant.id !== player.id),
      )
    : null;

  const setStartingSide = (side: "" | "CT" | "T") => {
    if (!player) {
      return;
    }

    if (side === "") {
      onSetCtPlayer(match.id, null);
    } else if (side === "CT") {
      onSetCtPlayer(match.id, player.id);
    } else if (opponent) {
      onSetCtPlayer(match.id, opponent.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "bracket-player",
        compact ? "bracket-player--compact" : "",
        !player ? "is-empty placeholder" : "",
        isWinner ? "is-winner" : "",
        isLoser ? "is-loser" : "",
        draggable ? "is-draggable" : "",
        isDragging ? "is-dragging" : "",
        validShuffleDropTarget ? "is-shuffle-drop-target" : "",
        validShuffleDropTarget && isShuffleDropOver
          ? "is-shuffle-drop-over"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {player ? (
        <>
          {isAdmin && (!shuffleMode || isShuffleSlot) ? (
            <button
              type="button"
              className="drag-handle"
              aria-label={`Перетащить ${player.name}`}
              title={
                shuffleMode
                  ? "Перетащить на игрока соседнего матча"
                  : "Продвинуть или переместить игрока"
              }
              disabled={!draggable}
              {...attributes}
              {...listeners}
            >
              <GripIcon width={16} height={16} />
            </button>
          ) : (
            <span className="seed" aria-hidden="true">
              {String(player.seed).padStart(2, "0")}
            </span>
          )}
          <span className="name" title={player.name}>
            {player.name}
          </span>
          <span className="bracket-player__meta">
            {isAdmin ? (
              <select
                className={[
                  "match-side-select",
                  startingSide
                    ? `match-side-select--${startingSide.toLowerCase()}`
                    : "match-side-select--unset",
                ].join(" ")}
                value={startingSide}
                disabled={
                  !bothPlayersReady || settingsPending || shuffleMode
                }
                onChange={(event) =>
                  setStartingSide(event.target.value as "" | "CT" | "T")
                }
                aria-label={`Стартовая сторона игрока ${player.name}`}
                title={
                  bothPlayersReady
                    ? "Выбрать стартовую сторону"
                    : "Сначала определите обоих участников"
                }
              >
                <option value="">—</option>
                <option value="CT">CT</option>
                <option value="T">T</option>
              </select>
            ) : (
              <span
                className={[
                  "match-side-badge",
                  startingSide
                    ? `match-side-badge--${startingSide.toLowerCase()}`
                    : "match-side-badge--unset",
                ].join(" ")}
                aria-label={
                  startingSide
                    ? `Стартовая сторона: ${startingSide}`
                    : "Стартовая сторона не выбрана"
                }
                title={
                  startingSide
                    ? `Стартовая сторона: ${startingSide}`
                    : "Стартовая сторона не выбрана"
                }
              >
                {startingSide || "—"}
              </span>
            )}
            {isAdmin ? (
              <button
                type="button"
                className={[
                  "winner-pick",
                  isWinner ? "winner-pick--selected" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onChooseWinner(match.id, player.id)}
                disabled={isWinner || settingsPending || shuffleMode}
                aria-label={
                  isWinner
                    ? `${player.name} уже выбран победителем`
                    : `Назначить ${player.name} победителем`
                }
                title={isWinner ? "Победитель выбран" : "Назначить победителем"}
              >
                {isWinner ? (
                  <CheckIcon width={15} height={15} />
                ) : (
                  <TrophyIcon width={15} height={15} />
                )}
              </button>
            ) : (
              <span className="result-mark" aria-hidden="true">
                {isWinner ? "W" : isLoser ? "L" : "—"}
              </span>
            )}
          </span>
          {validShuffleDropTarget ? (
            <span className="shuffle-drop-callout" aria-hidden="true">
              {isShuffleDropOver ? "Поменяем" : "Поменять"}
            </span>
          ) : null}
        </>
      ) : (
        <>
          <span className="seed">—</span>
          <span className="name">{sourcePlaceholder(source)}</span>
          <span className="result-mark">·</span>
        </>
      )}
    </div>
  );
}

export default function MatchCard({
  match,
  settings,
  isAdmin,
  settingsPending = false,
  validDropTarget = false,
  isFinal = false,
  compact = false,
  shuffleMode = false,
  validShuffleDropIds = new Set<string>(),
  onChooseWinner,
  onSetMap,
  onSetCtPlayer,
}: MatchCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: match.id,
    disabled: !isAdmin || settingsPending || shuffleMode,
    data: { matchId: match.id },
  });
  const shortLabel = match.label.split(" · ").at(-1) ?? match.label;

  return (
    <article
      ref={setNodeRef}
      className={[
        "bracket-match",
        compact ? "bracket-match--compact" : "",
        isFinal ? "bracket-match--final is-final" : "",
        validDropTarget ? "is-drop-target" : "",
        validDropTarget && isOver ? "is-drop-over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-status={match.status}
      aria-label={`${match.label}, BO${match.bestOf}`}
    >
      <header className="match-card__header">
        <span>{shortLabel}</span>
        <span className="match-card__format">BO{match.bestOf}</span>
      </header>
      <div className={`match-map ${settings.map ? "" : "is-unset"}`}>
        {isAdmin ? (
          <label className="match-map__control">
            <span className="match-map__label">Карта</span>
            <select
              className="match-map__select"
              value={settings.map ?? ""}
              disabled={settingsPending}
              onChange={(event) =>
                onSetMap(
                  match.id,
                  event.target.value
                    ? (event.target.value as TournamentMap)
                    : null,
                )
              }
              aria-label={`Карта матча ${shortLabel}`}
            >
              <option value="">Не выбрана</option>
              {TOURNAMENT_MAPS.map((map) => (
                <option key={map} value={map}>
                  {map}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <span className="match-map__label">Карта</span>
            <strong className="match-map__value">
              {settings.map ?? "не выбрана"}
            </strong>
          </>
        )}
      </div>
      <PlayerLine
        match={match}
        player={match.participants[0]}
        source={match.sources[0]}
        slot={0}
        isAdmin={isAdmin}
        compact={compact}
        ctPlayerId={settings.ctPlayerId}
        settingsPending={settingsPending}
        shuffleMode={shuffleMode}
        validShuffleDropIds={validShuffleDropIds}
        onChooseWinner={onChooseWinner}
        onSetCtPlayer={onSetCtPlayer}
      />
      <PlayerLine
        match={match}
        player={match.participants[1]}
        source={match.sources[1]}
        slot={1}
        isAdmin={isAdmin}
        compact={compact}
        ctPlayerId={settings.ctPlayerId}
        settingsPending={settingsPending}
        shuffleMode={shuffleMode}
        validShuffleDropIds={validShuffleDropIds}
        onChooseWinner={onChooseWinner}
        onSetCtPlayer={onSetCtPlayer}
      />
      {validDropTarget ? (
        <span className="drop-callout" aria-hidden={!isOver}>
          {isOver ? "Отпускай" : "Сюда"}
        </span>
      ) : null}
    </article>
  );
}

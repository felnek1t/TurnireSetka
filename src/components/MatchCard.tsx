import { useDraggable, useDroppable } from "@dnd-kit/core";
import type { CSSProperties } from "react";
import { getMatch } from "../lib/bracket";
import type {
  ParticipantSource,
  Player,
  ResolvedMatch,
} from "../types";
import { CheckIcon, GripIcon, TrophyIcon } from "./Icons";

interface MatchCardProps {
  match: ResolvedMatch;
  isAdmin: boolean;
  validDropTarget?: boolean;
  isFinal?: boolean;
  compact?: boolean;
  onChooseWinner: (matchId: string, playerId: string) => void;
}

interface PlayerLineProps {
  match: ResolvedMatch;
  player: Player | null;
  source: ParticipantSource;
  slot: 0 | 1;
  isAdmin: boolean;
  compact: boolean;
  onChooseWinner: (matchId: string, playerId: string) => void;
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
  onChooseWinner,
}: PlayerLineProps) {
  const draggable = Boolean(isAdmin && player && match.status !== "locked");
  const dragId = `${match.id}::${slot}::${player?.id ?? "empty"}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: dragId,
    disabled: !draggable,
    data: player
      ? {
          playerId: player.id,
          fromMatchId: match.id,
          playerName: player.name,
        }
      : undefined,
  });

  const style = transform
    ? ({
        "--drag-x": `${transform.x}px`,
        "--drag-y": `${transform.y}px`,
      } as CSSProperties)
    : undefined;
  const isWinner = Boolean(player && match.winnerId === player.id);
  const isLoser = Boolean(player && match.loserId === player.id);

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
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {player ? (
        <>
          {isAdmin ? (
            <button
              type="button"
              className="drag-handle"
              aria-label={`Перетащить ${player.name}`}
              title="Перетащить в следующий матч"
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
          <span className="name">{player.name}</span>
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
              disabled={isWinner}
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
  isAdmin,
  validDropTarget = false,
  isFinal = false,
  compact = false,
  onChooseWinner,
}: MatchCardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: match.id,
    disabled: !isAdmin,
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
      <PlayerLine
        match={match}
        player={match.participants[0]}
        source={match.sources[0]}
        slot={0}
        isAdmin={isAdmin}
        compact={compact}
        onChooseWinner={onChooseWinner}
      />
      <PlayerLine
        match={match}
        player={match.participants[1]}
        source={match.sources[1]}
        slot={1}
        isAdmin={isAdmin}
        compact={compact}
        onChooseWinner={onChooseWinner}
      />
      {validDropTarget ? (
        <span className="drop-callout" aria-hidden={!isOver}>
          {isOver ? "Отпускай" : "Сюда"}
        </span>
      ) : null}
    </article>
  );
}

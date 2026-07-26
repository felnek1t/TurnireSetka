import { useEffect, useMemo, useState } from "react";
import type { VoteSummary } from "../lib/api";
import type { Player } from "../types";
import { CheckIcon, VoteIcon } from "./Icons";

interface VotePanelProps {
  players: Player[];
  votes: VoteSummary;
  busy: boolean;
  onVote: (playerId: string) => Promise<void>;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function VotePanel({
  players,
  votes,
  busy,
  onVote,
}: VotePanelProps) {
  const [selected, setSelected] = useState(votes.myVote ?? "");

  useEffect(() => {
    if (votes.myVote) {
      setSelected(votes.myVote);
    }
  }, [votes.myVote]);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.seed - b.seed),
    [players],
  );
  const maxVotes = Math.max(1, ...Object.values(votes.byPlayer));
  const selectedPlayer = players.find((player) => player.id === selected);
  const votedPlayer = players.find((player) => player.id === votes.myVote);

  return (
    <>
      <div className="vote-summary-line" aria-live="polite">
        <span>
          Всего голосов: <strong>{votes.total}</strong>
        </span>
        {votedPlayer ? (
          <span className="voting-locked">
            <CheckIcon width={16} height={16} />
            Твой голос: {votedPlayer.name}
          </span>
        ) : (
          <span className="vote-note">
            Один голос с устройства и сети — выбрать заново нельзя
          </span>
        )}
      </div>

      <div className="voting-grid" role="radiogroup" aria-label="Выбор игрока">
        {sortedPlayers.map((player) => {
          const count = votes.byPlayer[player.id] ?? 0;
          const percent = votes.total
            ? Math.round((count / votes.total) * 100)
            : 0;
          const relativeWidth = Math.round((count / maxVotes) * 100);
          const isSelected = selected === player.id;
          const isMyVote = votes.myVote === player.id;

          return (
            <label
              key={player.id}
              className={[
                "vote-card",
                isSelected ? "is-selected" : "",
                isMyVote ? "is-my-vote" : "",
                votes.myVote ? "is-locked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                className="visually-hidden"
                type="radio"
                name="winner-vote"
                value={player.id}
                checked={isSelected}
                disabled={Boolean(votes.myVote) || busy}
                onChange={() => setSelected(player.id)}
              />
              <div className="vote-card__top">
                <span
                  className={`vote-avatar vote-avatar--${player.group.toLowerCase()}`}
                >
                  {initials(player.name)}
                </span>
                <span className="vote-card__meta">Группа {player.group}</span>
                {isMyVote ? (
                  <span className="vote-check" title="Твой голос">
                    <CheckIcon width={17} height={17} />
                  </span>
                ) : null}
              </div>
              <strong className="vote-card__name">{player.name}</strong>
              <div className="vote-meta">
                <span className="vote-count">
                  {count} {count === 1 ? "голос" : "голосов"}
                </span>
                <span>{percent}%</span>
              </div>
              <span className="vote-bar" aria-hidden="true">
                <span
                  className="vote-bar__fill"
                  style={{ width: `${relativeWidth}%` }}
                />
              </span>
              {!votes.myVote ? (
                <span className="vote-card__choice">
                  {isSelected ? "Выбрано" : "Выбрать"}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      {!votes.myVote ? (
        <div className="vote-submit-bar">
          <div>
            <span className="vote-submit-bar__label">Твой прогноз</span>
            <strong>
              {selectedPlayer?.name ?? "Сначала выбери игрока"}
            </strong>
          </div>
          <button
            type="button"
            className="vote-button"
            disabled={!selectedPlayer || busy}
            onClick={() => selectedPlayer && onVote(selectedPlayer.id)}
          >
            <VoteIcon />
            {busy ? "Сохраняем…" : "Отдать голос"}
          </button>
        </div>
      ) : null}
    </>
  );
}

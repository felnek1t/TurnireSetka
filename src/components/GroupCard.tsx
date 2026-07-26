import { GROUP_MATCH_IDS } from "../lib/bracket";
import type {
  GroupId,
  GroupStanding,
  ResolvedMatch,
  TournamentState,
} from "../types";
import MatchCard from "./MatchCard";

interface GroupCardProps {
  group: GroupId;
  state: TournamentState;
  matches: ResolvedMatch[];
  standings: GroupStanding[];
  isAdmin: boolean;
  validDropIds: Set<string>;
  onChooseWinner: (matchId: string, playerId: string) => void;
}

const placementLabel = ["Плей-офф", "Последний шанс", "Выбыл", "Выбыл"];

export default function GroupCard({
  group,
  state,
  matches,
  standings,
  isAdmin,
  validDropIds,
  onChooseWinner,
}: GroupCardProps) {
  const ids = GROUP_MATCH_IDS[group];
  const orderedIds = [
    ids.opening1,
    ids.opening2,
    ids.winners,
    ids.losers,
    ids.decider,
  ];
  const groupMatches = orderedIds
    .map((id) => matches.find((match) => match.id === id))
    .filter((match): match is ResolvedMatch => Boolean(match));
  const players = state.players
    .filter((player) => player.group === group)
    .sort((a, b) => a.seed - b.seed);

  return (
    <article
      className={`group-card group-card--${group.toLowerCase()}`}
      data-group={group}
    >
      <div className="group-card__title">
        <div>
          <span className="group-stage-label">GSL · BO1</span>
          <h3 className="group-title">Группа {group}</h3>
        </div>
        <span className="group-progress">
          {groupMatches.filter((match) => match.status === "complete").length}/5
        </span>
      </div>

      <ol className="group-players" aria-label={`Игроки группы ${group}`}>
        {players.map((player) => {
          const standing = standings.find(
            (item) => item.player?.id === player.id,
          );

          return (
            <li className="group-player" key={player.id}>
              <span>{player.name}</span>
              <span
                className={[
                  "standing-score",
                  standing?.position === 1 ? "standing-score--qualified" : "",
                  standing?.position === 2 ? "standing-score--chance" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {standing ? placementLabel[standing.position - 1] : "—"}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="group-stage-label">Матчи группы</p>
      <div className="group-matches">
        {groupMatches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            isAdmin={isAdmin}
            compact
            validDropTarget={validDropIds.has(match.id)}
            onChooseWinner={onChooseWinner}
          />
        ))}
      </div>
    </article>
  );
}

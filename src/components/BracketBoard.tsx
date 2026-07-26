import type {
  MatchSettings,
  ResolvedMatch,
  TournamentMap,
} from "../types";
import MatchCard from "./MatchCard";

export interface BracketColumnDefinition {
  title: string;
  subtitle: string;
  matchIds: string[];
  finalIds?: string[];
}

interface BracketBoardProps {
  columns: BracketColumnDefinition[];
  matches: ResolvedMatch[];
  matchSettings: Record<string, MatchSettings>;
  isAdmin: boolean;
  settingsPending: boolean;
  validDropIds: Set<string>;
  onChooseWinner: (matchId: string, playerId: string) => void;
  onSetMap: (matchId: string, map: TournamentMap | null) => void;
  onSetCtPlayer: (matchId: string, playerId: string | null) => void;
}

export default function BracketBoard({
  columns,
  matches,
  matchSettings,
  isAdmin,
  settingsPending,
  validDropIds,
  onChooseWinner,
  onSetMap,
  onSetCtPlayer,
}: BracketBoardProps) {
  return (
    <div className="bracket-scroll" tabIndex={0}>
      <p className="bracket-scroll-hint">
        На узком экране сетку можно прокручивать по горизонтали
      </p>
      <div
        className={`bracket-board bracket-board--${columns.length}`}
        style={{
          "--bracket-columns": columns.length,
        } as React.CSSProperties}
      >
        {columns.map((column) => (
          <div className="bracket-column" key={column.title}>
            <h3 className="round-header">
              {column.title}
              <span className="round-subtitle">{column.subtitle}</span>
            </h3>
            <div className="bracket-list">
              {column.matchIds.map((matchId) => {
                const match = matches.find((item) => item.id === matchId);
                if (!match) {
                  return null;
                }

                return (
                  <MatchCard
                    key={match.id}
                    match={match}
                    settings={matchSettings[match.id] ?? {}}
                    isAdmin={isAdmin}
                    settingsPending={settingsPending}
                    isFinal={column.finalIds?.includes(match.id)}
                    validDropTarget={validDropIds.has(match.id)}
                    onChooseWinner={onChooseWinner}
                    onSetMap={onSetMap}
                    onSetCtPlayer={onSetCtPlayer}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

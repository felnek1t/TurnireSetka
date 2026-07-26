import type { ResolvedMatch } from "../types";
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
  isAdmin: boolean;
  validDropIds: Set<string>;
  onChooseWinner: (matchId: string, playerId: string) => void;
}

export default function BracketBoard({
  columns,
  matches,
  isAdmin,
  validDropIds,
  onChooseWinner,
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
                    isAdmin={isAdmin}
                    isFinal={column.finalIds?.includes(match.id)}
                    validDropTarget={validDropIds.has(match.id)}
                    onChooseWinner={onChooseWinner}
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

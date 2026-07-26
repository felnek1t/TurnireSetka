import { useDroppable } from "@dnd-kit/core";
import type { TournamentPlacement } from "../types";
import { CrownIcon, TrophyIcon } from "./Icons";

interface PodiumProps {
  placements: TournamentPlacement[];
  isDropTarget: boolean;
}

const orderedPlaces = [2, 1, 3] as const;

export default function Podium({
  placements,
  isDropTarget,
}: PodiumProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: "podium",
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "podium",
        isDropTarget ? "is-drop-target" : "",
        isDropTarget && isOver ? "is-drop-over" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Итоговые места турнира"
    >
      {orderedPlaces.map((place) => {
        const placement = placements.find((item) => item.position === place);
        const modifier =
          place === 1 ? "first" : place === 2 ? "second" : "third";

        return (
          <article
            className={`podium-card podium-card--${modifier}`}
            key={place}
          >
            <div className="podium-trophy">
              {place === 1 ? <CrownIcon /> : <TrophyIcon />}
            </div>
            <span className="podium-place">{place} место</span>
            <strong className="podium-name">
              {placement?.player?.name ?? "Ещё не определено"}
            </strong>
          </article>
        );
      })}
      {isDropTarget ? (
        <span className="podium-drop-callout">
          {isOver ? "Отпускай — это чемпион" : "Перетащи сюда чемпиона"}
        </span>
      ) : null}
    </div>
  );
}

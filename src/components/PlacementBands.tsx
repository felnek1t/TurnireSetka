import type { TournamentPlacementBand } from "../types";

interface PlacementBandsProps {
  bands: TournamentPlacementBand[];
}

const BAND_DESCRIPTIONS: Record<number, string> = {
  4: "Вылет в четвертьфинале плей-офф",
  6: "Финал последнего шанса",
  7: "Полуфинал последнего шанса",
  9: "Третьи места групп",
  13: "Четвёртые места групп",
};

function placeLabel(from: number, to: number): string {
  return from === to ? `${from} место` : `${from}–${to} места`;
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default function PlacementBands({ bands }: PlacementBandsProps) {
  return (
    <div className="placement-bands">
      <div className="placement-bands__heading">
        <div>
          <p className="section-kicker">Полная таблица</p>
          <h3>Остальные места</h3>
        </div>
        <p>
          Одинаковый диапазон означает равный результат: отдельного матча за
          точное место между этими игроками нет.
        </p>
      </div>

      <div className="placement-bands__grid">
        {bands.map((band) => (
          <article
            className={`placement-band placement-band--${band.from}`}
            key={`${band.from}-${band.to}`}
          >
            <header className="placement-band__header">
              <strong>{placeLabel(band.from, band.to)}</strong>
              <span>{BAND_DESCRIPTIONS[band.from]}</span>
            </header>
            <ol
              className="placement-band__players"
              aria-label={placeLabel(band.from, band.to)}
            >
              {band.entries.map((entry, index) => (
                <li
                  className={entry.player ? "is-resolved" : "is-pending"}
                  key={`${band.from}-${index}`}
                >
                  <span className="placement-band__avatar" aria-hidden="true">
                    {entry.player ? initials(entry.player.name) : "?"}
                  </span>
                  <span>
                    <strong>
                      {entry.player?.name ?? "Ещё не определено"}
                    </strong>
                    <small>
                      {entry.player
                        ? `Посев ${entry.player.seed}`
                        : "Ожидаем результат матча"}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </div>
  );
}

import { TOURNAMENT_MAPS } from "../lib/bracket";
import type {
  MapVetoEntry,
  MapVetoKind,
  TournamentMap,
} from "../types";
import {
  CheckIcon,
  RefreshIcon,
  SwordsIcon,
  XIcon,
} from "./Icons";

interface MapVetoPanelProps {
  entries: MapVetoEntry[];
  isAdmin: boolean;
  busy: boolean;
  onDecide: (map: TournamentMap, kind: MapVetoKind) => Promise<void>;
  onUndo: (map: TournamentMap) => Promise<void>;
  onReset: () => Promise<void>;
}

const MAP_NAMES: Record<TournamentMap, string> = {
  de_dust2: "Dust II",
  de_mirage: "Mirage",
  de_overpass: "Overpass",
  de_inferno: "Inferno",
  de_nuke: "Nuke",
  de_train: "Train",
};

export default function MapVetoPanel({
  entries,
  isAdmin,
  busy,
  onDecide,
  onUndo,
  onReset,
}: MapVetoPanelProps) {
  const decisions = new Map(
    entries.map((entry, index) => [
      entry.map,
      { ...entry, sequence: index + 1 },
    ]),
  );
  const banned = entries.filter((entry) => entry.kind === "ban").length;
  const picked = entries.filter((entry) => entry.kind === "pick").length;
  const remaining = TOURNAMENT_MAPS.length - entries.length;

  return (
    <section className="section-card map-veto-section" id="map-veto">
      <header className="section-header map-veto-header">
        <div>
          <p className="section-kicker">Общий выбор карт</p>
          <h2 className="section-heading">Бан / пик карт</h2>
          <p className="section-description">
            {isAdmin
              ? "Отмечай карты по очереди. Доска хранится отдельно от сетки и сбрасывается только вручную."
              : "Следи за выбором организатора: сразу видно, что забанено, выбрано и осталось в пуле."}
          </p>
        </div>
        <div className="map-veto-header__actions">
          <span
            className={`map-veto-live${remaining === 0 ? " is-complete" : ""}`}
            aria-live="polite"
          >
            {remaining === 0
              ? "Все карты отмечены"
              : `Осталось ${remaining} из 6`}
          </span>
          {isAdmin ? (
            <button
              type="button"
              className="map-veto-reset"
              onClick={() => void onReset()}
              disabled={busy || entries.length === 0}
            >
              <RefreshIcon width={17} height={17} />
              Сбросить бан/пик
            </button>
          ) : null}
          <SwordsIcon className="section-icon" width={36} height={36} />
        </div>
      </header>

      <div className="map-veto-stats" aria-label="Статистика выбора карт">
        <span>
          <i
            className="map-veto-dot map-veto-dot--available"
            aria-hidden="true"
          />
          Доступно <strong>{remaining}</strong>
        </span>
        <span>
          <i
            className="map-veto-dot map-veto-dot--ban"
            aria-hidden="true"
          />
          Баны <strong>{banned}</strong>
        </span>
        <span>
          <i
            className="map-veto-dot map-veto-dot--pick"
            aria-hidden="true"
          />
          Пики <strong>{picked}</strong>
        </span>
      </div>

      <div className="map-veto-grid">
        {TOURNAMENT_MAPS.map((map) => {
          const decision = decisions.get(map);
          const status = decision?.kind ?? "available";
          const isLastRemaining = !decision && remaining === 1;

          return (
            <article
              className={[
                "map-veto-card",
                `map-veto-card--${status}`,
                isLastRemaining ? "is-last-remaining" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              key={map}
            >
              <div className="map-veto-card__top">
                <span className={`map-veto-status map-veto-status--${status}`}>
                  {decision
                    ? `#${decision.sequence} ${decision.kind === "ban" ? "Бан" : "Пик"}`
                    : isLastRemaining
                      ? "Осталась"
                      : "Доступна"}
                </span>
                {decision ? (
                  decision.kind === "ban" ? (
                    <XIcon width={19} height={19} />
                  ) : (
                    <CheckIcon width={19} height={19} />
                  )
                ) : (
                  <span className="map-veto-card__number">
                    {String(TOURNAMENT_MAPS.indexOf(map) + 1).padStart(2, "0")}
                  </span>
                )}
              </div>

              <strong className="map-veto-card__name">{MAP_NAMES[map]}</strong>
              <code className="map-veto-card__code">{map}</code>

              {isAdmin ? (
                decision ? (
                  <button
                    type="button"
                    className="map-veto-undo"
                    disabled={busy}
                    onClick={() => void onUndo(map)}
                    aria-label={`Отменить решение по ${map}`}
                  >
                    Отменить решение
                  </button>
                ) : (
                  <div
                    className="map-veto-card__controls"
                    aria-label={`Решение для ${map}`}
                    role="group"
                  >
                    <button
                      type="button"
                      className="map-veto-choice map-veto-choice--ban"
                      disabled={busy}
                      onClick={() => void onDecide(map, "ban")}
                      aria-label={`Забанить ${map}`}
                    >
                      <XIcon width={16} height={16} />
                      Бан
                    </button>
                    <button
                      type="button"
                      className="map-veto-choice map-veto-choice--pick"
                      disabled={busy}
                      onClick={() => void onDecide(map, "pick")}
                      aria-label={`Выбрать ${map}`}
                    >
                      <CheckIcon width={16} height={16} />
                      Пик
                    </button>
                  </div>
                )
              ) : (
                <span className="map-veto-card__guest-state">
                  {decision
                    ? decision.kind === "ban"
                      ? "Исключена из пула"
                      : "Выбрана для игры"
                    : "Ещё участвует в выборе"}
                </span>
              )}
            </article>
          );
        })}
      </div>

      <div className="map-veto-history">
        <span className="map-veto-history__label">Порядок решений</span>
        {entries.length ? (
          <ol>
            {entries.map((entry, index) => (
              <li
                className={`map-veto-history__item map-veto-history__item--${entry.kind}`}
                key={entry.map}
              >
                <span>{index + 1}</span>
                <strong>{entry.kind === "ban" ? "Бан" : "Пик"}</strong>
                <code>{entry.map}</code>
              </li>
            ))}
          </ol>
        ) : (
          <p>Решений пока нет — все шесть карт доступны.</p>
        )}
      </div>
    </section>
  );
}

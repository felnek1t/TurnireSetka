import { useMemo, useState, type FormEvent } from "react";
import type { GroupId, TournamentState } from "../types";
import Modal from "./Modal";
import { CheckIcon, RefreshIcon } from "./Icons";

interface SettingsResult {
  state: TournamentState;
  resetVotes: boolean;
}

interface SettingsModalProps {
  state: TournamentState;
  busy: boolean;
  onClose: () => void;
  onSave: (result: SettingsResult) => Promise<void>;
}

const groups: GroupId[] = ["A", "B", "C", "D"];

export default function SettingsModal({
  state,
  busy,
  onClose,
  onSave,
}: SettingsModalProps) {
  const [title, setTitle] = useState(state.title);
  const [names, setNames] = useState<Record<string, string>>(
    Object.fromEntries(state.players.map((player) => [player.id, player.name])),
  );
  const [resetBracket, setResetBracket] = useState(false);
  const [resetVotes, setResetVotes] = useState(false);
  const [error, setError] = useState("");

  const playersByGroup = useMemo(
    () =>
      Object.fromEntries(
        groups.map((group) => [
          group,
          state.players
            .filter((player) => player.group === group)
            .sort((a, b) => a.seed - b.seed),
        ]),
      ),
    [state.players],
  ) as Record<GroupId, TournamentState["players"]>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanNames = Object.fromEntries(
      Object.entries(names).map(([id, name]) => [id, name.trim()]),
    );

    if (cleanTitle.length < 3 || cleanTitle.length > 80) {
      setError("Название должно содержать от 3 до 80 символов.");
      return;
    }
    if (Object.values(cleanNames).some((name) => name.length < 2 || name.length > 24)) {
      setError("Имя каждого игрока должно содержать от 2 до 24 символов.");
      return;
    }
    const normalized = Object.values(cleanNames).map((name) =>
      name.toLocaleLowerCase("ru"),
    );
    if (new Set(normalized).size !== normalized.length) {
      setError("Имена игроков не должны повторяться.");
      return;
    }

    setError("");
    await onSave({
      state: {
        ...state,
        title: cleanTitle,
        players: state.players.map((player) => ({
          ...player,
          name: cleanNames[player.id],
        })),
        winners: resetBracket ? {} : state.winners,
        matchSettings: resetBracket ? {} : state.matchSettings,
        updatedAt: new Date().toISOString(),
      },
      resetVotes,
    });
  };

  return (
    <Modal
      wide
      title="Настройки турнира"
      description="Переименуйте игроков и при необходимости начните новую сетку."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label className="form-field">
          <span className="form-label">Название турнира</span>
          <input
            className="form-input"
            value={title}
            maxLength={80}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="players-form-grid">
          {groups.map((group) => (
            <fieldset className={`players-fieldset group-card--${group.toLowerCase()}`} key={group}>
              <legend>Группа {group}</legend>
              {playersByGroup[group].map((player, index) => (
                <label className="player-name-field" key={player.id}>
                  <span>{index + 1}</span>
                  <input
                    className="form-input"
                    value={names[player.id]}
                    maxLength={24}
                    onChange={(event) =>
                      setNames((current) => ({
                        ...current,
                        [player.id]: event.target.value,
                      }))
                    }
                    aria-label={`Игрок ${index + 1} группы ${group}`}
                  />
                </label>
              ))}
            </fieldset>
          ))}
        </div>

        <div className="reset-options">
          <label className="reset-option">
            <input
              type="checkbox"
              checked={resetBracket}
              onChange={(event) => setResetBracket(event.target.checked)}
            />
            <span>
              <strong>Начать сетку заново</strong>
              <small>Очистятся результаты, карты и выбранные стороны</small>
            </span>
          </label>
          <label className="reset-option">
            <input
              type="checkbox"
              checked={resetVotes}
              onChange={(event) => setResetVotes(event.target.checked)}
            />
            <span>
              <strong>Очистить голоса</strong>
              <small>Зрители смогут проголосовать заново</small>
            </span>
          </label>
        </div>

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button type="submit" className="modal-action" disabled={busy}>
            {resetBracket || resetVotes ? <RefreshIcon /> : <CheckIcon />}
            {busy ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

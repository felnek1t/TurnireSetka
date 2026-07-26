import { useState, type FormEvent } from "react";
import Modal from "./Modal";
import { LockIcon } from "./Icons";

interface LoginModalProps {
  busy: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
}

export default function LoginModal({
  busy,
  error,
  onClose,
  onSubmit,
}: LoginModalProps) {
  const [pin, setPin] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pin.length !== 4 || busy) {
      return;
    }
    await onSubmit(pin);
  };

  return (
    <Modal
      title="Вход организатора"
      description="Введите четырёхзначный код. Гости могут только смотреть сетку и голосовать."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <label className="form-field">
          <span className="form-label">Код доступа</span>
          <input
            className="form-input pin-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4}"
            minLength={4}
            maxLength={4}
            value={pin}
            onChange={(event) =>
              setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="••••"
            aria-invalid={Boolean(error)}
          />
        </label>
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
          <button
            type="submit"
            className="modal-action"
            disabled={busy || pin.length !== 4}
          >
            <LockIcon />
            {busy ? "Проверяем…" : "Войти"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

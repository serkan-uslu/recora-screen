import { useContext, useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "../atoms/IconButton";
import { ErrorContext } from "../../controllers/StudioContexts";

export function Dialog({
  title,
  subtitle,
  onClose,
  children,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const error = useContext(ErrorContext);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`dialog ${wide ? "wide" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <IconButton label="Close dialog" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {error && (
        <p role="alert" className="inline-error dialog-error">
          {error}
        </p>
      )}
      {children}
    </dialog>
  );
}

export function IconButton({
  children,
  label,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${props.className ?? ""}`}
      title={label}
      aria-label={label}
    >
      {children}
    </button>
  );
}

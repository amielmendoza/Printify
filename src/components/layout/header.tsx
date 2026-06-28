interface HeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  bordered?: boolean
}

export function Header({ title, description, eyebrow, actions, bordered = true }: HeaderProps) {
  return (
    <div
      className={`flex h-16 shrink-0 items-center justify-between gap-4 bg-card px-6 ${
        bordered ? "border-b" : ""
      }`}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
            {eyebrow}
          </p>
        )}
        <h2 className="truncate text-[17px] font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="truncate text-[13px] text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

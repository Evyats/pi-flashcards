function Icon({ children }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24">{children}</svg>
}

export function ArrowIcon() {
  return <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>
}

export function CheckIcon() {
  return <Icon><path d="m5 12 4 4L19 6" /></Icon>
}

export function CrossIcon() {
  return <Icon><path d="m7 7 10 10M17 7 7 17" /></Icon>
}

export function PlusIcon() {
  return <Icon><path d="M12 5v14M5 12h14" /></Icon>
}

export function ImportIcon() {
  return <Icon><path d="M12 3v12m-4-4 4 4 4-4M5 18v3h14v-3" /></Icon>
}

export function ExportIcon() {
  return <Icon><path d="M12 21V9m-4 4 4-4 4 4M5 6V3h14v3" /></Icon>
}

export function ChevronIcon({ direction }) {
  const path = direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'
  return <Icon><path d={path} /></Icon>
}

export function TrashIcon() {
  return <Icon><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" /></Icon>
}

export function GearIcon() {
  return <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" /></Icon>
}

export function ThemeIcon({ dark }) {
  return dark ? (
    <Icon><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /><circle cx="12" cy="12" r="4" /></Icon>
  ) : (
    <Icon><path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z" /></Icon>
  )
}

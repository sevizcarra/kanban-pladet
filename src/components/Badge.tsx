interface BadgeProps { children: React.ReactNode; color: string; bg: string; }
export default function Badge({ children, color, bg }: BadgeProps) {
  return <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color, backgroundColor: bg }}>{children}</span>;
}

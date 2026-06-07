interface DividerProps {
  label: string
}

export default function SectionDivider({ label }: DividerProps) {
  return (
    <div className="reveal flex items-center gap-4 px-6 md:px-10 my-2">
      <div className="flex-1 h-px bg-[rgba(0,255,136,0.08)]" />
      <div className="font-mono text-[9px] tracking-[4px] text-null-muted whitespace-nowrap uppercase">
        {label}
      </div>
      <div className="flex-1 h-px bg-[rgba(0,255,136,0.08)]" />
    </div>
  )
}

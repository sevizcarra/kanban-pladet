interface ProgressBarProps { value: number; color: string; }
export default function ProgressBar({ value, color }: ProgressBarProps) {
  return (
    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, backgroundColor: color }} />
    </div>
  );
}

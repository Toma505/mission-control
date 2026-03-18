export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-text-muted border-t-accent-highlight rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Loading...</p>
      </div>
    </div>
  )
}

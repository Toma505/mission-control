import { SessionReplay } from '@/components/chat/session-replay'

export default function ReplayPage() {
  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Session Replay</h1>
        <p className="text-sm text-text-muted mt-1">
          Browse and search conversation history across all agent sessions
        </p>
      </div>
      <SessionReplay />
    </div>
  )
}

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { feedbackApi } from '@/lib/api'

interface SignupFeedbackModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  orgId: string
  userId: string
}

export function SignupFeedbackModal({
  open,
  onClose,
  onSubmitted,
  orgId,
  userId,
}: SignupFeedbackModalProps) {
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleSubmit = async (skipped: boolean) => {
    setError(null)
    setLoading(true)
    try {
      await feedbackApi.submitSignupReason(
        orgId,
        userId,
        skipped ? 'Skipped' : (answerText.trim() || 'Skipped')
      )
      onSubmitted()
      onClose()
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Something went wrong. Please try again.'
      setError(typeof msg === 'string' ? msg : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !loading && onClose()}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 flex flex-col shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">What made you try MemberCore?</h3>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-zinc-300 text-sm">
            Your answer helps us improve. Optional.
          </p>
          <textarea
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            placeholder="e.g. needed a simple way to manage our members and events..."
            className="w-full min-h-[100px] rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="flex gap-3 p-4 border-t border-zinc-700">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-600"
            onClick={() => handleSubmit(true)}
            disabled={loading}
          >
            Skip
          </Button>
          <Button
            type="button"
            className="flex-1 bg-white text-black hover:bg-zinc-200"
            onClick={() => handleSubmit(false)}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  )
}

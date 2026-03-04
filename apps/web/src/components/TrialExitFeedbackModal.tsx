import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { feedbackApi } from '@/lib/api'

const TRIAL_EXIT_OPTIONS = [
  { key: 'missing_feature', label: 'Missing features we need' },
  { key: 'too_expensive', label: 'Too expensive' },
  { key: 'too_complex', label: 'Too complex or hard to set up' },
  { key: 'staying_with_current', label: 'Sticking with our current system' },
  { key: 'other', label: 'Other' },
] as const

type ChoiceKey = (typeof TRIAL_EXIT_OPTIONS)[number]['key']

interface TrialExitFeedbackModalProps {
  open: boolean
  onClose: () => void
  onSubmitted: () => void
  orgId: string
  userId: string
}

export function TrialExitFeedbackModal({
  open,
  onClose,
  onSubmitted,
  orgId,
  userId,
}: TrialExitFeedbackModalProps) {
  const [choiceKey, setChoiceKey] = useState<ChoiceKey | ''>('')
  const [answerText, setAnswerText] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async (skipped: boolean) => {
    setLoading(true)
    try {
      await feedbackApi.submitTrialExitReason(
        orgId,
        userId,
        skipped ? 'skipped' : (choiceKey || 'skipped'),
        skipped ? '' : answerText.trim()
      )
      onSubmitted()
      onClose()
    } catch {
      setLoading(false)
    } finally {
      if (!skipped) setLoading(false)
    }
  }

  const canSubmit = choiceKey.length > 0

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !loading && onClose()}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 flex flex-col shadow-xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700 shrink-0">
          <h3 className="text-lg font-semibold text-white">Main reason you didn&apos;t continue?</h3>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto">
          <p className="text-zinc-300 text-sm">
            Your feedback helps us improve. Optional.
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Reason">
            {TRIAL_EXIT_OPTIONS.map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg border border-zinc-700 hover:bg-zinc-800/50 cursor-pointer has-[:checked]:border-zinc-500 has-[:checked]:bg-zinc-800"
              >
                <input
                  type="radio"
                  name="trial-exit-reason"
                  value={key}
                  checked={choiceKey === key}
                  onChange={() => setChoiceKey(key)}
                  disabled={loading}
                  className="rounded-full border-zinc-600 text-white focus:ring-zinc-500"
                />
                <span className="text-sm text-zinc-200">{label}</span>
              </label>
            ))}
          </div>
          <div>
            <label htmlFor="trial-exit-other" className="block text-sm text-zinc-400 mb-1">
              Anything else you&apos;d like to share?
            </label>
            <textarea
              id="trial-exit-other"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Optional details..."
              className="w-full min-h-[80px] rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 resize-none"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-zinc-700 shrink-0">
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
            disabled={loading || !canSubmit}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  )
}

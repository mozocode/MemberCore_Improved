import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface CreatePollModalProps {
  orgId: string
  onClose: () => void
  onCreated: () => void
}

export function CreatePollModal({ orgId, onClose, onCreated }: CreatePollModalProps) {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [endsAt, setEndsAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addOption = () => {
    if (options.length < 10) setOptions([...options, ''])
  }

  const removeOption = (i: number) => {
    if (options.length > 2) setOptions(options.filter((_, j) => j !== i))
  }

  const updateOption = (i: number, v: string) => {
    const next = [...options]
    next[i] = v
    setOptions(next)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const validOptions = options.filter((o) => o.trim())
    if (!question.trim()) {
      setError('Question is required')
      return
    }
    if (validOptions.length < 2) {
      setError('At least 2 options required')
      return
    }
    setLoading(true)
    try {
      await api.post(`/polls/${orgId}`, {
        question: question.trim(),
        description: description.trim() || undefined,
        options: validOptions.map((text) => ({ text })),
        allow_multiple_votes: allowMultiple,
        is_anonymous: isAnonymous,
        ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      })
      onCreated()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create poll')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">Create Poll</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</div>}
          <div>
            <Label className="text-zinc-300">Question *</Label>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Poll question"
              required
              className="mt-1 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Description (optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Options (2-10) *</Label>
            <div className="space-y-2 mt-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-zinc-800 border-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    disabled={options.length <= 2}
                    className="p-2 text-zinc-500 hover:text-red-400 disabled:opacity-50"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {options.length < 10 && (
                <button type="button" onClick={addOption} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
                  <Plus size={16} />
                  Add option
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={allowMultiple} onChange={(e) => setAllowMultiple(e.target.checked)} className="rounded border-zinc-600" />
              Allow multiple votes
            </label>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="rounded border-zinc-600" />
              Anonymous voting
            </label>
            <div>
              <Label className="text-zinc-300 text-sm">End date (optional)</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="mt-1 bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-white text-black hover:bg-zinc-200">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Poll'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

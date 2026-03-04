import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

interface TemplateEdit {
  id: string
  title: string
  description?: string
}

interface CreateTemplateModalProps {
  orgId: string
  template?: TemplateEdit | null
  onClose: () => void
  onCreated: () => void
}

export function CreateTemplateModal({ orgId, template, onClose, onCreated }: CreateTemplateModalProps) {
  const [title, setTitle] = useState(template?.title ?? '')
  const [description, setDescription] = useState(template?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setTitle(template?.title ?? '')
    setDescription(template?.description ?? '')
  }, [template?.id, template?.title, template?.description])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setLoading(true)
    try {
      if (template?.id) {
        await api.put(`/documents/${orgId}/templates/${template.id}`, {
          title: title.trim(),
          description: description.trim() || undefined,
        })
      } else {
        await api.post(`/documents/${orgId}/templates`, {
          title: title.trim(),
          description: description.trim() || undefined,
        })
      }
      onCreated()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save template')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">{template?.id ? 'Edit Required Document' : 'Add Required Document'}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</div>}
          <div>
            <Label className="text-zinc-300">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., ID Verification" required className="mt-1 bg-zinc-800 border-zinc-700" />
          </div>
          <div>
            <Label className="text-zinc-300">Description (optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What members need to upload"
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-white text-black hover:bg-zinc-200">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : template?.id ? 'Save changes' : 'Add Document'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

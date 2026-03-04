import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { prepareDocumentOrImageForUpload } from '@/lib/imageCompression'

interface CreateOrgDocumentModalProps {
  orgId: string
  onClose: () => void
  onCreated: () => void
}

export function CreateOrgDocumentModal({ orgId, onClose, onCreated }: CreateOrgDocumentModalProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [fileType, setFileType] = useState('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    let finalContent = content
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('File must be under 10MB')
        return
      }
      try {
        finalContent = await prepareDocumentOrImageForUpload(file)
      } catch {
        setError('Failed to read or compress file')
        return
      }
    }
    if (!finalContent.trim()) {
      setError('Upload a file or paste content/URL')
      return
    }
    setLoading(true)
    try {
      await api.post(`/documents/${orgId}`, {
        title: title.trim(),
        content: finalContent,
        file_type: fileType,
      })
      onCreated()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">Add Document</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</div>}
          <div>
            <Label className="text-zinc-300">Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" required className="mt-1 bg-zinc-800 border-zinc-700" />
          </div>
          <div>
            <Label className="text-zinc-300">File (PDF, PNG, JPG - max 10MB)</Label>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setFile(f || null)
                if (f) {
                  setTitle((t) => (t ? t : f.name.replace(/\.[^/.]+$/, '')))
                  const ext = f.name.split('.').pop()?.toLowerCase() || 'pdf'
                  setFileType(ext === 'png' || ext === 'jpg' || ext === 'jpeg' ? ext : 'pdf')
                }
              }}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-zinc-700 file:text-white"
            />
            {file && <p className="text-xs text-zinc-500 mt-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>}
          </div>
          <div>
            <Label className="text-zinc-300">Or paste content/URL</Label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Optional: data:application/pdf;base64,... or https://..."
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white font-mono"
            />
          </div>
          <div>
            <Label className="text-zinc-300">File Type</Label>
            <select
              value={fileType}
              onChange={(e) => setFileType(e.target.value)}
              className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 text-white text-sm"
            >
              <option value="pdf">PDF</option>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1 bg-white text-black hover:bg-zinc-200">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Document'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

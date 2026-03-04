import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Doc {
  id: string
  title: string
  content: string
  file_type?: string
}

interface DocumentViewerModalProps {
  doc: Doc
  onClose: () => void
}

export function DocumentViewerModal({ doc, onClose }: DocumentViewerModalProps) {
  const isPdf = doc.content?.startsWith('data:application/pdf') || doc.file_type === 'pdf'
  const isImage = doc.content?.startsWith('data:image') || ['png', 'jpg', 'jpeg', 'gif'].includes(doc.file_type || '')

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white truncate">{doc.title}</h3>
        <div className="flex items-center gap-2">
          {(doc.content?.startsWith('data:') || doc.content?.startsWith('http')) && (
            <a
              href={doc.content}
              download={`${doc.title}.${doc.file_type || 'pdf'}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 text-white hover:bg-zinc-700 text-sm"
            >
              <Download size={18} />
              Download
            </a>
          )}
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={24} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4 flex justify-center items-start">
        {isPdf ? (
          <iframe
            src={doc.content}
            title={doc.title}
            className="w-full max-w-4xl h-[calc(100vh-120px)] rounded-lg border border-zinc-700"
          />
        ) : isImage ? (
          <img
            src={doc.content}
            alt={doc.title}
            className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg border border-zinc-700"
          />
        ) : (
          <div className="text-zinc-400 text-center py-12">
            <p>Preview not available for this file type</p>
            <a
              href={doc.content}
              download={`${doc.title}.${doc.file_type || 'bin'}`}
              className="inline-flex items-center gap-2 mt-4 text-brand-orange hover:underline"
            >
              <Download size={18} />
              Download file
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

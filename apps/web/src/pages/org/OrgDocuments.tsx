import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText,
  Loader2,
  Download,
  Eye,
  Upload,
  Check,
  AlertTriangle,
  FolderOpen,
  Link2,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { DocumentViewerModal } from '@/components/DocumentViewerModal'
import { UploadForTemplateModal } from '@/components/UploadForTemplateModal'
import { cn } from '@/lib/utils'

interface OrgDoc {
  id: string
  title: string
  content: string
  file_type?: string
}

interface Template {
  id: string
  title: string
  description?: string
  uploaded: boolean
  my_document_id?: string
}

interface GoogleFormLink {
  id: string
  title: string
  form_url: string
}

export function OrgDocuments() {
  const { orgId } = useParams<{ orgId: string }>()
  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [googleForms, setGoogleForms] = useState<GoogleFormLink[]>([])
  const [loading, setLoading] = useState(true)
  const [viewingDoc, setViewingDoc] = useState<OrgDoc | null>(null)
  const [uploadModalTemplate, setUploadModalTemplate] = useState<Template | null>(null)

  const fetchData = async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [docsRes, templatesRes, formsRes] = await Promise.all([
        api.get(`/documents/${orgId}`),
        api.get(`/documents/${orgId}/templates`),
        api.get(`/documents/${orgId}/google-forms`),
      ])
      setOrgDocs(docsRes.data)
      setTemplates(templatesRes.data)
      setGoogleForms(formsRes.data || [])
    } catch {
      setOrgDocs([])
      setTemplates([])
      setGoogleForms([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [orgId])

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FolderOpen size={20} />
              Organization Documents
            </h3>
            {orgDocs.length === 0 ? (
              <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-8 text-center">
                <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No documents yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orgDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-zinc-500" />
                      <span className="font-medium text-white">{doc.title}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingDoc(doc)}
                        className="text-zinc-400 hover:text-white"
                      >
                        <Eye size={16} />
                        <span className="ml-1">View</span>
                      </Button>
                      {doc.content?.startsWith('data:') || doc.content?.startsWith('http') ? (
                        <a
                          href={doc.content}
                          download={`${doc.title}.${doc.file_type || 'pdf'}`}
                          className="inline-flex items-center gap-1 text-zinc-400 hover:text-white text-sm"
                        >
                          <Download size={16} />
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {googleForms.length > 0 && (
            <section>
              <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
                <Link2 size={20} />
                Forms
              </h3>
              <div className="space-y-2">
                {googleForms.map((f) => (
                  <a
                    key={f.id}
                    href={f.form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-600 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Link2 className="h-8 w-8 text-zinc-500" />
                      <span className="font-medium text-white">{f.title}</span>
                    </div>
                    <span className="text-zinc-400 group-hover:text-white flex items-center gap-1 text-sm">
                      <ExternalLink size={16} />
                      Open form
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-lg font-medium text-white mb-3 flex items-center gap-2">
              <FileText size={20} />
              Required Documents
            </h3>
            {templates.length === 0 ? (
              <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-8 text-center">
                <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No required documents</p>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-700"
                  >
                    <div className="flex items-center gap-3">
                      {t.uploaded ? (
                        <Check className="h-8 w-8 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-8 w-8 text-amber-500" />
                      )}
                      <div>
                        <span className="font-medium text-white">{t.title}</span>
                        {t.description && (
                          <p className="text-sm text-zinc-500 mt-0.5">{t.description}</p>
                        )}
                        <span className={cn(
                          'text-xs ml-2',
                          t.uploaded ? 'text-green-400' : 'text-amber-400',
                        )}>
                          {t.uploaded ? 'Uploaded' : 'Not uploaded'}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUploadModalTemplate(t)}
                      className={cn(
                        'bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700',
                        t.uploaded && 'text-zinc-400',
                      )}
                    >
                      <Upload size={16} />
                      <span className="ml-1">{t.uploaded ? 'Replace' : 'Upload'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          onClose={() => setViewingDoc(null)}
        />
      )}
      {uploadModalTemplate && (
        <UploadForTemplateModal
          orgId={orgId!}
          template={uploadModalTemplate}
          onClose={() => setUploadModalTemplate(null)}
          onUploaded={() => {
            setUploadModalTemplate(null)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

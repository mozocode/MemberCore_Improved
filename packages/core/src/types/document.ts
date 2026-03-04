export interface OrgDoc {
  id: string
  title: string
  content: string
  file_type?: string
}

export interface Template {
  id: string
  title: string
  description?: string
  uploaded: boolean
  my_document_id?: string
}

export interface GoogleFormLink {
  id: string
  title: string
  form_url: string
}

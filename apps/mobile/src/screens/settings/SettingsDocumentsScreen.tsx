import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

interface OrgDocument {
  id: string
  title: string
  content: string
  file_type: string
  is_pinned: boolean
  folder: string
}

interface Template {
  id: string
  title: string
  description: string
  uploaded: boolean
}

interface GoogleForm {
  id: string
  title: string
  form_url: string
}

export function SettingsDocumentsScreen({
  route,
}: RootStackScreenProps<'SettingsDocuments'>) {
  const { orgId } = route.params

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [documents, setDocuments] = useState<OrgDocument[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [forms, setForms] = useState<GoogleForm[]>([])

  const fetchData = useCallback(async () => {
    try {
      const [docsRes, templatesRes, formsRes] = await Promise.all([
        getApi().get<OrgDocument[]>(`/documents/${orgId}`),
        getApi().get<Template[]>(`/documents/${orgId}/templates`),
        getApi().get<GoogleForm[]>(`/documents/${orgId}/google-forms`),
      ])
      setDocuments(docsRes.data)
      setTemplates(templatesRes.data)
      setForms(formsRes.data)
    } catch {
      Alert.alert('Error', 'Failed to load documents.')
    }
  }, [orgId])

  useEffect(() => {
    const init = async () => {
      await fetchData()
      setLoading(false)
    }
    init()
  }, [fetchData])

  const onRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleDeleteDocument = (docId: string, title: string) => {
    Alert.alert('Delete Document', `Are you sure you want to delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await getApi().delete(`/documents/${orgId}/${docId}`)
            setDocuments((prev) => prev.filter((d) => d.id !== docId))
          } catch {
            Alert.alert('Error', 'Failed to delete document.')
          }
        },
      },
    ])
  }

  const handleDeleteTemplate = (templateId: string, title: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await getApi().delete(
                `/documents/${orgId}/templates/${templateId}`,
              )
              setTemplates((prev) => prev.filter((t) => t.id !== templateId))
            } catch {
              Alert.alert('Error', 'Failed to delete template.')
            }
          },
        },
      ],
    )
  }

  const sortedDocuments = [...documents].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    return 0
  })

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#71717a"
        />
      }
    >
      {/* Organization Documents */}
      <Text style={styles.sectionTitle}>Organization Documents</Text>
      {sortedDocuments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="file-text" size={32} color="#71717a" />
          <Text style={styles.emptyText}>No documents yet.</Text>
        </View>
      ) : (
        sortedDocuments.map((doc) => (
          <View key={doc.id} style={styles.card}>
            <View style={styles.row}>
              <Feather name="file-text" size={20} color="#a1a1aa" />
              <View style={styles.itemInfo}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  {doc.is_pinned && (
                    <Feather
                      name="bookmark"
                      size={14}
                      color="#f59e0b"
                      style={styles.pinIcon}
                    />
                  )}
                </View>
                <Text style={styles.itemMeta}>
                  {doc.file_type}
                  {doc.folder ? ` · ${doc.folder}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleDeleteDocument(doc.id, doc.title)}
              >
                <Feather name="trash-2" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Google Forms */}
      {forms.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, styles.sectionGap]}>
            Google Forms
          </Text>
          {forms.map((form) => (
            <TouchableOpacity
              key={form.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => Linking.openURL(form.form_url)}
            >
              <View style={styles.row}>
                <Feather name="link" size={20} color="#a1a1aa" />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {form.title}
                  </Text>
                </View>
                <Feather name="external-link" size={16} color="#71717a" />
              </View>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Required Documents (Templates) */}
      <Text style={[styles.sectionTitle, styles.sectionGap]}>
        Required Documents
      </Text>
      {templates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Feather name="clipboard" size={32} color="#71717a" />
          <Text style={styles.emptyText}>No required documents.</Text>
        </View>
      ) : (
        templates.map((tpl) => (
          <View key={tpl.id} style={styles.card}>
            <View style={styles.row}>
              <Feather name="clipboard" size={20} color="#a1a1aa" />
              <View style={styles.itemInfo}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {tpl.title}
                </Text>
                {!!tpl.description && (
                  <Text style={styles.itemMeta} numberOfLines={2}>
                    {tpl.description}
                  </Text>
                )}
                <Text
                  style={[
                    styles.statusBadge,
                    tpl.uploaded ? styles.statusUploaded : styles.statusPending,
                  ]}
                >
                  {tpl.uploaded ? 'Uploaded' : 'Pending'}
                </Text>
              </View>
              <TouchableOpacity
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => handleDeleteTemplate(tpl.id, tpl.title)}
              >
                <Feather name="trash-2" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 16, paddingBottom: 48 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 10,
  },
  sectionGap: { marginTop: 24 },

  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    flexShrink: 1,
  },
  pinIcon: { marginLeft: 6 },
  itemMeta: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
  },

  statusBadge: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  statusUploaded: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#22c55e',
  },
  statusPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    color: '#f59e0b',
  },

  emptyCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 32,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#71717a',
  },
})

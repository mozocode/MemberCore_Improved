import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { OrgDoc, Template, GoogleFormLink } from '@membercore/core'
import { documentService } from '@membercore/services'
import type { OrgDrawerScreenProps } from '../navigation/types'

export function DocumentsScreen({ route }: OrgDrawerScreenProps<'Documents'>) {
  const orgId = route.params.orgId

  const [orgDocs, setOrgDocs] = useState<OrgDoc[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [googleForms, setGoogleForms] = useState<GoogleFormLink[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    if (!orgId) return
    try {
      const [docs, tmpls, forms] = await Promise.all([
        documentService.listDocuments(orgId),
        documentService.listTemplates(orgId),
        documentService.listFormLinks(orgId),
      ])
      setOrgDocs(docs)
      setTemplates(tmpls)
      setGoogleForms(forms || [])
    } catch {
      setOrgDocs([])
      setTemplates([])
      setGoogleForms([])
    }
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  if (loading) {
    return (
      <View style={styles.centered}>
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="folder" size={20} color="#ffffff" />
          <Text style={styles.sectionTitle}>Organization Documents</Text>
        </View>

        {orgDocs.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color="#52525b" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No documents yet</Text>
          </View>
        ) : (
          orgDocs.map((doc) => (
            <View key={doc.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Feather name="file-text" size={24} color="#71717a" />
                  <Text style={styles.cardTitle}>{doc.title}</Text>
                </View>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => {
                    if (doc.content?.startsWith('http')) {
                      Linking.openURL(doc.content)
                    }
                  }}
                >
                  <Feather name="eye" size={16} color="#a1a1aa" />
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Forms (Google Forms) */}
      {googleForms.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="link" size={20} color="#ffffff" />
            <Text style={styles.sectionTitle}>Forms</Text>
          </View>

          {googleForms.map((form) => (
            <TouchableOpacity
              key={form.id}
              style={styles.card}
              onPress={() => Linking.openURL(form.form_url)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Feather name="link" size={24} color="#71717a" />
                  <Text style={styles.cardTitle}>{form.title}</Text>
                </View>
                <View style={styles.cardRight}>
                  <Feather name="external-link" size={16} color="#a1a1aa" />
                  <Text style={styles.openFormText}>Open form</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Required Documents (Templates) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Feather name="file-text" size={20} color="#ffffff" />
          <Text style={styles.sectionTitle}>Required Documents</Text>
        </View>

        {templates.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color="#52525b" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No required documents</Text>
          </View>
        ) : (
          templates.map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardRow}>
                <View style={styles.cardLeft}>
                  <Feather
                    name={t.uploaded ? 'check' : 'alert-triangle'}
                    size={24}
                    color={t.uploaded ? '#22c55e' : '#f59e0b'}
                  />
                  <View style={styles.templateInfo}>
                    <Text style={styles.cardTitle}>{t.title}</Text>
                    {t.description ? (
                      <Text style={styles.templateDescription}>{t.description}</Text>
                    ) : null}
                    <Text
                      style={[
                        styles.uploadStatus,
                        { color: t.uploaded ? '#4ade80' : '#fbbf24' },
                      ]}
                    >
                      {t.uploaded ? 'Uploaded' : 'Not uploaded'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
    flexShrink: 1,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  viewButtonText: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  openFormText: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  templateInfo: {
    flex: 1,
  },
  templateDescription: {
    fontSize: 13,
    color: '#71717a',
    marginTop: 2,
  },
  uploadStatus: {
    fontSize: 12,
    marginTop: 4,
  },
  emptyState: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#a1a1aa',
  },
})

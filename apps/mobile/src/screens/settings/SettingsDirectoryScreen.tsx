import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

/* ───── Organisation type categories ───── */

interface TypeOption {
  label: string
  value: string
}

interface TypeCategory {
  category: string
  options: TypeOption[]
}

const ORG_TYPE_CATEGORIES: TypeCategory[] = [
  {
    category: 'Greek Life',
    options: [
      { label: 'Fraternity', value: 'Fraternity' },
      { label: 'Sorority', value: 'Sorority' },
    ],
  },
  {
    category: 'Social',
    options: [
      { label: 'Social Club', value: 'Social Club' },
      { label: 'Community Group', value: 'Community Group' },
    ],
  },
  {
    category: 'Sports & Recreation',
    options: [
      { label: 'Sports Club', value: 'Sports Club' },
      { label: 'Motorcycle Club', value: 'Motorcycle Club' },
      { label: 'Car Club', value: 'Car Club' },
    ],
  },
  {
    category: 'Professional & Education',
    options: [
      { label: 'Professional Organization', value: 'Professional Organization' },
      { label: 'Alumni Association', value: 'Alumni Association' },
      { label: 'Student Organization', value: 'Student Organization' },
    ],
  },
  {
    category: 'Other',
    options: [
      { label: 'Nonprofit', value: 'Nonprofit' },
      { label: 'Religious Organization', value: 'Religious Organization' },
      { label: 'Other', value: 'Other' },
    ],
  },
]

const CULTURAL_IDENTITIES = [
  { label: 'None', value: 'none' },
  { label: 'Black / African American', value: 'Black / African American' },
  { label: 'Hispanic / Latino', value: 'Hispanic / Latino' },
  { label: 'Asian / Pacific Islander', value: 'Asian / Pacific Islander' },
  { label: 'Native American', value: 'Native American' },
  { label: 'Middle Eastern', value: 'Middle Eastern' },
  { label: 'European / White', value: 'European / White' },
  { label: 'Caribbean', value: 'Caribbean' },
  { label: 'South Asian', value: 'South Asian' },
  { label: 'East Asian', value: 'East Asian' },
  { label: 'Southeast Asian', value: 'Southeast Asian' },
  { label: 'Mixed / Multiracial', value: 'Mixed / Multiracial' },
  { label: 'Other', value: 'Other' },
]

/* ───── Component ───── */

export function SettingsDirectoryScreen({
  route,
}: RootStackScreenProps<'SettingsDirectory'>) {
  const { orgId } = route.params

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [orgType, setOrgType] = useState('')
  const [sportType, setSportType] = useState('')
  const [culturalIdentity, setCulturalIdentity] = useState('none')

  const [typeModalVisible, setTypeModalVisible] = useState(false)
  const [cultureModalVisible, setCultureModalVisible] = useState(false)

  const fetchOrg = useCallback(async () => {
    try {
      const res = await getApi().get(`/organizations/${orgId}`)
      setOrgType(res.data.type || '')
      setSportType(res.data.sport_type || '')
      setCulturalIdentity(res.data.cultural_identity || 'none')
    } catch {
      setMessage({ type: 'error', text: 'Failed to load organization settings.' })
    }
  }, [orgId])

  useEffect(() => {
    fetchOrg().finally(() => setLoading(false))
  }, [fetchOrg])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await getApi().put(`/organizations/${orgId}`, {
        type: orgType,
        sport_type: orgType === 'Sports Club' ? sportType.trim() : '',
        cultural_identity: culturalIdentity,
      })
      setMessage({ type: 'success', text: 'Directory settings saved.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setSaving(false)
    }
  }

  /* ───── Flat data for the type picker FlatList (sections flattened) ───── */
  type PickerItem =
    | { kind: 'header'; category: string }
    | { kind: 'option'; label: string; value: string }

  const typePickerData: PickerItem[] = ORG_TYPE_CATEGORIES.flatMap((cat) => [
    { kind: 'header' as const, category: cat.category },
    ...cat.options.map((o) => ({ kind: 'option' as const, ...o })),
  ])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Organization Type */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Directory Listing</Text>

        <Text style={styles.label}>Organization Type</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          activeOpacity={0.7}
          onPress={() => setTypeModalVisible(true)}
        >
          <Text
            style={[styles.pickerText, !orgType && styles.pickerPlaceholder]}
          >
            {orgType || 'Select type…'}
          </Text>
          <Feather name="chevron-down" size={18} color="#a1a1aa" />
        </TouchableOpacity>

        {/* Sport Type — visible only when Sports Club */}
        {orgType === 'Sports Club' && (
          <>
            <Text style={styles.label}>Sport Type</Text>
            <TextInput
              style={styles.input}
              value={sportType}
              onChangeText={setSportType}
              placeholder="e.g. Basketball, Soccer"
              placeholderTextColor="#71717a"
            />
          </>
        )}

        {/* Cultural Identity */}
        <Text style={styles.label}>Cultural Identity</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          activeOpacity={0.7}
          onPress={() => setCultureModalVisible(true)}
        >
          <Text style={styles.pickerText}>
            {CULTURAL_IDENTITIES.find((c) => c.value === culturalIdentity)
              ?.label || 'None'}
          </Text>
          <Feather name="chevron-down" size={18} color="#a1a1aa" />
        </TouchableOpacity>
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        activeOpacity={0.8}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>

      {/* Message */}
      {message && (
        <View
          style={[
            styles.messageBox,
            message.type === 'success' ? styles.successBox : styles.errorBox,
          ]}
        >
          <Feather
            name={message.type === 'success' ? 'check-circle' : 'alert-circle'}
            size={16}
            color={message.type === 'success' ? '#22c55e' : '#ef4444'}
          />
          <Text
            style={[
              styles.messageText,
              { color: message.type === 'success' ? '#22c55e' : '#ef4444' },
            ]}
          >
            {message.text}
          </Text>
        </View>
      )}

      {/* ───── Organization Type Modal ───── */}
      <Modal
        visible={typeModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setTypeModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Organization Type</Text>
            <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
              <Feather name="x" size={24} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={typePickerData}
            keyExtractor={(item, idx) =>
              item.kind === 'header' ? `h-${item.category}` : `o-${idx}`
            }
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              if (item.kind === 'header') {
                return (
                  <Text style={styles.categoryHeader}>{item.category}</Text>
                )
              }
              const selected = item.value === orgType
              return (
                <TouchableOpacity
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setOrgType(item.value)
                    if (item.value !== 'Sports Club') setSportType('')
                    setTypeModalVisible(false)
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selected && (
                    <Feather name="check" size={18} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>

      {/* ───── Cultural Identity Modal ───── */}
      <Modal
        visible={cultureModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCultureModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cultural Identity</Text>
            <TouchableOpacity onPress={() => setCultureModalVisible(false)}>
              <Feather name="x" size={24} color="#a1a1aa" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={CULTURAL_IDENTITIES}
            keyExtractor={(item) => item.value}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const selected = item.value === culturalIdentity
              return (
                <TouchableOpacity
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setCulturalIdentity(item.value)
                    setCultureModalVisible(false)
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selected && styles.optionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {selected && (
                    <Feather name="check" size={18} color="#22c55e" />
                  )}
                </TouchableOpacity>
              )
            }}
          />
        </View>
      </Modal>
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

  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },

  label: { fontSize: 13, color: '#a1a1aa', marginBottom: 6, marginTop: 12 },

  input: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.6)',
  },

  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.6)',
  },
  pickerText: { fontSize: 15, color: '#ffffff' },
  pickerPlaceholder: { color: '#71717a' },

  saveButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#000000' },

  messageBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  successBox: { backgroundColor: 'rgba(34,197,94,0.1)' },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)' },
  messageText: { fontSize: 13, fontWeight: '500', flex: 1 },

  /* Modal */
  modalContainer: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39,39,42,0.8)',
  },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#ffffff' },
  modalList: { paddingHorizontal: 16, paddingBottom: 32 },

  categoryHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 8,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#18181b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.5)',
  },
  optionRowSelected: {
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  optionText: { fontSize: 15, color: '#d4d4d8' },
  optionTextSelected: { color: '#ffffff', fontWeight: '600' },
})

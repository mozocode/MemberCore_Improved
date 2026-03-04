import React, { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { Feather } from '@expo/vector-icons'
import { directoryService } from '@membercore/services'

export type CsvMemberRow = {
  id: string
  firstName: string
  lastName?: string
  email: string
  role?: string
  status: 'ready' | 'missing_email' | 'invalid_email'
  selected: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1
      while (end < line.length) {
        const next = line.indexOf('"', end)
        if (next === -1) {
          end = line.length
          break
        }
        if (line[next + 1] === '"') {
          end = next + 2
          continue
        }
        end = next
        break
      }
      out.push(line.slice(i + 1, end).replace(/""/g, '"'))
      i = end + 1
      if (line[i] === ',') i++
      continue
    }
    const comma = line.indexOf(',', i)
    if (comma === -1) {
      out.push(line.slice(i).trim())
      break
    }
    out.push(line.slice(i, comma).trim())
    i = comma + 1
  }
  return out
}

function parseCsvToRows(csvText: string): CsvMemberRow[] {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headerRow = parseCsvLine(lines[0])
  const headerLower = headerRow.map((h) => (h || '').toLowerCase())
  const idx = (name: string) => {
    const n = name.toLowerCase()
    const i = headerLower.indexOf(n)
    if (i >= 0) return i
    const alt = name.replace(/_/g, ' ').toLowerCase()
    return headerLower.findIndex((h) => h === alt)
  }
  const firstIdx = idx('first_name') >= 0 ? idx('first_name') : idx('first name')
  const lastIdx = idx('last_name') >= 0 ? idx('last_name') : idx('last name')
  const emailIdx = idx('email')
  const roleIdx = idx('role') >= 0 ? idx('role') : -1

  if (emailIdx < 0) return []

  const rows: CsvMemberRow[] = []
  for (let r = 1; r < lines.length; r++) {
    const cells = parseCsvLine(lines[r])
    const email = (cells[emailIdx] || '').trim()
    let status: CsvMemberRow['status'] = 'ready'
    if (!email) status = 'missing_email'
    else if (!EMAIL_RE.test(email)) status = 'invalid_email'

    rows.push({
      id: `row-${r}`,
      firstName: (cells[firstIdx] || '').trim(),
      lastName: (cells[lastIdx] || '').trim(),
      email,
      role: roleIdx >= 0 && cells[roleIdx] ? (cells[roleIdx] || '').trim() : undefined,
      status,
      selected: status === 'ready',
    })
  }
  return rows
}

interface BulkImportMembersModalProps {
  visible: boolean
  onClose: () => void
  orgId: string
  onSuccess?: () => void
}

export function BulkImportMembersModal({
  visible,
  onClose,
  orgId,
  onSuccess,
}: BulkImportMembersModalProps) {
  const [pickedFile, setPickedFile] = useState<{
    uri: string
    name: string
  } | null>(null)
  const [rows, setRows] = useState<CsvMemberRow[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const validCount = useMemo(() => rows.filter((r) => r.selected && r.status === 'ready').length, [rows])
  const issueCount = useMemo(() => rows.filter((r) => r.status !== 'ready').length, [rows])

  const reset = useCallback(() => {
    setPickedFile(null)
    setRows([])
    setParseError(null)
    setUploading(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const pickFile = useCallback(async () => {
    setParseError(null)
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'text/csv',
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const file = result.assets[0]
      if (!file.uri) return
      const content = await FileSystem.readAsStringAsync(file.uri, { encoding: 'utf8' })
      const parsed = parseCsvToRows(content)
      if (parsed.length === 0) {
        setParseError("We couldn't read that file. Please check the format (need header with 'email').")
        setRows([])
        setPickedFile(null)
        return
      }
      setPickedFile({ uri: file.uri, name: file.name || 'import.csv' })
      setRows(parsed)
    } catch (e) {
      setParseError("We couldn't read that file. Please check the format.")
      setRows([])
      setPickedFile(null)
    }
  }, [])

  const toggleRow = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id && r.status === 'ready' ? { ...r, selected: !r.selected } : r)),
    )
  }, [])

  const handleImport = useCallback(async () => {
    if (!pickedFile || validCount === 0) return
    setUploading(true)
    try {
      const result = await directoryService.importMembersFromCsv(
        orgId,
        { uri: pickedFile.uri, name: pickedFile.name, type: 'text/csv' },
        { sendInvites: true },
      )
      setUploading(false)
      const inviteMsg =
        result.invites_sent != null
          ? ` Sent ${result.invites_sent} invitation${result.invites_sent !== 1 ? 's' : ''}.`
          : ''
      Alert.alert(
        'Import complete',
        `Imported ${result.imported_count} member${result.imported_count !== 1 ? 's' : ''}.${inviteMsg} ${result.skipped_count} row(s) skipped.`,
        [{ text: 'OK', onPress: () => { onSuccess?.(); handleClose() } }],
      )
    } catch (err: any) {
      setUploading(false)
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data?.detail === 'object' && err?.response?.data?.detail?.[0]?.msg)
          ? String(err.response.data.detail)
          : 'Import failed. Please try again.'
      Alert.alert('Import failed', typeof msg === 'string' ? msg : 'Please try again.')
    }
  }, [orgId, pickedFile, validCount, onSuccess, handleClose])

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Bulk Import from CSV</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <Feather name="x" size={24} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          {!pickedFile ? (
            <View style={styles.pickSection}>
              {parseError ? (
                <Text style={styles.errorText}>{parseError}</Text>
              ) : null}
              <TouchableOpacity style={styles.pickButton} onPress={pickFile} activeOpacity={0.7}>
                <Feather name="upload-cloud" size={24} color="#3b82f6" />
                <Text style={styles.pickButtonText}>Select CSV file</Text>
                <Text style={styles.pickHint}>Columns: first_name, last_name, email, role</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.summary}>
                <Text style={styles.summaryText}>
                  {validCount} valid row{validCount !== 1 ? 's' : ''} selected
                  {issueCount > 0 ? `, ${issueCount} with issues` : ''}
                </Text>
              </View>
              <ScrollView style={styles.listScroll} contentContainerStyle={styles.listContent}>
                {rows.map((row) => (
                  <View key={row.id} style={styles.row}>
                    <View style={styles.rowLeft}>
                      {row.status === 'ready' ? (
                        <Switch
                          value={row.selected}
                          onValueChange={() => toggleRow(row.id)}
                          trackColor={{ false: '#3f3f46', true: '#3b82f6' }}
                          thumbColor="#fff"
                        />
                      ) : (
                        <View style={styles.switchPlaceholder} />
                      )}
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {row.firstName} {row.lastName}
                        </Text>
                        <Text style={styles.rowEmail} numberOfLines={1}>
                          {row.email || '(no email)'}
                        </Text>
                        {row.role ? (
                          <Text style={styles.rowRole}>{row.role}</Text>
                        ) : null}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        row.status === 'ready' ? styles.statusReady : styles.statusError,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          row.status === 'ready' ? styles.statusTextReady : styles.statusTextError,
                        ]}
                      >
                        {row.status === 'ready'
                          ? 'Ready'
                          : row.status === 'missing_email'
                            ? 'Missing email'
                            : 'Invalid email'}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.importButton, validCount === 0 && styles.importButtonDisabled]}
                  onPress={handleImport}
                  disabled={validCount === 0 || uploading}
                  activeOpacity={0.7}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.importButtonText}>Import & Send Invites</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.changeFileButton} onPress={reset}>
                  <Text style={styles.changeFileText}>Choose a different file</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  pickSection: { padding: 24, alignItems: 'center' },
  errorText: { color: '#ef4444', marginBottom: 12, textAlign: 'center' },
  pickButton: {
    backgroundColor: '#27272a',
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  pickButtonText: { color: '#3b82f6', fontSize: 16, fontWeight: '600', marginTop: 8 },
  pickHint: { color: '#71717a', fontSize: 12, marginTop: 6 },
  summary: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  summaryText: { color: '#a1a1aa', fontSize: 14 },
  listScroll: { maxHeight: 320 },
  listContent: { paddingHorizontal: 20, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  switchPlaceholder: { width: 51, height: 31 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  rowEmail: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  rowRole: { color: '#71717a', fontSize: 11, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusReady: { backgroundColor: 'rgba(34,197,94,0.2)' },
  statusError: { backgroundColor: 'rgba(239,68,68,0.2)' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextReady: { color: '#22c55e' },
  statusTextError: { color: '#ef4444' },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
  importButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  importButtonDisabled: { opacity: 0.5 },
  importButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  changeFileButton: { alignItems: 'center', marginTop: 12 },
  changeFileText: { color: '#71717a', fontSize: 14 },
})

import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { getApi } from '@membercore/services'
import { useAuth } from '../../contexts/AuthContext'
import type { RootStackScreenProps } from '../../navigation/types'

interface MemberSettings {
  nickname: string
  title: string
  mute_notifications: boolean
  role: string
}

export function SettingsPersonalScreen({
  route,
  navigation,
}: RootStackScreenProps<'SettingsPersonal'>) {
  const { orgId } = route.params
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [avatarUri, setAvatarUri] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [phone, setPhone] = useState('')
  const [nickname, setNickname] = useState('')
  const [title, setTitle] = useState('')
  const [muteNotifications, setMuteNotifications] = useState(false)
  const [role, setRole] = useState('member')

  const fetchSettings = useCallback(async () => {
    try {
      const res = await getApi().get<MemberSettings>(
        `/organizations/${orgId}/members/me`,
      )
      setNickname(res.data.nickname || '')
      setTitle(res.data.title || '')
      setMuteNotifications(res.data.mute_notifications ?? false)
      setRole(res.data.role || 'member')
    } catch {
      setMessage({ type: 'error', text: 'Failed to load settings.' })
    }
  }, [orgId])

  useEffect(() => {
    const init = async () => {
      await fetchSettings()
      if (user?.phone_number) {
        setPhone(user.phone_number)
      }
      setLoading(false)
    }
    init()
  }, [fetchSettings, user])

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library to change your avatar.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any)
      await getApi().put('/auth/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setAvatarUri(asset.uri)
      setMessage({ type: 'success', text: 'Profile photo updated.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload photo.' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await getApi().put(`/organizations/${orgId}/members/me/settings`, {
        nickname: nickname.trim(),
        title: title.trim(),
        mute_notifications: muteNotifications,
      })

      const trimmedPhone = phone.trim()
      if (trimmedPhone !== (user?.phone_number || '')) {
        await getApi().put('/auth/me', { phone_number: trimmedPhone })
      }

      setMessage({ type: 'success', text: 'Settings saved successfully.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' })
    } finally {
      setSaving(false)
    }
  }

  const handleLeave = () => {
    if (role === 'owner') {
      Alert.alert(
        'Cannot Leave',
        'As the owner, you cannot leave this organization. Transfer ownership first.',
      )
      return
    }

    Alert.alert(
      'Leave Organization',
      'Are you sure you want to leave this organization? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setLeaving(true)
            setMessage(null)
            try {
              await getApi().post(
                `/organizations/${orgId}/members/me/leave`,
              )
              navigation.reset({ index: 0, routes: [{ name: 'OrgSelector' }] })
            } catch {
              setMessage({ type: 'error', text: 'Failed to leave organization.' })
              setLeaving(false)
            }
          },
        },
      ],
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.7} disabled={uploadingAvatar}>
            {avatarUri || user?.avatar ? (
              <Image source={{ uri: avatarUri || user?.avatar || '' }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Feather name="user" size={24} color="#a1a1aa" />
              </View>
            )}
            <View style={styles.avatarBadge}>
              {uploadingAvatar ? (
                <ActivityIndicator size={10} color="#ffffff" />
              ) : (
                <Feather name="camera" size={10} color="#ffffff" />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'Unknown'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
        </View>
      </View>

      {/* Form Fields */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact</Text>

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="Enter phone number"
          placeholderTextColor="#71717a"
          keyboardType="phone-pad"
          autoCapitalize="none"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Organization Profile</Text>

        <Text style={styles.label}>Nickname</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={(t) => setNickname(t.slice(0, 50))}
          placeholder="Enter nickname"
          placeholderTextColor="#71717a"
          maxLength={50}
        />
        <Text style={styles.charCount}>{nickname.length}/50</Text>

        <Text style={styles.label}>Title / Position</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, 50))}
          placeholder="Enter title or position"
          placeholderTextColor="#71717a"
          maxLength={50}
        />
        <Text style={styles.charCount}>{title.length}/50</Text>
      </View>

      {/* Mute Notifications */}
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>Mute Notifications</Text>
            <Text style={styles.switchDesc}>
              Silence all push notifications for this organization.
            </Text>
          </View>
          <Switch
            value={muteNotifications}
            onValueChange={setMuteNotifications}
            trackColor={{ false: '#3f3f46', true: '#22c55e' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Save Button */}
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

      {/* Danger Zone */}
      <View style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDesc}>
          Leaving the organization will remove your membership and all associated
          data. This cannot be undone.
        </Text>
        <TouchableOpacity
          style={styles.leaveButton}
          activeOpacity={0.8}
          onPress={handleLeave}
          disabled={leaving}
        >
          {leaving ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Feather name="log-out" size={16} color="#ffffff" />
              <Text style={styles.leaveButtonText}>Leave Organization</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
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

  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#18181b',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  profileEmail: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },

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
  charCount: {
    fontSize: 11,
    color: '#71717a',
    textAlign: 'right',
    marginTop: 4,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchInfo: { flex: 1, marginRight: 12 },
  switchLabel: { fontSize: 15, fontWeight: '500', color: '#ffffff' },
  switchDesc: { fontSize: 13, color: '#a1a1aa', marginTop: 2 },

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

  dangerCard: {
    borderColor: 'rgba(239,68,68,0.3)',
    marginTop: 8,
  },
  dangerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
  },
  dangerDesc: { fontSize: 13, color: '#a1a1aa', lineHeight: 18, marginBottom: 12 },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
  },
  leaveButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
})

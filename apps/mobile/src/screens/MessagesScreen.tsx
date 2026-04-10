import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ListSkeleton } from '../components/ListSkeleton'
import { useAuth } from '../contexts/AuthContext'
import type { OrgDrawerScreenProps } from '../navigation/types'

const MAX_ATTACHMENT_DATA_URL_LENGTH = 680_000

interface Conversation {
  id: string
  other_user_id?: string
  other_user_name?: string
  other_user_email?: string
  other_user_avatar?: string
  participants?: string[]
  participant_details?: Record<string, { name?: string; email?: string; avatar?: string }>
  other_participant?: { id: string; name?: string; email?: string; avatar?: string }
  last_message?: string | { text?: string; content?: string; sender_id?: string; sent_at?: string } | null
  last_message_at?: string
  updated_at?: string | null
  unread_count?: number
}

interface DmMessage {
  id: string
  sender_id: string
  content?: string
  text?: string
  image_data_url?: string
  created_at?: string
  sent_at?: string
}

interface OrgMember {
  user_id: string
  name?: string
  email?: string
  avatar?: string
  initial?: string
}

export function MessagesScreen({ route, navigation }: OrgDrawerScreenProps<'Messages'>) {
  const { orgId } = route.params
  const { user } = useAuth()
  const insets = useSafeAreaInsets()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<DmMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [input, setInput] = useState('')
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [memberSearch, setMemberSearch] = useState('')
  const [membersLoading, setMembersLoading] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const [composerHeight, setComposerHeight] = useState(96)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flatListRef = useRef<FlatList>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const api = getApi()

  const fetchConversations = useCallback(async () => {
    try {
      const { data } = await api.get(`/organizations/${orgId}/dm/conversations`)
      setConversations(data || [])
    } catch {
      setConversations([])
    }
  }, [orgId])

  useEffect(() => {
    fetchConversations().finally(() => setLoading(false))
    pollRef.current = setInterval(fetchConversations, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setShowNewMessage(true)}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={26} color="#ffffff" />
        </TouchableOpacity>
      ),
    })
  }, [navigation])

  const fetchMessages = useCallback(async (convId: string) => {
    setMsgLoading(true)
    try {
      const { data } = await api.get(`/organizations/${orgId}/dm/conversations/${convId}/messages`)
      setMessages(Array.isArray(data) ? data : data?.messages || [])
    } catch {
      setMessages([])
    } finally {
      setMsgLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    if (!activeConvId) return
    fetchMessages(activeConvId)
    api.post(`/organizations/${orgId}/dm/conversations/${activeConvId}/read`).catch(() => {})
    const interval = setInterval(() => fetchMessages(activeConvId), 3000)
    return () => clearInterval(interval)
  }, [activeConvId, fetchMessages, orgId])

  const sendTypingIndicator = useCallback(() => {
    if (!activeConvId) return
    api.post(`/organizations/${orgId}/dm/conversations/${activeConvId}/typing`).catch(() => {})
  }, [orgId, activeConvId])

  const handleInputChange = useCallback((text: string) => {
    setInput(text)
    if (text.trim()) {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
      sendTypingIndicator()
      typingTimerRef.current = setTimeout(() => {}, 3000)
    }
  }, [sendTypingIndicator])

  useEffect(() => {
    if (!activeConvId) return
    const checkTyping = async () => {
      try {
        const { data } = await api.get(`/organizations/${orgId}/dm/conversations/${activeConvId}/typing`)
        if (data?.is_typing) {
          setTypingUsers((prev) => ({ ...prev, [activeConvId]: true }))
          setTimeout(() => setTypingUsers((prev) => ({ ...prev, [activeConvId]: false })), 4000)
        }
      } catch {
        // typing endpoint may not exist yet; degrade gracefully
      }
    }
    const interval = setInterval(checkTyping, 3000)
    return () => clearInterval(interval)
  }, [orgId, activeConvId])

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !selectedImageDataUrl) || !activeConvId) return
    setSending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const bodyText = input.trim()
    try {
      await api.post(`/organizations/${orgId}/dm/conversations/${activeConvId}/messages`, {
        content: bodyText,
        text: bodyText,
        image_data_url: selectedImageDataUrl,
      })
      setInput('')
      setSelectedImageDataUrl(null)
      setSelectedImageName(null)
      fetchMessages(activeConvId)
    } catch {
      // silently fail
    } finally {
      setSending(false)
    }
  }, [input, activeConvId, orgId, fetchMessages])

  const pickImageForMessage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow photo library access to attach images.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.5,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    try {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: 'base64',
      })
      const mime = asset.mimeType || 'image/jpeg'
      const dataUrl = `data:${mime};base64,${b64}`
      if (dataUrl.length > MAX_ATTACHMENT_DATA_URL_LENGTH) {
        Alert.alert('Image Too Large', 'Please choose a smaller image.')
        return
      }
      setSelectedImageDataUrl(dataUrl)
      setSelectedImageName(asset.fileName || 'Image')
    } catch {
      Alert.alert('Attachment Failed', 'Could not read that image. Please try another one.')
    }
  }, [])

  const handleDeleteMessage = useCallback(async (msg: DmMessage) => {
    if (!activeConvId || !msg?.id) return
    try {
      await api.delete(`/organizations/${orgId}/dm/conversations/${activeConvId}/messages/${msg.id}`)
      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
      fetchConversations()
    } catch {
      Alert.alert('Delete Failed', 'Could not delete that message. Please try again.')
    }
  }, [activeConvId, orgId, fetchConversations])

  const openMessageActions = useCallback((msg: DmMessage) => {
    Alert.alert(
      'Message Actions',
      'What would you like to do?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Message',
          style: 'destructive',
          onPress: () => {
            handleDeleteMessage(msg)
          },
        },
      ],
    )
  }, [handleDeleteMessage])

  const openNewMessageModal = useCallback(async () => {
    setShowNewMessage(true)
    setMembersLoading(true)
    try {
      const { data } = await api.get(`/organizations/${orgId}/dm/members`)
      const list: OrgMember[] = (data || [])
        .map((m: any) => ({
          user_id: m.id || m.user_id,
          name: (m.name && String(m.name).trim()) || 'Member',
          email: m.email,
          avatar: m.avatar,
          initial: ((m.name && String(m.name).trim()) || '?').charAt(0).toUpperCase(),
        }))
      setMembers(list)
    } catch {
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [orgId])

  const startConversation = useCallback(async (otherUserId: string) => {
    try {
      const { data } = await api.post(`/organizations/${orgId}/dm/conversations`, {
        other_user_id: otherUserId,
      })
      setShowNewMessage(false)
      setMemberSearch('')
      setActiveConvId(data.id)
      fetchConversations()
    } catch {
      // silently fail
    }
  }, [orgId, fetchConversations])

  const filteredMembers = members.filter((m) => {
    const q = memberSearch.toLowerCase()
    return (m.name || '').toLowerCase().includes(q) || (m.email || '').toLowerCase().includes(q)
  })

  // Chat view when a conversation is selected
  if (activeConvId) {
    const conv = conversations.find((c) => c.id === activeConvId)
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        {/* Chat header */}
        <View style={[styles.chatHeader, { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setActiveConvId(null)}
            activeOpacity={0.7}
          >
            <Feather name="arrow-left" size={22} color="#ffffff" />
          </TouchableOpacity>
          {(conv?.other_participant?.avatar || conv?.other_user_avatar) ? (
            <Image source={{ uri: conv?.other_participant?.avatar || conv?.other_user_avatar || '' }} style={styles.chatAvatar} />
          ) : (
            <View style={styles.chatAvatarPlaceholder}>
              <Text style={styles.chatAvatarLetter}>
                {(conv?.other_participant?.name || conv?.other_user_name || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.chatHeaderName} numberOfLines={1}>
              {conv?.other_participant?.name || conv?.other_user_name || 'Conversation'}
            </Text>
            {typingUsers[activeConvId] ? (
              <Text style={styles.typingText}>typing...</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.chatBody}>
          {/* Messages */}
          {msgLoading && messages.length === 0 ? (
            <View style={[styles.center, { paddingBottom: composerHeight }]}>
              <ActivityIndicator size="large" color="#71717a" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={[
                styles.msgList,
                { paddingBottom: composerHeight + 8, paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right },
              ]}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              initialNumToRender={20}
              maxToRenderPerBatch={15}
              windowSize={11}
              removeClippedSubviews={true}
              directionalLockEnabled
              alwaysBounceHorizontal={false}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const isMe = item.sender_id === user?.id
                const messageText = item.content || item.text || ''
                const messageTime = item.created_at || item.sent_at || ''
                return (
                  <View style={[styles.dmBubbleRow, isMe && styles.dmBubbleRowMe]}>
                    <View style={[styles.dmBubbleStack, isMe && styles.dmBubbleStackMe]}>
                      {isMe ? (
                        <TouchableOpacity
                          style={styles.dmMessageActionsInlineBtn}
                          onPress={() => openMessageActions(item)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Feather name="more-horizontal" size={16} color="#a1a1aa" />
                        </TouchableOpacity>
                      ) : null}
                      <View style={[styles.dmBubble, isMe ? styles.dmBubbleMe : styles.dmBubbleOther]}>
                        {item.image_data_url ? (
                          <Image
                            source={{ uri: item.image_data_url }}
                            style={styles.dmBubbleImage}
                            resizeMode="cover"
                          />
                        ) : null}
                        {messageText ? (
                          <Text style={[styles.dmBubbleText, isMe && styles.dmBubbleTextMe]}>
                            {messageText}
                          </Text>
                        ) : null}
                        <Text style={styles.dmBubbleTime}>
                          {messageTime ? new Date(messageTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="message-square" size={48} color="#71717a" style={{ opacity: 0.5 }} />
                  <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
                </View>
              }
            />
          )}

          {/* Fixed composer */}
          <View
            style={[styles.chatComposer, { paddingBottom: Math.max(insets.bottom, 12) }]}
            onLayout={(e) => {
              const h = Math.ceil(e.nativeEvent.layout.height)
              if (h > 0 && h !== composerHeight) setComposerHeight(h)
            }}
          >
            {selectedImageDataUrl ? (
              <View style={[styles.attachmentPreview, { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
                <Image source={{ uri: selectedImageDataUrl }} style={styles.attachmentPreviewImage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.attachmentPreviewName} numberOfLines={1}>
                    {selectedImageName || 'Image selected'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setSelectedImageDataUrl(null)
                    setSelectedImageName(null)
                  }}
                  style={styles.attachmentRemoveBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color="#a1a1aa" />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={[styles.inputBar, { paddingLeft: 16 + insets.left, paddingRight: 16 + insets.right }]}>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={pickImageForMessage}
                disabled={sending}
              >
                <Feather name="paperclip" size={18} color="#d4d4d8" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="Type a message..."
                placeholderTextColor="#71717a"
                value={input}
                onChangeText={handleInputChange}
                multiline
              />
              <TouchableOpacity
                style={[styles.sendBtn, ((!input.trim() && !selectedImageDataUrl) || sending) && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={(!input.trim() && !selectedImageDataUrl) || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Feather name="send" size={18} color="#000000" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    )
  }

  // Conversation list view
  return (
    <View style={styles.container}>
      {/* New message modal */}
      <Modal visible={showNewMessage} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Message</Text>
              <TouchableOpacity onPress={() => { setShowNewMessage(false); setMemberSearch('') }}>
                <Feather name="x" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search members..."
              placeholderTextColor="#71717a"
              value={memberSearch}
              onChangeText={setMemberSearch}
              autoFocus
            />
            {membersLoading ? (
              <ActivityIndicator size="small" color="#71717a" style={{ marginTop: 24 }} />
            ) : (
              <FlatList
                data={filteredMembers}
                keyExtractor={(m) => m.user_id}
                style={styles.memberList}
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={11}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.memberRow}
                    onPress={() => startConversation(item.user_id)}
                    activeOpacity={0.7}
                  >
                    {item.avatar ? (
                      <Image source={{ uri: item.avatar }} style={styles.memberAvatar} />
                    ) : (
                      <View style={styles.memberAvatarPlaceholder}>
                        <Text style={styles.memberInitial}>{item.initial}</Text>
                      </View>
                    )}
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{item.name}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.noMembers}>No members found</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {loading ? (
        <View style={styles.convList}>
          <ListSkeleton count={5} />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="mail" size={48} color="#71717a" style={{ opacity: 0.5 }} />
          <Text style={styles.emptyTitle}>Your Messages</Text>
          <Text style={styles.emptyText}>Select a conversation or start a new one</Text>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={openNewMessageModal}
            activeOpacity={0.7}
          >
            <Text style={styles.startBtnText}>Start a Conversation</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.convList}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews={true}
          renderItem={({ item }) => {
            const otherName = item.other_participant?.name || item.other_user_name
            const otherAvatar = item.other_participant?.avatar || item.other_user_avatar
            const displayName = otherName || 'Member'
            const timeStr = item.updated_at || item.last_message_at || (typeof item.last_message === 'object' && item.last_message?.sent_at) || ''
            return (
              <TouchableOpacity
                style={[styles.convItem, activeConvId === item.id && styles.convItemActive]}
                onPress={() => setActiveConvId(item.id)}
                activeOpacity={0.7}
              >
                {otherAvatar ? (
                  <Image source={{ uri: otherAvatar }} style={styles.convAvatar} />
                ) : (
                  <View style={styles.convAvatarPlaceholder}>
                    <Text style={styles.convAvatarLetter}>
                      {(displayName).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.convInfo}>
                  <View style={styles.convTopRow}>
                    <Text style={styles.convName} numberOfLines={1}>
                      {displayName}
                    </Text>
                    {timeStr ? (
                      <Text style={styles.convTime}>
                        {new Date(timeStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.convBottomRow}>
                    <Text style={styles.convLastMsg} numberOfLines={1}>
                      {typeof item.last_message === 'string'
                        ? item.last_message
                        : item.last_message?.text || item.last_message?.content || 'No messages yet'}
                    </Text>
                    {(item.unread_count ?? 0) > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },

  headerBtn: {
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Conversation list
  convList: { paddingVertical: 4 },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#18181b',
  },
  convItemActive: { backgroundColor: '#18181b' },
  convAvatar: { width: 44, height: 44, borderRadius: 22 },
  convAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  convAvatarLetter: { color: '#a1a1aa', fontSize: 18, fontWeight: '600' },
  convInfo: { flex: 1, minWidth: 0 },
  convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  convName: { color: '#ffffff', fontSize: 15, fontWeight: '600', flex: 1 },
  convTime: { color: '#71717a', fontSize: 12, marginLeft: 8 },
  convBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  convLastMsg: { color: '#71717a', fontSize: 14, flex: 1 },
  unreadBadge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  // Chat view
  chatBody: { flex: 1, position: 'relative', overflow: 'hidden' },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#000000',
  },
  backBtn: { padding: 4 },
  chatAvatar: { width: 32, height: 32, borderRadius: 16 },
  chatAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatAvatarLetter: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },
  chatHeaderName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  typingText: { color: '#71717a', fontSize: 12, marginTop: 1 },

  // Messages
  msgList: { paddingVertical: 12 },
  dmBubbleRow: { flexDirection: 'row', marginBottom: 8 },
  dmBubbleRowMe: { justifyContent: 'flex-end' },
  dmBubbleStack: { alignItems: 'flex-start' },
  dmBubbleStackMe: { alignItems: 'flex-end' },
  dmBubble: { maxWidth: '80%', borderRadius: 16, padding: 12, paddingBottom: 6 },
  dmBubbleMe: { backgroundColor: '#3b82f6', borderBottomRightRadius: 4 },
  dmBubbleOther: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderBottomLeftRadius: 4 },
  dmBubbleImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#27272a',
  },
  dmBubbleText: { color: '#d4d4d8', fontSize: 15, lineHeight: 20 },
  dmBubbleTextMe: { color: '#ffffff' },
  dmBubbleTime: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4, textAlign: 'right' },
  dmMessageActionsInlineBtn: {
    width: 30,
    height: 30,
    marginBottom: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#18181b',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },

  attachmentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    backgroundColor: '#09090b',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  attachmentPreviewImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  attachmentPreviewName: { color: '#a1a1aa', fontSize: 12 },
  attachmentRemoveBtn: { padding: 4 },

  // Input
  chatComposer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptyText: { color: '#71717a', fontSize: 15, marginTop: 4, textAlign: 'center' },
  startBtn: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    minHeight: 44,
  },
  startBtnText: { color: '#000000', fontSize: 15, fontWeight: '600' },

  // New message modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  modalSearch: {
    backgroundColor: '#27272a',
    margin: 12,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#ffffff',
  },
  memberList: { maxHeight: 320 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  memberAvatar: { width: 36, height: 36, borderRadius: 18 },
  memberAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInitial: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  noMembers: { color: '#71717a', fontSize: 14, textAlign: 'center', padding: 24 },
})

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
  Clipboard,
  Image,
  RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Channel, Message } from '@membercore/core'
import { REACTION_EMOJIS } from '@membercore/core'
import { chatService, getApi } from '@membercore/services'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system'
import { useAuth } from '../contexts/AuthContext'
import type { OrgDrawerScreenProps } from '../navigation/types'

const MAX_ATTACHMENT_DATA_URL_LENGTH = 680_000
const GROUP_WINDOW_MS = 5 * 60 * 1000

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬'] },
  { label: 'Gestures', emojis: ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🙏','🤝','👏','🫶'] },
  { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','💕','💞','💓','💗','💖','💘','💝'] },
  { label: 'Celebration', emojis: ['🎉','🎊','🥳','🎈','🎁','🎂','🍾','🥂','✨','🌟','⭐','💫','🏆','🥇','🥈','🥉'] },
  { label: 'Objects', emojis: ['🔥','💯','💢','💥','💫','💦','💨','💣','💬','💤','🚀','⚡','☀️','🌙','🌈','🔔','🎵','🎶','💡','🔑'] },
]

export function ChatScreen({ route, navigation }: OrgDrawerScreenProps<'Chat'>) {
  const { orgId } = route.params
  const { user, token } = useAuth()
  const api = getApi()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [channelPickerVisible, setChannelPickerVisible] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)

  // Create channel state
  const [createChannelVisible, setCreateChannelVisible] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'restricted'>('public')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  // Emoji picker state
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false)
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null)
  const [refreshingMessages, setRefreshingMessages] = useState(false)

  // Action panel state
  const [actionMessage, setActionMessage] = useState<Message | null>(null)

  const flatListRef = useRef<FlatList>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const lastTapRef = useRef<{ messageId: string; time: number } | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const isNearBottomRef = useRef(true)
  const pendingAutoScrollRef = useRef(false)

  const canManage = myRole === 'owner' || myRole === 'admin'

  useEffect(() => {
    api.get(`/organizations/${orgId}/members/me`)
      .then((r) => setMyRole(String(r.data?.role ?? 'member')))
      .catch(() => setMyRole(null))
  }, [orgId])

  useEffect(() => {
    shouldAutoScrollRef.current = true
    chatService
      .listChannels(orgId)
      .then((chs) => {
        setChannels(chs)
        const general =
          chs.find((c) => (c.name || '').toLowerCase() === 'general' || c.is_default) || chs[0]
        if (general) setActiveChannel(general)
      })
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity
            style={headerStyles.channelBtn}
            onPress={() => setChannelPickerVisible(true)}
            activeOpacity={0.7}
            disabled={channels.length === 0}
          >
            {activeChannel?.is_restricted ? (
              <Feather name="shield" size={18} color="#f59e0b" />
            ) : (
              <Feather name="hash" size={18} color="#ffffff" />
            )}
            <Text style={headerStyles.channelName} numberOfLines={1}>
              {activeChannel?.name ?? '...'}
            </Text>
            <Feather name="chevron-down" size={16} color="#a1a1aa" />
          </TouchableOpacity>
          {myRole !== 'restricted' && (
            <TouchableOpacity
              style={headerStyles.iconBtn}
              onPress={() => setCreateChannelVisible(true)}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={26} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>
      ),
    })
  }, [navigation, activeChannel, channels.length, myRole])

  const fetchMessages = useCallback(async () => {
    if (!activeChannel) return
    try {
      const res = await chatService.listMessages(orgId, activeChannel.id)
      const sorted = [...(res.messages || [])].sort((a, b) => {
        const aTs = a.created_at ? new Date(a.created_at).getTime() : 0
        const bTs = b.created_at ? new Date(b.created_at).getTime() : 0
        return aTs - bTs
      })
      setMessages(sorted)
      setPinnedMessageId((res as any).pinned_message_id ?? null)
    } catch {
      // silently fail
    }
  }, [orgId, activeChannel])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    if (!activeChannel || messages.length === 0 || !shouldAutoScrollRef.current) return
    const t = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: false })
      shouldAutoScrollRef.current = false
      pendingAutoScrollRef.current = false
    }, 120)
    return () => clearTimeout(t)
  }, [activeChannel, messages.length])

  useEffect(() => {
    if (!activeChannel) return
    shouldAutoScrollRef.current = true
    isNearBottomRef.current = true
    pendingAutoScrollRef.current = false
  }, [activeChannel?.id])

  useEffect(() => {
    if (!token || !activeChannel) return
    const API_URL =
      process.env.EXPO_PUBLIC_BACKEND_URL ||
      'https://membercore-api-112612371535.us-central1.run.app/api'
    const wsUrl = chatService.getWsUrl(orgId, API_URL)
    const ws = new WebSocket(`${wsUrl}?token=${token}&channel=${activeChannel.id}`)
    wsRef.current = ws

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data)
        if (data.type === 'message' && data.message) {
          pendingAutoScrollRef.current = isNearBottomRef.current
          setMessages((prev) => {
            if (prev.some((x) => x.id === data.message.id)) return prev
            return [...prev, data.message]
          })
        }
      } catch {
        // ignore
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [orgId, token, activeChannel])

  const onRefreshMessages = useCallback(async () => {
    setRefreshingMessages(true)
    await fetchMessages()
    setRefreshingMessages(false)
  }, [fetchMessages])

  const handleSend = useCallback(async () => {
    if ((!input.trim() && !selectedImageDataUrl) || !activeChannel) return
    setSending(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const text = input.trim()
    const replySnippet = (replyTo?.content || '').slice(0, 200) || (replyTo?.image_data_url ? '[Image]' : undefined)
    try {
      await chatService.sendMessage(orgId, activeChannel.id, {
        content: text,
        image_data_url: selectedImageDataUrl || undefined,
        reply_to_message_id: replyTo?.id,
        reply_to_snippet: replySnippet,
      })
      setInput('')
      setSelectedImageDataUrl(null)
      setSelectedImageName(null)
      setReplyTo(null)
    } catch {
      // silently fail
    } finally {
      setSending(false)
    }
  }, [input, selectedImageDataUrl, orgId, activeChannel, replyTo])

  const pickImageForChat = useCallback(async () => {
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

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!activeChannel) return
      try {
        const res = await chatService.toggleReaction(orgId, activeChannel.id, messageId, emoji)
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: res.reactions || [] } : m)),
        )
      } catch {
        // silently fail
      }
    },
    [orgId, activeChannel],
  )

  const handleMessagePress = useCallback(
    (messageId: string) => {
      const now = Date.now()
      const last = lastTapRef.current
      if (last?.messageId === messageId && now - last.time < 400) {
        lastTapRef.current = null
        toggleReaction(messageId, '👍')
        return
      }
      lastTapRef.current = { messageId, time: now }
    },
    [toggleReaction],
  )

  const handlePin = useCallback(async (message: Message) => {
    if (!activeChannel || !canManage) return
    try {
      const newPin = pinnedMessageId === message.id ? null : message.id
      await api.put(`/chat/${orgId}/channels/${activeChannel.id}/pin`, {
        message_id: newPin,
      })
      setPinnedMessageId(newPin)
    } catch {
      // silently fail
    }
  }, [orgId, activeChannel, canManage, pinnedMessageId])

  const handleCopy = useCallback((message: Message) => {
    const text = message.content || ''
    if (text) {
      Clipboard.setString(text)
      Alert.alert('Copied', 'Message copied to clipboard')
    }
  }, [])

  const handleCreateChannel = useCallback(async () => {
    setCreateError('')
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/\?/g, '')
    if (!name) {
      setCreateError('Channel name required')
      return
    }
    setCreateLoading(true)
    try {
      await chatService.createChannel(orgId, {
        name,
        is_restricted: newChannelVisibility === 'restricted',
      })
      setCreateChannelVisible(false)
      setNewChannelName('')
      setNewChannelVisibility('public')
      const chs = await chatService.listChannels(orgId)
      setChannels(chs)
    } catch (err: any) {
      setCreateError(err?.response?.data?.detail || 'Failed to create channel')
    } finally {
      setCreateLoading(false)
    }
  }, [orgId, newChannelName, newChannelVisibility])

  const grouped = useMemo(() => {
    return messages.map((msg, idx) => {
      const prev = idx > 0 ? messages[idx - 1] : null
      const sameUser = prev?.sender_id === msg.sender_id
      const withinWindow = prev
        ? new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < GROUP_WINDOW_MS
        : false
      const isEventOrPoll = msg.type === 'event' || msg.type === 'poll'
      return { ...msg, showHeader: !sameUser || !withinWindow || isEventOrPoll }
    })
  }, [messages])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  const renderMessage = ({ item }: { item: (typeof grouped)[number] }) => {
    const isPinned = pinnedMessageId === item.id

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleMessagePress(item.id)}
        onLongPress={() => setActionMessage(item)}
          style={[
            styles.messageBubble,
            !item.showHeader && styles.messageBubbleGrouped,
            isPinned && styles.messagePinned,
          ]}
        >
          <View style={styles.messageRow}>
            {item.showHeader ? (
              item.sender_avatar ? (
                <Image source={{ uri: item.sender_avatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Feather name="user" size={14} color="#a1a1aa" />
                </View>
              )
            ) : (
              <View style={styles.avatarSpacer} />
            )}

            <View style={styles.messageContent}>
              {item.showHeader && (
                <View style={styles.messageHeader}>
                  <Text style={styles.senderName}>
                    {item.sender_nickname || item.sender_name || 'Unknown'}
                  </Text>
                  <Text style={styles.timestamp}>
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
                  </Text>
                  {isPinned && <Feather name="bookmark" size={12} color="#f59e0b" style={{ marginLeft: 4 }} />}
                </View>
              )}

              {item.reply_to_snippet ? (
                <View style={styles.replyBar}>
                  <Text style={styles.replyBarText} numberOfLines={1}>
                    Reply to: {item.reply_to_snippet.slice(0, 80)}
                    {(item.reply_to_snippet?.length ?? 0) > 80 ? '…' : ''}
                  </Text>
                </View>
              ) : null}

              {/* Event card in chat */}
              {item.type === 'event' && (item as any).event_data ? (
                <View style={styles.eventCard}>
                  {(item as any).event_data?.cover_image ? (
                    <Image
                      source={{ uri: (item as any).event_data?.cover_image }}
                      style={styles.eventCardImage}
                    />
                  ) : (
                    <View style={styles.eventCardImagePlaceholder}>
                      <Feather name="calendar" size={28} color="#71717a" />
                    </View>
                  )}
                  <View style={styles.eventCardBody}>
                    <Text style={styles.eventCardTitle}>{(item as any).event_data?.title || ''}</Text>
                    {(item as any).event_data?.start_time && (
                      <Text style={styles.eventCardMeta}>
                        {new Date((item as any).event_data?.start_time).toLocaleDateString(undefined, {
                          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })}
                      </Text>
                    )}
                    <Text style={styles.eventCardLink}>View event →</Text>
                  </View>
                </View>
              ) : item.type === 'poll' && ((item as any).poll_data || (item as any).poll_options) ? (
                <View style={styles.pollCard}>
                  <View style={styles.pollCardHeader}>
                    <Feather name="bar-chart-2" size={14} color="#a1a1aa" />
                    <Text style={styles.pollCardHeaderText}>Poll</Text>
                  </View>
                  <Text style={styles.pollCardQuestion}>
                    {(item as any).poll_data?.question || item.content}
                  </Text>
                  {((item as any).poll_data?.options || (item as any).poll_options || []).map((opt: any, i: number) => (
                    <View key={typeof opt === 'string' ? i : opt.id} style={styles.pollCardOption}>
                      <Text style={styles.pollCardOptionText}>
                        {typeof opt === 'string' ? opt : opt.text}
                      </Text>
                    </View>
                  ))}
                  <Text style={styles.pollCardLink}>View poll →</Text>
                </View>
              ) : (
                <>
                  {item.image_data_url ? (
                    <Image source={{ uri: item.image_data_url }} style={styles.messageImage} resizeMode="cover" />
                  ) : null}
                  {item.content ? <Text style={styles.messageText}>{item.content}</Text> : null}
                </>
              )}

              {/* Reactions */}
              {item.reactions && item.reactions.length > 0 && (
                <View style={styles.reactionRow}>
                  {item.reactions
                    .filter((r) => r.count > 0)
                    .map((r) => (
                      <TouchableOpacity
                        key={r.emoji}
                        style={[styles.reactionPill, r.reactedByMe && styles.reactionPillActive]}
                        onPress={() => toggleReaction(item.id, r.emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{r.emoji}</Text>
                        <Text style={[styles.reactionCount, r.reactedByMe && styles.reactionCountActive]}>
                          {r.count}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  <TouchableOpacity
                    style={styles.addReactionBtn}
                    onPress={() => {
                      setEmojiPickerMessageId(item.id)
                      setEmojiPickerVisible(true)
                    }}
                  >
                    <Feather name="plus" size={14} color="#71717a" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Channel picker modal */}
      <Modal visible={channelPickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setChannelPickerVisible(false)}
        >
          <View style={styles.channelModal}>
            <Text style={styles.channelModalTitle}>Select Channel</Text>
            <ScrollView style={styles.channelModalScroll}>
              {channels.map((ch) => (
                <TouchableOpacity
                  key={ch.id}
                  style={[styles.channelOption, ch.id === activeChannel?.id && styles.channelOptionActive]}
                  onPress={() => {
                    setActiveChannel(ch)
                    setChannelPickerVisible(false)
                  }}
                >
                  <Feather
                    name={ch.is_restricted ? 'shield' : 'hash'}
                    size={16}
                    color={ch.is_restricted ? '#f59e0b' : '#71717a'}
                  />
                  <Text
                    style={[styles.channelOptionText, ch.id === activeChannel?.id && styles.channelOptionTextActive]}
                    numberOfLines={1}
                  >
                    {ch.name}
                  </Text>
                  {((ch.name || '').toLowerCase() === 'general' || ch.is_default) ? (
                    <Text style={styles.channelDefaultLabel}>default</Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Create channel modal */}
      <Modal visible={createChannelVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.createChannelModal}>
            <View style={styles.createChannelHeader}>
              <Text style={styles.createChannelTitle}>Create Channel</Text>
              <TouchableOpacity onPress={() => { setCreateChannelVisible(false); setCreateError('') }}>
                <Feather name="x" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            {createError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{createError}</Text>
              </View>
            ) : null}
            <View style={styles.createChannelBody}>
              <Text style={styles.fieldLabel}>Channel name</Text>
              <TextInput
                style={styles.createInput}
                placeholder="e.g. announcements"
                placeholderTextColor="#71717a"
                value={newChannelName}
                onChangeText={setNewChannelName}
              />
              {canManage && (
                <>
                  <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Visibility</Text>
                  <View style={styles.visibilityRow}>
                    <TouchableOpacity
                      style={[
                        styles.visibilityBtn,
                        newChannelVisibility === 'public' && styles.visibilityBtnActive,
                      ]}
                      onPress={() => setNewChannelVisibility('public')}
                    >
                      <Feather name="hash" size={16} color={newChannelVisibility === 'public' ? '#ffffff' : '#a1a1aa'} />
                      <Text style={[styles.visibilityText, newChannelVisibility === 'public' && styles.visibilityTextActive]}>
                        Public
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.visibilityBtn,
                        newChannelVisibility === 'restricted' && styles.visibilityBtnRestricted,
                      ]}
                      onPress={() => setNewChannelVisibility('restricted')}
                    >
                      <Feather name="shield" size={16} color={newChannelVisibility === 'restricted' ? '#f59e0b' : '#a1a1aa'} />
                      <Text style={[styles.visibilityText, newChannelVisibility === 'restricted' && { color: '#f59e0b' }]}>
                        Restricted
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {newChannelVisibility === 'restricted' && (
                    <Text style={styles.restrictedNote}>
                      Only members with Restricted role or those you add can see this channel.
                    </Text>
                  )}
                </>
              )}
              <View style={styles.createBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => { setCreateChannelVisible(false); setCreateError('') }}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createBtn, createLoading && { opacity: 0.5 }]}
                  onPress={handleCreateChannel}
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <Text style={styles.createBtnText}>Create</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Action panel modal (long press) */}
      <Modal visible={!!actionMessage} transparent animationType="fade">
        <TouchableOpacity
          style={styles.actionBackdrop}
          activeOpacity={1}
          onPress={() => setActionMessage(null)}
        >
          <View style={styles.actionPanel}>
            {/* Quick reaction bar */}
            <View style={styles.quickReactions}>
              {(REACTION_EMOJIS || ['👍', '❤️', '😂', '🔥']).map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.quickReactionBtn}
                  onPress={() => {
                    if (actionMessage) toggleReaction(actionMessage.id, emoji)
                    setActionMessage(null)
                  }}
                >
                  <Text style={styles.quickReactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.moreReactionsBtn}
                onPress={() => {
                  setEmojiPickerMessageId(actionMessage?.id ?? null)
                  setEmojiPickerVisible(true)
                  setActionMessage(null)
                }}
              >
                <Feather name="plus" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                if (actionMessage) setReplyTo(actionMessage)
                setActionMessage(null)
              }}
            >
              <Feather name="corner-up-left" size={16} color="#a1a1aa" />
              <Text style={styles.actionBtnText}>Reply</Text>
            </TouchableOpacity>
            {canManage && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  if (actionMessage) handlePin(actionMessage)
                  setActionMessage(null)
                }}
              >
                <Feather name="bookmark" size={16} color="#a1a1aa" />
                <Text style={styles.actionBtnText}>
                  {pinnedMessageId === actionMessage?.id ? 'Unpin message' : 'Pin message'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                if (actionMessage) handleCopy(actionMessage)
                setActionMessage(null)
              }}
            >
              <Feather name="copy" size={16} color="#a1a1aa" />
              <Text style={styles.actionBtnText}>Copy message</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Emoji picker modal */}
      <Modal visible={emojiPickerVisible} transparent animationType="slide">
        <TouchableOpacity
          style={styles.emojiBackdrop}
          activeOpacity={1}
          onPress={() => { setEmojiPickerVisible(false); setEmojiPickerMessageId(null) }}
        >
          <View style={styles.emojiPicker}>
            <View style={styles.emojiPickerHeader}>
              <Text style={styles.emojiPickerTitle}>Pick a reaction</Text>
              <TouchableOpacity onPress={() => { setEmojiPickerVisible(false); setEmojiPickerMessageId(null) }}>
                <Feather name="x" size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.emojiScroll}>
              {EMOJI_CATEGORIES.map((cat) => (
                <View key={cat.label} style={styles.emojiCategory}>
                  <Text style={styles.emojiCategoryLabel}>{cat.label}</Text>
                  <View style={styles.emojiGrid}>
                    {cat.emojis.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.emojiBtn}
                        onPress={() => {
                          if (emojiPickerMessageId) toggleReaction(emojiPickerMessageId, emoji)
                          setEmojiPickerVisible(false)
                          setEmojiPickerMessageId(null)
                        }}
                      >
                        <Text style={styles.emojiBtnText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Pinned message bar */}
      {pinnedMessageId && messages.some((m) => m.id === pinnedMessageId) && (
        <View style={styles.pinnedBar}>
          <Feather name="bookmark" size={14} color="#f59e0b" />
          <Text style={styles.pinnedText} numberOfLines={1}>
            Pinned: {messages.find((m) => m.id === pinnedMessageId)?.content?.slice(0, 50) || 'Message'}
          </Text>
        </View>
      )}

      {/* Messages area */}
      {activeChannel ? (
        messages.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Feather name="message-square" size={48} color="#71717a" style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={grouped}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => {
              if (shouldAutoScrollRef.current || pendingAutoScrollRef.current) {
                flatListRef.current?.scrollToEnd({ animated: pendingAutoScrollRef.current })
                pendingAutoScrollRef.current = false
              }
            }}
            onScroll={(evt: any) => {
              const { contentOffset, layoutMeasurement, contentSize } = evt.nativeEvent
              const distanceFromBottom =
                contentSize.height - (contentOffset.y + layoutMeasurement.height)
              isNearBottomRef.current = distanceFromBottom < 72
            }}
            scrollEventThrottle={16}
            renderItem={renderMessage}
            initialNumToRender={20}
            maxToRenderPerBatch={15}
            windowSize={11}
            removeClippedSubviews={true}
            refreshControl={<RefreshControl refreshing={refreshingMessages} onRefresh={onRefreshMessages} tintColor="#71717a" />}
          />
        )
      ) : (
        <View style={styles.emptyState}>
          <Feather name="message-square" size={48} color="#71717a" style={{ opacity: 0.5 }} />
          <Text style={styles.emptyText}>Select a channel from the dropdown above</Text>
        </View>
      )}

      {/* Reply preview */}
      {replyTo && (
        <View style={styles.replyPreview}>
          <Feather name="corner-up-left" size={14} color="#a1a1aa" />
          <Text style={styles.replyPreviewText} numberOfLines={1}>
            Replying to {replyTo.sender_nickname || replyTo.sender_name}:{' '}
            {((replyTo.content || '').slice(0, 50) || (replyTo.image_data_url ? '[Image]' : ''))}…
          </Text>
          <TouchableOpacity
            onPress={() => setReplyTo(null)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.replyDismiss}
          >
            <Feather name="x" size={16} color="#71717a" />
          </TouchableOpacity>
        </View>
      )}

      {selectedImageDataUrl ? (
        <View style={styles.attachmentPreview}>
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
      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.attachBtn}
          onPress={pickImageForChat}
          disabled={sending}
        >
          <Feather name="paperclip" size={18} color="#d4d4d8" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder={
            replyTo
              ? `Reply to ${replyTo.sender_nickname || replyTo.sender_name}...`
              : `Message #${activeChannel?.name || ''}`
          }
          placeholderTextColor="#71717a"
          value={input}
          onChangeText={setInput}
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
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },

  // Channel picker modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  channelModal: {
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
  },
  channelModalTitle: {
    fontSize: 16, fontWeight: '600', color: '#ffffff',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  channelModalScroll: { maxHeight: 320 },
  channelOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 44,
  },
  channelOptionActive: { backgroundColor: '#27272a' },
  channelOptionText: { flex: 1, fontSize: 15, color: '#d4d4d8' },
  channelOptionTextActive: { color: '#ffffff' },
  channelDefaultLabel: { fontSize: 12, color: '#71717a' },

  // Create channel modal
  createChannelModal: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
  },
  createChannelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  createChannelTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  createChannelBody: { padding: 16 },
  fieldLabel: { color: '#d4d4d8', fontSize: 14, fontWeight: '500', marginBottom: 8 },
  createInput: {
    backgroundColor: '#27272a', borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#ffffff',
  },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46',
  },
  visibilityBtnActive: { borderColor: '#ffffff', backgroundColor: '#3f3f46' },
  visibilityBtnRestricted: { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' },
  visibilityText: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
  visibilityTextActive: { color: '#ffffff' },
  restrictedNote: { color: 'rgba(245,158,11,0.9)', fontSize: 12, marginTop: 6 },
  createBtnRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  cancelBtn: {
    flex: 1, backgroundColor: '#27272a', borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46',
    paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  createBtn: {
    flex: 1, backgroundColor: '#ffffff', borderRadius: 8, paddingVertical: 12, alignItems: 'center',
  },
  createBtnText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, marginHorizontal: 16, marginTop: 12,
  },
  errorText: { color: '#f87171', fontSize: 13 },

  // Action panel
  actionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  actionPanel: {
    width: '100%',
    maxWidth: 280,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3f3f46',
    overflow: 'hidden',
  },
  quickReactions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(63,63,70,0.5)',
  },
  quickReactionBtn: { padding: 8, borderRadius: 8 },
  quickReactionEmoji: { fontSize: 22 },
  moreReactionsBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#3f3f46',
    justifyContent: 'center', alignItems: 'center',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, minHeight: 44,
  },
  actionBtnText: { color: '#d4d4d8', fontSize: 14 },

  // Emoji picker
  emojiBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  emojiPicker: {
    backgroundColor: '#18181b', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '60%', borderWidth: 1, borderColor: '#3f3f46',
  },
  emojiPickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  emojiPickerTitle: { color: '#a1a1aa', fontSize: 14, fontWeight: '500' },
  emojiScroll: { paddingHorizontal: 12, paddingBottom: 24 },
  emojiCategory: { marginTop: 12 },
  emojiCategoryLabel: { color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingHorizontal: 4 },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  emojiBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  emojiBtnText: { fontSize: 22 },

  // Pinned bar
  pinnedBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: 'rgba(39,39,42,0.8)', borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  pinnedText: { color: '#d4d4d8', fontSize: 13, flex: 1 },

  // Messages list
  messageList: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },

  // Message bubble
  messageBubble: {
    backgroundColor: '#18181b', borderRadius: 12, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(39,39,42,0.8)',
  },
  messageBubbleGrouped: { marginTop: 2, borderTopLeftRadius: 6 },
  messagePinned: { borderColor: 'rgba(245,158,11,0.3)' },

  messageRow: { flexDirection: 'row', gap: 12 },

  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarPlaceholder: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#27272a',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarSpacer: { width: 32 },

  messageContent: { flex: 1, minWidth: 0 },

  messageHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  senderName: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  timestamp: { color: '#71717a', fontSize: 12 },

  replyBar: { borderLeftWidth: 2, borderLeftColor: '#52525b', paddingLeft: 8, marginTop: 2 },
  replyBarText: { color: '#71717a', fontSize: 12 },

  messageImage: {
    marginTop: 6,
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: '#27272a',
  },
  messageText: { color: '#d4d4d8', fontSize: 14, lineHeight: 20, marginTop: 2 },

  // Event card in chat
  eventCard: {
    marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46',
    backgroundColor: '#18181b', overflow: 'hidden',
  },
  eventCardImage: { width: '100%', height: 100, backgroundColor: '#27272a' },
  eventCardImagePlaceholder: {
    width: '100%', height: 80, backgroundColor: '#27272a',
    justifyContent: 'center', alignItems: 'center',
  },
  eventCardBody: { padding: 12 },
  eventCardTitle: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  eventCardMeta: { color: '#a1a1aa', fontSize: 12, marginTop: 4 },
  eventCardLink: { color: '#a1a1aa', fontSize: 12, textDecorationLine: 'underline', marginTop: 8 },

  // Poll card in chat
  pollCard: {
    marginTop: 8, borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46',
    backgroundColor: '#18181b', padding: 12,
  },
  pollCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  pollCardHeaderText: { color: '#a1a1aa', fontSize: 12 },
  pollCardQuestion: { color: '#ffffff', fontSize: 15, fontWeight: '500' },
  pollCardOption: {
    backgroundColor: 'rgba(39,39,42,0.5)', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginTop: 6,
  },
  pollCardOptionText: { color: '#d4d4d8', fontSize: 13 },
  pollCardLink: { color: '#a1a1aa', fontSize: 12, textDecorationLine: 'underline', marginTop: 8 },

  // Reactions
  reactionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6, alignItems: 'center' },
  reactionPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(39,39,42,0.8)', borderWidth: 1, borderColor: '#3f3f46',
  },
  reactionPillActive: { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.5)' },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 12, color: '#a1a1aa' },
  reactionCountActive: { color: '#fbbf24' },
  addReactionBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(39,39,42,0.8)',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46',
  },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  emptyText: { color: '#71717a', fontSize: 15, marginTop: 12, textAlign: 'center' },

  // Reply preview
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(39,39,42,0.8)', borderTopWidth: 1, borderTopColor: '#27272a',
  },
  replyPreviewText: { flex: 1, color: '#a1a1aa', fontSize: 14 },
  replyDismiss: { padding: 4 },

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

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#27272a',
    paddingHorizontal: 16, paddingVertical: 16,
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
    flex: 1, backgroundColor: '#18181b', borderRadius: 12, borderWidth: 1, borderColor: '#3f3f46',
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#ffffff', maxHeight: 100,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
})

const headerStyles = StyleSheet.create({
  channelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: '#27272a',
    borderRadius: 8, minHeight: 40, maxWidth: 160,
  },
  channelName: { color: '#ffffff', fontSize: 14, fontWeight: '500', flexShrink: 1 },
  iconBtn: {
    padding: 8, minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center',
  },
})

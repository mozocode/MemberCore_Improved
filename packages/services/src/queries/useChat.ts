import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Message } from '@membercore/core'
import { chatService } from '../chat.service'
import { queryKeys } from './queryKeys'

export function useChannels(orgId: string) {
  return useQuery({
    queryKey: queryKeys.channels.all(orgId),
    queryFn: () => chatService.listChannels(orgId),
    staleTime: 2 * 60 * 1000,
    enabled: !!orgId,
  })
}

export function useMessages(orgId: string, channelId: string) {
  return useQuery({
    queryKey: queryKeys.messages.list(orgId, channelId),
    queryFn: () => chatService.listMessages(orgId, channelId),
    staleTime: 30 * 1000,
    enabled: !!orgId && !!channelId,
    refetchOnWindowFocus: true,
  })
}

export function useSendMessage(orgId: string, channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: { content: string; reply_to_message_id?: string }) =>
      chatService.sendMessage(orgId, channelId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(orgId, channelId),
      })
    },
  })
}

export function useToggleReaction(orgId: string, channelId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatService.toggleReaction(orgId, channelId, messageId, emoji),
    onMutate: async ({ messageId, emoji }) => {
      const key = queryKeys.messages.list(orgId, channelId)
      await queryClient.cancelQueries({ queryKey: key })

      const prev = queryClient.getQueryData(key) as { messages: Message[] } | undefined
      if (!prev) return { prev }

      const updated = prev.messages.map((m) => {
        if (m.id !== messageId) return m
        const reactions = [...(m.reactions || [])]
        const idx = reactions.findIndex((r) => r.emoji === emoji)
        if (idx >= 0) {
          const r = reactions[idx]
          if (r.reactedByMe) {
            if (r.count <= 1) {
              reactions.splice(idx, 1)
            } else {
              reactions[idx] = { ...r, count: r.count - 1, reactedByMe: false }
            }
          } else {
            reactions[idx] = { ...r, count: r.count + 1, reactedByMe: true }
          }
        } else {
          reactions.push({ emoji, count: 1, reactedByMe: true })
        }
        return { ...m, reactions }
      })

      queryClient.setQueryData(key, { ...prev, messages: updated })
      return { prev }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(
          queryKeys.messages.list(orgId, channelId),
          context.prev,
        )
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.list(orgId, channelId),
      })
    },
  })
}

export function useChatSummary(orgId: string, channelId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.chatSummary.get(orgId, channelId),
    queryFn: () => chatService.getSummary(orgId, channelId),
    staleTime: 10 * 60 * 1000,
    enabled: !!orgId && !!channelId && enabled,
  })
}

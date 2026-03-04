/**
 * Centralized query key factory for TanStack Query.
 * Scoped by orgId + entity for targeted invalidation.
 */
export const queryKeys = {
  organizations: {
    all: ['organizations'] as const,
    detail: (orgId: string) => ['organizations', orgId] as const,
  },

  channels: {
    all: (orgId: string) => ['channels', orgId] as const,
    detail: (orgId: string, channelId: string) =>
      ['channels', orgId, channelId] as const,
  },

  messages: {
    list: (orgId: string, channelId: string) =>
      ['messages', orgId, channelId] as const,
    listBefore: (orgId: string, channelId: string, cursor?: string) =>
      ['messages', orgId, channelId, { before: cursor }] as const,
  },

  events: {
    all: (orgId: string) => ['events', orgId] as const,
    detail: (orgId: string, eventId: string) =>
      ['events', orgId, eventId] as const,
  },

  polls: {
    all: (orgId: string) => ['polls', orgId] as const,
    detail: (orgId: string, pollId: string) =>
      ['polls', orgId, pollId] as const,
  },

  dues: {
    status: (orgId: string) => ['dues', orgId] as const,
    plans: (orgId: string) => ['dues', orgId, 'plans'] as const,
  },

  directory: {
    all: (orgId: string) => ['directory', orgId] as const,
    search: (orgId: string, query: string) =>
      ['directory', orgId, { search: query }] as const,
  },

  documents: {
    all: (orgId: string) => ['documents', orgId] as const,
    templates: (orgId: string) => ['documents', orgId, 'templates'] as const,
    forms: (orgId: string) => ['documents', orgId, 'forms'] as const,
  },

  channelRead: {
    state: (orgId: string, channelId: string) =>
      ['channelRead', orgId, channelId] as const,
  },

  chatSummary: {
    get: (orgId: string, channelId: string) =>
      ['chatSummary', orgId, channelId] as const,
  },

  billing: {
    state: (orgId: string) => ['billing', orgId] as const,
  },
} as const

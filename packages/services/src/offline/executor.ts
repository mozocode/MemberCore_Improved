import type { QueuedAction } from './types'
import { chatService } from '../chat.service'
import { eventService } from '../event.service'
import { pollService } from '../poll.service'

/**
 * Executes a queued offline action by dispatching to the appropriate service.
 * Each action carries all the data needed to make the API call.
 */
export async function executeAction(action: QueuedAction): Promise<void> {
  const p = action.payload

  switch (action.type) {
    case 'send_message': {
      await chatService.sendMessage(
        p.orgId as string,
        p.channelId as string,
        {
          content: p.content as string,
          reply_to_message_id: p.reply_to_message_id as string | undefined,
        },
      )
      break
    }

    case 'toggle_reaction': {
      await chatService.toggleReaction(
        p.orgId as string,
        p.channelId as string,
        p.messageId as string,
        p.emoji as string,
      )
      break
    }

    case 'rsvp': {
      await eventService.rsvp(
        p.orgId as string,
        p.eventId as string,
        p.status as string,
      )
      break
    }

    case 'vote': {
      await pollService.vote(
        p.orgId as string,
        p.pollId as string,
        p.optionIds as string[],
      )
      break
    }

    case 'update_read_state': {
      await chatService.updateReadState(
        p.orgId as string,
        p.channelId as string,
        p.messageId as string,
      )
      break
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

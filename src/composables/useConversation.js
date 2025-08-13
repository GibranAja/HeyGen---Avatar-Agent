// composables/useConversation.js
import { computed } from 'vue'
import { useConversationStore, MESSAGE_SENDER } from '../stores/conversation'

/**
 * Composable for managing conversation history
 * Provides reactive access to conversation state and helper methods
 */
export const useConversation = () => {
  const conversationStore = useConversationStore()

  // Reactive computed properties
  const messages = computed(() => conversationStore.messages)
  const messageCount = computed(() => conversationStore.messageCount)
  const lastMessage = computed(() => conversationStore.lastMessage)
  const isUserTalking = computed(() => conversationStore.isUserTalking)
  const isAvatarTalking = computed(() => conversationStore.isAvatarTalking)
  const isListening = computed(() => conversationStore.isListening)
  const userMessages = computed(() => conversationStore.userMessages)
  const avatarMessages = computed(() => conversationStore.avatarMessages)

  // Action methods
  const handleUserMessage = (content) => {
    try {
      conversationStore.handleUserMessage(content)
    } catch (error) {
      console.error('Error in handleUserMessage:', error)
    }
  }

  const handleAvatarMessage = (content) => {
    try {
      conversationStore.handleAvatarMessage(content)
    } catch (error) {
      console.error('Error in handleAvatarMessage:', error)
    }
  }

  const endMessage = () => {
    try {
      conversationStore.endMessage()
    } catch (error) {
      console.error('Error in endMessage:', error)
    }
  }

  const setUserTalking = (isTalking) => {
    try {
      conversationStore.setUserTalking(isTalking)
    } catch (error) {
      console.error('Error in setUserTalking:', error)
    }
  }

  const setAvatarTalking = (isTalking) => {
    try {
      conversationStore.setAvatarTalking(isTalking)
    } catch (error) {
      console.error('Error in setAvatarTalking:', error)
    }
  }

  const setListening = (isListening) => {
    try {
      conversationStore.setListening(isListening)
    } catch (error) {
      console.error('Error in setListening:', error)
    }
  }

  const clearMessages = () => {
    try {
      conversationStore.clearMessages()
    } catch (error) {
      console.error('Error in clearMessages:', error)
    }
  }

  const removeMessage = (messageId) => {
    try {
      conversationStore.removeMessage(messageId)
    } catch (error) {
      console.error('Error in removeMessage:', error)
    }
  }

  const getRecentMessages = (count = 10) => {
    try {
      return conversationStore.getRecentMessages(count)
    } catch (error) {
      console.error('Error in getRecentMessages:', error)
      return []
    }
  }

  const getMessagesBySender = (sender) => {
    try {
      return conversationStore.getMessagesBySender(sender)
    } catch (error) {
      console.error('Error in getMessagesBySender:', error)
      return []
    }
  }

  // Helper methods
  const hasMessages = computed(() => messageCount.value > 0)
  
  const getConversationSummary = () => {
    return {
      totalMessages: messageCount.value,
      userMessageCount: userMessages.value.length,
      avatarMessageCount: avatarMessages.value.length,
      lastMessageSender: lastMessage.value?.sender || null,
      lastMessageTime: lastMessage.value?.timestamp || null
    }
  }

  const exportConversation = () => {
    try {
      return {
        messages: messages.value,
        summary: getConversationSummary(),
        exportedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error exporting conversation:', error)
      return null
    }
  }

  return {
    // State
    messages,
    messageCount,
    lastMessage,
    isUserTalking,
    isAvatarTalking,
    isListening,
    userMessages,
    avatarMessages,
    hasMessages,

    // Actions
    handleUserMessage,
    handleAvatarMessage,
    endMessage,
    setUserTalking,
    setAvatarTalking,
    setListening,
    clearMessages,
    removeMessage,

    // Utility methods
    getRecentMessages,
    getMessagesBySender,
    getConversationSummary,
    exportConversation,

    // Constants
    MESSAGE_SENDER
  }
}
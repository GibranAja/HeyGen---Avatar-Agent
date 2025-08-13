// stores/conversation.js
import { defineStore } from 'pinia'

export const MESSAGE_SENDER = {
  USER: 'USER',
  AVATAR: 'AVATAR'
}

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    messages: [],
    currentSender: null,
    isUserTalking: false,
    isAvatarTalking: false,
    isListening: false
  }),

  getters: {
    messageCount: (state) => state.messages.length,
    
    lastMessage: (state) => {
      return state.messages.length > 0 
        ? state.messages[state.messages.length - 1] 
        : null
    },
    
    userMessages: (state) => {
      return state.messages.filter(msg => msg.sender === MESSAGE_SENDER.USER)
    },
    
    avatarMessages: (state) => {
      return state.messages.filter(msg => msg.sender === MESSAGE_SENDER.AVATAR)
    }
  },

  actions: {
    /**
     * Handle user message (from speech recognition)
     * This should only contain what the user actually said
     */
    handleUserMessage(content) {
      if (!content?.trim()) return

      try {
        const messageId = Date.now().toString()
        
        // Always create a new message for user input
        this.currentSender = MESSAGE_SENDER.USER
        this.messages.push({
          id: messageId,
          sender: MESSAGE_SENDER.USER,
          content: content.trim(),
          timestamp: new Date().toISOString()
        })
        
        this.isUserTalking = true
      } catch (error) {
        console.error('Error handling user message:', error)
      }
    },

    /**
     * Handle streaming user message (partial transcripts)
     * Following HeyGen's pattern for real-time updates
     */
    handleUserTalkingMessage(content) {
      if (!content?.trim()) return

      try {
        // If same sender as previous, update the last message
        if (this.currentSender === MESSAGE_SENDER.USER && this.messages.length > 0) {
          const lastMessage = this.messages[this.messages.length - 1]
          lastMessage.content = content.trim()
          lastMessage.timestamp = new Date().toISOString()
        } else {
          // Create new message
          this.currentSender = MESSAGE_SENDER.USER
          this.messages.push({
            id: Date.now().toString(),
            sender: MESSAGE_SENDER.USER,
            content: content.trim(),
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Error handling user talking message:', error)
      }
    },

    /**
     * Handle avatar response (actual AI generated content)
     * This should only contain the avatar's response, not user input
     */
    handleAvatarMessage(content) {
      if (!content?.trim()) return

      try {
        const messageId = Date.now().toString()
        
        // Always create new message for avatar response
        this.currentSender = MESSAGE_SENDER.AVATAR
        this.messages.push({
          id: messageId,
          sender: MESSAGE_SENDER.AVATAR,
          content: content.trim(),
          timestamp: new Date().toISOString()
        })
        
        this.isAvatarTalking = true
      } catch (error) {
        console.error('Error handling avatar message:', error)
      }
    },

    /**
     * Handle streaming avatar message (partial responses)
     * Following HeyGen's pattern for real-time updates
     */
    handleAvatarTalkingMessage(content) {
      if (!content?.trim()) return

      try {
        // If same sender as previous, update the last message
        if (this.currentSender === MESSAGE_SENDER.AVATAR && this.messages.length > 0) {
          const lastMessage = this.messages[this.messages.length - 1]
          lastMessage.content = content.trim()
          lastMessage.timestamp = new Date().toISOString()
        } else {
          // Create new message
          this.currentSender = MESSAGE_SENDER.AVATAR
          this.messages.push({
            id: Date.now().toString(),
            sender: MESSAGE_SENDER.AVATAR,
            content: content.trim(),
            timestamp: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Error handling avatar talking message:', error)
      }
    },

    /**
     * End current message (called when user or avatar stops talking)
     */
    endMessage() {
      this.currentSender = null
      this.isUserTalking = false
      this.isAvatarTalking = false
    },

    /**
     * Set user talking state
     */
    setUserTalking(isTalking) {
      this.isUserTalking = isTalking
    },

    /**
     * Set avatar talking state  
     */
    setAvatarTalking(isTalking) {
      this.isAvatarTalking = isTalking
    },

    /**
     * Set listening state
     */
    setListening(isListening) {
      this.isListening = isListening
    },

    /**
     * Clear all messages
     */
    clearMessages() {
      this.messages = []
      this.currentSender = null
      this.isUserTalking = false
      this.isAvatarTalking = false
      this.isListening = false
    },

    /**
     * Remove specific message by ID
     */
    removeMessage(messageId) {
      const index = this.messages.findIndex(msg => msg.id === messageId)
      if (index > -1) {
        this.messages.splice(index, 1)
      }
    },

    /**
     * Get messages by sender
     */
    getMessagesBySender(sender) {
      return this.messages.filter(msg => msg.sender === sender)
    },

    /**
     * Get recent messages (last N messages)
     */
    getRecentMessages(count = 10) {
      return this.messages.slice(-count)
    }
  }
})
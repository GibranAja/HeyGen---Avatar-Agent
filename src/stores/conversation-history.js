import { defineStore } from 'pinia'

export const useConversationStore = defineStore('conversation', {
  state: () => ({
    messages: [],
    lastMessageId: 0
  }),

  actions: {
    addUserMessage(content) {
      if (!content.trim()) return
      
      this.messages.push({
        id: ++this.lastMessageId,
        content: content.trim(),
        sender: 'user',
        timestamp: new Date().toISOString()
      })
    },
    
    addAvatarMessage(content) {
      if (!content.trim()) return
      
      this.messages.push({
        id: ++this.lastMessageId,
        content: content.trim(),
        sender: 'avatar',
        timestamp: new Date().toISOString()
      })
    },
    
    clearHistory() {
      this.messages = []
      this.lastMessageId = 0
    }
  }
})
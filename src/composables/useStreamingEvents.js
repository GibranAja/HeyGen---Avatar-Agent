import { ref, computed } from 'vue'
import { useConversationStore } from '../stores/conversation'
import { useAvatarStore } from '../stores/avatar-fixed'

export const useStreamingEvents = () => {
  const conversationStore = useConversationStore()
  const avatarStore = useAvatarStore()

  // Setup streaming event listeners following HeyGen's pattern
  const setupStreamingEventListeners = (avatar) => {
    if (!avatar) return

    console.log('Setting up streaming event listeners for avatar...')

    // User talking events
    avatar.addEventListener('user_start', () => {
      console.log('User started talking')
      avatarStore.setUserTalking(true)
      conversationStore.setUserTalking(true)
    })

    avatar.addEventListener('user_stop', () => {
      console.log('User stopped talking')
      avatarStore.setUserTalking(false)
      conversationStore.setUserTalking(false)
    })

    // Avatar talking events
    avatar.addEventListener('avatar_start_talking', () => {
      console.log('Avatar started talking')
      avatarStore.setAvatarTalking(true)
      conversationStore.setAvatarTalking(true)
      
      // Create initial empty message bubble for avatar when it starts talking
      conversationStore.handleAvatarTalkingMessage("") // Start with empty content
    })

    avatar.addEventListener('avatar_stop_talking', () => {
      console.log('Avatar stopped talking')
      avatarStore.setAvatarTalking(false)
      conversationStore.setAvatarTalking(false)
    })

    // Message content events - these are the key ones for conversation history
    avatar.addEventListener('user_talking_message', (event) => {
      console.log('User talking message:', event.detail.message)
      conversationStore.handleUserTalkingMessage(event.detail.message)
    })

    avatar.addEventListener('avatar_talking_message', (event) => {
      console.log('Avatar talking message:', event.detail.message)
      conversationStore.handleAvatarTalkingMessage(event.detail.message)
    })

    // End message events
    avatar.addEventListener('user_end_message', () => {
      console.log('User message ended')
      conversationStore.endMessage()
    })

    avatar.addEventListener('avatar_end_message', () => {
      console.log('Avatar message ended')
      conversationStore.endMessage()
    })

    console.log('✅ All streaming event listeners set up successfully')
  }

  return {
    setupStreamingEventListeners
  }
}
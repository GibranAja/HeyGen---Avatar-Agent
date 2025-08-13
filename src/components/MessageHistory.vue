<template>
  <div 
    ref="containerRef" 
    class="message-history-container"
    :class="{ 'has-messages': messages.length > 0 }"
  >
    <transition-group name="message" tag="div" class="messages-wrapper">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message-bubble"
        :class="messageClasses(message.sender)"
      >
        <div class="message-header">
          <span class="sender-label">
            {{ getSenderLabel(message.sender) }}
          </span>
          <span class="timestamp">
            {{ formatTime(message.timestamp) }}
          </span>
        </div>
        <div class="message-content">
          {{ message.content }}
        </div>
      </div>
    </transition-group>
    
    <!-- Empty state -->
    <div v-if="messages.length === 0" class="empty-state">
      <p>Conversation will appear here...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useConversationStore, MESSAGE_SENDER } from '../stores/conversation'

// Store
const conversationStore = useConversationStore()

// Refs
const containerRef = ref(null)

// Computed
const messages = computed(() => conversationStore.messages)
const messageCount = computed(() => conversationStore.messageCount)

// Methods
const messageClasses = (sender) => ({
  'message-user': sender === MESSAGE_SENDER.USER,
  'message-avatar': sender === MESSAGE_SENDER.AVATAR
})

const getSenderLabel = (sender) => {
  return sender === MESSAGE_SENDER.USER ? 'You' : 'Avatar'
}

const formatTime = (timestamp) => {
  try {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  } catch (error) {
    return ''
  }
}

const scrollToBottom = async () => {
  await nextTick()
  
  if (containerRef.value && messages.value.length > 0) {
    try {
      containerRef.value.scrollTop = containerRef.value.scrollHeight
    } catch (error) {
      console.error('Error scrolling to bottom:', error)
    }
  }
}

// Watch for new messages and scroll to bottom
watch(messageCount, () => {
  scrollToBottom()
}, { flush: 'post' })

// Auto-scroll when component mounts and has messages
onMounted(() => {
  if (messages.value.length > 0) {
    scrollToBottom()
  }
})
</script>

<style scoped>
.message-history-container {
  width: 100%;
  max-width: 600px;
  height: 150px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  padding: 8px;
  margin: 0 auto;
  background-color: rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.has-messages {
  background-color: rgba(255, 255, 255, 0.02);
}

.messages-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.message-bubble {
  display: flex;
  flex-direction: column;
  max-width: 350px;
  word-wrap: break-word;
  animation: fadeInUp 0.3s ease-out;
}

.message-user {
  align-self: flex-end;
  align-items: flex-end;
}

.message-avatar {
  align-self: flex-start;
  align-items: flex-start;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.sender-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.message-user .sender-label {
  color: #007bff;
}

.message-avatar .sender-label {
  color: #28a745;
}

.timestamp {
  font-size: 10px;
  color: #999;
}

.message-content {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.4;
  background-color: #f8f9fa;
  color: #333;
  border: 1px solid #e9ecef;
}

.message-user .message-content {
  background-color: #007bff;
  color: white;
  border-color: #0056b3;
}

.message-avatar .message-content {
  background-color: #28a745;
  color: white;
  border-color: #1e7e34;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-style: italic;
  font-size: 14px;
}

/* Scrollbar styling */
.message-history-container::-webkit-scrollbar {
  width: 6px;
}

.message-history-container::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 3px;
}

.message-history-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.message-history-container::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.5);
}

/* Animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-enter-active {
  transition: all 0.3s ease-out;
}

.message-leave-active {
  transition: all 0.2s ease-in;
}

.message-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.message-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* Responsive */
@media (max-width: 768px) {
  .message-history-container {
    max-width: 100%;
    height: 120px;
  }
  
  .message-bubble {
    max-width: 280px;
  }
  
  .message-content {
    font-size: 13px;
    padding: 6px 10px;
  }
  
  .sender-label {
    font-size: 11px;
  }
  
  .timestamp {
    font-size: 9px;
  }
}
</style>
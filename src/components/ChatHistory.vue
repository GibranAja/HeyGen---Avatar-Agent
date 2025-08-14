<template>
  <div class="chat-history" ref="chatContainerRef">
    <div v-for="message in messages" :key="message.id" class="message-container">
      <div :class="['message', message.sender === 'user' ? 'user-message' : 'avatar-message']">
        <div class="message-sender">{{ message.sender === 'user' ? 'You' : 'Avatar' }}</div>
        <div class="message-content">{{ message.content }}</div>
      </div>
    </div>
    <div v-if="messages.length === 0" class="empty-chat">
      Conversation will appear here
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useConversationStore } from '../stores/conversation-history'

const props = defineProps({
  maxHeight: {
    type: String,
    default: '300px'
  }
})

const conversationStore = useConversationStore()
const chatContainerRef = ref(null)

const messages = computed(() => conversationStore.messages)

// Auto-scroll to bottom when new messages arrive
watch(messages, () => {
  setTimeout(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight
    }
  }, 100)
}, { deep: true })
</script>

<style scoped>
.chat-history {
  width: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 15px;
  border-radius: 10px;
  background-color: #f0f2f5;
  margin-top: 15px;
  max-height: v-bind('props.maxHeight');
}

.message-container {
  display: flex;
  width: 100%;
}

.message {
  max-width: 80%;
  padding: 10px 15px;
  border-radius: 12px;
  font-size: 14px;
  margin-bottom: 5px;
  position: relative;
}

.user-message {
  background-color: #dcf8c6;
  margin-left: auto;
  border-bottom-right-radius: 2px;
}

.avatar-message {
  background-color: white;
  margin-right: auto;
  border-bottom-left-radius: 2px;
}

.message-sender {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  margin-bottom: 4px;
}

.message-content {
  word-break: break-word;
  line-height: 1.4;
}

.empty-chat {
  text-align: center;
  color: #888;
  font-style: italic;
  padding: 20px;
}
</style>
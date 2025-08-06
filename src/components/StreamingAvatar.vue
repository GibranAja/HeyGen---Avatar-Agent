<template>
  <div class="avatar-container">
    <!-- Controls -->
    <div class="controls-section">
      <div class="input-row">
        <input
          v-model="avatarId"
          placeholder="Avatar ID (e.g., your-avatar-id)"
          class="input-field"
          :disabled="isConnected"
        />
        <input
          v-model="voiceId"
          placeholder="Voice ID (optional)"
          class="input-field"
          :disabled="isConnected"
        />
        <button @click="handleStart" :disabled="isLoading" class="btn btn-start">
          {{ isLoading ? 'Starting...' : 'Start' }}
        </button>
        <button @click="handleClose" :disabled="!isConnected" class="btn btn-close">Close</button>
      </div>

      <div class="input-row">
        <input
          v-model="textToSpeak"
          placeholder="Enter text for avatar to speak"
          class="text-input"
          @keyup.enter="handleSpeak('repeat')"
          :disabled="!isConnected"
        />
        <button
          @click="handleSpeak('talk')"
          :disabled="!isConnected || !textToSpeak.trim()"
          class="btn btn-talk"
        >
          Talk (LLM)
        </button>
        <button
          @click="handleSpeak('repeat')"
          :disabled="!isConnected || !textToSpeak.trim()"
          class="btn btn-repeat"
        >
          Repeat
        </button>
      </div>
    </div>

    <!-- Video Container -->
    <div class="video-container">
      <video
        id="avatarVideo"
        ref="videoRef"
        autoplay
        playsinline
        class="avatar-video"
        controls
        :muted="false"
      ></video>
      <div v-if="!streamReady" class="video-placeholder">
        <div v-if="isLoading" class="loading">Connecting...</div>
        <div v-else class="placeholder-text">Avatar will appear here</div>
      </div>
    </div>

    <!-- Logs -->
    <div class="logs-container">
      <div v-for="(log, index) in logs" :key="index" class="log-entry">
        {{ log }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAvatarStore } from '../stores/avatar-fixed'

const avatarStore = useAvatarStore()
const videoRef = ref(null)

// Reactive refs - removed default values
const avatarId = ref('')
const voiceId = ref('')
const textToSpeak = ref('')

// Computed properties
const isConnected = computed(() => avatarStore.isConnected)
const isLoading = computed(() => avatarStore.isLoading)
const streamReady = computed(() => avatarStore.streamReady)
const logs = computed(() => avatarStore.logs)

// Ensure video is unmuted when component mounts
onMounted(() => {
  if (videoRef.value) {
    videoRef.value.muted = false
    videoRef.value.volume = 1.0
  }
})

// Methods
async function handleStart() {
  try {
    await avatarStore.startSession(avatarId.value, voiceId.value)

    // Ensure video element is unmuted after connection
    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.muted = false
        videoRef.value.volume = 1.0
      }
    }, 1000)
  } catch (error) {
    console.error('Failed to start session:', error)
  }
}

async function handleClose() {
  try {
    await avatarStore.closeSession()
  } catch (error) {
    console.error('Failed to close session:', error)
  }
}

async function handleSpeak(type) {
  if (!textToSpeak.value.trim()) return

  try {
    await avatarStore.speak(textToSpeak.value, type)
    textToSpeak.value = ''
  } catch (error) {
    console.error('Failed to speak:', error)
  }
}
</script>

<style scoped>
.avatar-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.controls-section {
  margin-bottom: 20px;
}

.input-row {
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
}

.input-field {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.input-field:focus {
  outline: none;
  border-color: #007bff;
}

.input-field:disabled {
  background-color: #f5f5f5;
  color: #666;
}

.text-input {
  flex: 1;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.text-input:focus {
  outline: none;
  border-color: #007bff;
}

.text-input:disabled {
  background-color: #f5f5f5;
  color: #666;
}

.btn {
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-start {
  background-color: #28a745;
  color: white;
}

.btn-start:hover:not(:disabled) {
  background-color: #218838;
}

.btn-close {
  background-color: #dc3545;
  color: white;
}

.btn-close:hover:not(:disabled) {
  background-color: #c82333;
}

.btn-talk {
  background-color: #28a745;
  color: white;
}

.btn-talk:hover:not(:disabled) {
  background-color: #218838;
}

.btn-repeat {
  background-color: #007bff;
  color: white;
}

.btn-repeat:hover:not(:disabled) {
  background-color: #0056b3;
}

.video-container {
  position: relative;
  width: 100%;
  height: 400px;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 20px;
}

.avatar-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #1a1a1a;
  color: #fff;
}

.loading {
  font-size: 18px;
  font-weight: 500;
}

.placeholder-text {
  font-size: 16px;
  color: #888;
}

.logs-container {
  height: 150px;
  overflow-y: auto;
  background-color: #000;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  padding: 10px;
  border-radius: 8px;
  line-height: 1.4;
}

.log-entry {
  margin-bottom: 2px;
}

.logs-container::-webkit-scrollbar {
  width: 6px;
}

.logs-container::-webkit-scrollbar-track {
  background: #333;
}

.logs-container::-webkit-scrollbar-thumb {
  background: #666;
  border-radius: 3px;
}
</style>

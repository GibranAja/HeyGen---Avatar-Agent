<template>
  <div class="avatar-container">
    <!-- Knowledge Base Section -->
    <div class="knowledge-base-section">
      <h3>Knowledge Base Management</h3>
      <div class="kb-controls">
        <button @click="createInsuranceKB" :disabled="kbStore.isLoading" class="btn btn-create-kb">
          {{ kbStore.isLoading ? 'Creating...' : 'Create Insurance KB' }}
        </button>
        <button @click="listKnowledgeBases" class="btn btn-list-kb">List KBs</button>
        <button
          @click="updateKBWithCurrentTime"
          :disabled="!knowledgeBaseId.trim() || kbStore.isLoading"
          class="btn btn-update-kb"
        >
          Update Time
        </button>
        <input
          v-model="knowledgeBaseId"
          placeholder="Enter Knowledge Base ID (optional)"
          class="kb-input"
        />
        <div class="time-display">Current: {{ currentTimeGreeting }}</div>
      </div>
    </div>

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

    <!-- Video Controls -->
    <div class="video-controls">
      <label class="video-fit-label">
        Video Fit:
        <select v-model="videoFitMode" @change="updateVideoFit" class="video-fit-select">
          <option value="contain">Contain (Show Full Video)</option>
          <option value="cover">Cover (Fill Container)</option>
          <option value="fill">Fill (Stretch to Fit)</option>
          <option value="scale-down">Scale Down</option>
        </select>
      </label>
      <label class="video-size-label">
        Size:
        <select v-model="videoSize" @change="updateVideoSize" class="video-size-select">
          <option value="small">Small (480px)</option>
          <option value="medium">Medium (640px)</option>
          <option value="large">Large (800px)</option>
          <option value="xlarge">Extra Large (1024px)</option>
        </select>
      </label>
      <button @click="resetVideoSettings" class="btn btn-reset-video">Reset</button>
    </div>

    <!-- Video Container -->
    <div class="video-container" :class="videoSizeClass">
      <video
        id="avatarVideo"
        ref="videoRef"
        autoplay
        playsinline
        class="avatar-video"
        :class="videoFitClass"
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
import { ref, computed, onMounted, watch } from 'vue'
import { useAvatarStore } from '../stores/avatar-fixed'
import { useKnowledgeBaseStore } from '../stores/knowledge-base'

const avatarStore = useAvatarStore()
const kbStore = useKnowledgeBaseStore()
const videoRef = ref(null)

// Reactive refs
const avatarId = ref('')
const voiceId = ref('')
const textToSpeak = ref('')
const knowledgeBaseId = ref('') // Changed from selectedKnowledgeBaseId to knowledgeBaseId
const videoFitMode = ref('contain')
const videoSize = ref('medium')

// Computed properties
const isConnected = computed(() => avatarStore.isConnected)
const isLoading = computed(() => avatarStore.isLoading)
const streamReady = computed(() => avatarStore.streamReady)
const logs = computed(() => [...avatarStore.logs, ...kbStore.logs])
const knowledgeBases = computed(() => kbStore.knowledgeBases)
const currentTimeGreeting = computed(() => kbStore.getTimeGreeting())

const videoFitClass = computed(() => `video-fit-${videoFitMode.value}`)
const videoSizeClass = computed(() => `video-size-${videoSize.value}`)

// Watch for video fit mode changes
watch(videoFitMode, (newMode) => {
  updateVideoFit()
})

// Ensure video is unmuted when component mounts
onMounted(() => {
  if (videoRef.value) {
    videoRef.value.muted = false
    videoRef.value.volume = 1.0
  }
  // Auto-load knowledge bases (optional, for reference)
  listKnowledgeBases()
})

// Methods
async function createInsuranceKB() {
  try {
    const newKB = await kbStore.createInsuranceKnowledgeBase()
    // Auto-fill the input with newly created KB ID
    if (newKB && newKB.id) {
      knowledgeBaseId.value = newKB.id
    }
    await listKnowledgeBases()
  } catch (error) {
    console.error('Failed to create knowledge base:', error)
  }
}

async function listKnowledgeBases() {
  try {
    await kbStore.listKnowledgeBases()
  } catch (error) {
    console.error('Failed to list knowledge bases:', error)
  }
}

async function handleStart() {
  try {
    // Update KB dengan waktu terkini sebelum start (jika ada KB ID)
    if (knowledgeBaseId.value.trim()) {
      await updateKBWithCurrentTime()
      // Tunggu sebentar untuk memastikan update selesai
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    await avatarStore.startSession(avatarId.value, voiceId.value, knowledgeBaseId.value.trim() || null)

    // Ensure video element is unmuted and properly configured after connection
    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.muted = false
        videoRef.value.volume = 1.0
        // Apply current video fit setting
        updateVideoFit()
      }
    }, 1000)

    // Tunggu sampai avatar siap, lalu otomatis mulai greeting
    setTimeout(async () => {
      if (avatarStore.streamReady && avatarStore.isConnected) {
        const currentGreeting = kbStore.getTimeGreeting()
        const greetingScript = kbStore.generateOpeningScript()
        
        console.log('Auto greeting with:', currentGreeting)
        console.log('Greeting script:', greetingScript)
        
        // Gunakan greeting script yang sudah sesuai waktu
        await avatarStore.speak(greetingScript, 'talk')
      }
    }, 2000) // Tunggu 2 detik setelah koneksi berhasil
    
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

async function updateKBWithCurrentTime() {
  if (!knowledgeBaseId.value.trim()) return

  try {
    await kbStore.updateKnowledgeBaseWithCurrentTime(knowledgeBaseId.value.trim())
  } catch (error) {
    console.error('Failed to update knowledge base with current time:', error)
  }
}

function updateVideoFit() {
  // Force re-render video element with new fit mode
  if (videoRef.value) {
    videoRef.value.style.objectFit = videoFitMode.value
    console.log('Video fit updated to:', videoFitMode.value)
  }
}

function updateVideoSize() {
  // The size is handled by CSS classes
  console.log('Video size updated to:', videoSize.value)
}

function resetVideoSettings() {
  videoFitMode.value = 'contain'
  videoSize.value = 'medium'
  updateVideoFit()
}
</script>

<style scoped>
.avatar-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.knowledge-base-section {
  margin-bottom: 20px;
  padding: 15px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background-color: #f8f9fa;
}

.knowledge-base-section h3 {
  margin: 0 0 15px 0;
  color: #495057;
  font-size: 16px;
}

.kb-controls {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.btn-create-kb {
  background-color: #17a2b8;
  color: white;
}

.btn-create-kb:hover:not(:disabled) {
  background-color: #138496;
}

.btn-list-kb {
  background-color: #6c757d;
  color: white;
}

.btn-list-kb:hover:not(:disabled) {
  background-color: #5a6268;
}

.btn-update-kb {
  background-color: #ffc107;
  color: #212529;
}

.btn-update-kb:hover:not(:disabled) {
  background-color: #e0a800;
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

.btn-reset-video {
  background-color: #6c757d;
  color: white;
  font-size: 12px;
  padding: 8px 16px;
}

.btn-reset-video:hover:not(:disabled) {
  background-color: #5a6268;
}

.video-controls {
  display: flex;
  gap: 15px;
  margin-bottom: 15px;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.video-fit-label,
.video-size-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
}

.video-fit-select,
.video-size-select {
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  background-color: white;
  cursor: pointer;
  min-width: 160px;
}

.video-fit-select:focus,
.video-size-select:focus {
  outline: none;
  border-color: #007bff;
}

.video-container {
  position: relative;
  width: 100%;
  max-width: 640px;
  height: 0;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  margin: 0 auto 20px auto;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 2px solid #333;
}

.video-container.video-size-small {
  max-width: 480px;
}

.video-container.video-size-medium {
  max-width: 640px;
}

.video-container.video-size-large {
  max-width: 800px;
}

.video-container.video-size-xlarge {
  max-width: 1024px;
}

.avatar-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
}

.avatar-video.video-fit-contain {
  object-fit: contain;
}

.avatar-video.video-fit-cover {
  object-fit: cover;
}

.avatar-video.video-fit-fill {
  object-fit: fill;
}

.avatar-video.video-fit-scale-down {
  object-fit: scale-down;
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

.kb-input {
  flex: 1;
  min-width: 250px;
  padding: 12px;
  border: 2px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.kb-input:focus {
  outline: none;
  border-color: #007bff;
}

.kb-input::placeholder {
  color: #999;
}

.time-display {
  background-color: #e9ecef;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
  font-weight: 500;
}

.controls-section {
  margin-bottom: 20px;
  padding: 15px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  background-color: #fff;
}

@media (max-width: 768px) {
  .video-controls {
    flex-direction: column;
    gap: 10px;
  }
  
  .video-fit-label,
  .video-size-label {
    width: 100%;
    justify-content: space-between;
  }
  
  .video-fit-select,
  .video-size-select {
    min-width: 180px;
  }
  
  .kb-input {
    min-width: 200px;
  }
}
</style>
<template>
  <div class="avatar-container" @click="handleUserInteraction" @keydown="handleUserInteraction">
    <!-- User Interaction Notice -->
    <div v-if="!hasUserInteracted && streamReady" class="interaction-notice">
      <div class="notice-content">
        <h3>🎵 Audio Ready</h3>
        <p>Click anywhere to enable audio and video playback</p>
        <button class="enable-button" @click="handleUserInteraction">Enable Audio</button>
      </div>
    </div>
    
    <!-- Main Content Layout -->
    <div class="main-content-layout">
      <!-- Video Section -->
      <div class="video-section">
        <div class="video-container">
          <video
            id="avatarVideo"
            ref="videoRef"
            autoplay
            playsinline
            class="avatar-video"
            controls
            :muted="!hasUserInteracted"
          ></video>
          <div v-if="!streamReady" class="video-placeholder">
            <div v-if="isLoading" class="loading">Connecting...</div>
            <div v-else class="placeholder-text">Avatar will appear here</div>
          </div>
        </div>
        
        <!-- Session Status -->
        <div class="session-status">
          <div v-if="isConnected" class="status-connected">
            🟢 Connected | Recording: {{ isRecordingConversation ? '🔴 Active' : '⚪ Standby' }}
            <div v-if="isSpeaking" class="speaking-status">🎤 Avatar is speaking...</div>
            <div v-if="!hasUserInteracted" class="audio-status">🔇 Audio disabled - click to enable</div>
          </div>
          <div v-else class="status-disconnected">🔴 Disconnected</div>
          <div class="auto-close-timer" v-if="isConnected && autoCloseCountdown > 0 && !isSpeaking">
            Auto-close in: {{ autoCloseCountdown }}s
          </div>
        </div>

        <!-- Voice Recording Status -->
        <div class="voice-status">
          <div v-if="isRecording" class="recording-indicator">
            🔴 Listening...
          </div>
          <div v-else class="standby-indicator">
            🎤 Ready to listen
          </div>
          <div v-if="transcribedText" class="transcribed-text">
            "{{ transcribedText }}"
          </div>
        </div>
      </div>
    </div>

    <!-- Logs Container -->
    <div class="logs-container">
      <div v-for="(log, index) in logs" :key="index" class="log-entry">
        {{ log }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAvatarStore } from '../stores/avatar-fixed'
import { useKnowledgeBaseStore } from '../stores/knowledge-base'

const avatarStore = useAvatarStore()
const kbStore = useKnowledgeBaseStore()
const videoRef = ref(null)

// Default values
const DEFAULT_AVATAR_ID = 'Thaddeus_ProfessionalLook2_public'
const DEFAULT_VOICE_ID = 'b9d8767fcb1646be972ffc2de07c5229'
const DEFAULT_KB_ID = '0d3920ed712647c2bf5da2a059cece9d'
const AUTO_CLOSE_TIMEOUT = 25000

// Reactive refs
const recognition = ref(null)
const isRecording = ref(false)
const transcribedText = ref('')

// Auto-close functionality  
const autoCloseTimer = ref(null)
const autoCloseCountdown = ref(0)
const countdownInterval = ref(null)

// Audio Recording functionality
const isRecordingConversation = ref(false)
const mediaRecorder = ref(null)
const recordedChunks = ref([])
const recordedAudioBlob = ref(null)
const audioContext = ref(null)
const mixedStream = ref(null)

// System messages for important events only
const systemMessages = ref([])

// Computed properties
const isConnected = computed(() => avatarStore.isConnected)
const isLoading = computed(() => avatarStore.isLoading)
const streamReady = computed(() => avatarStore.streamReady)
const isSpeaking = computed(() => avatarStore.isSpeaking)
const logs = computed(() => [...avatarStore.logs, ...kbStore.logs])
const hasUserInteracted = computed(() => avatarStore.hasUserInteracted)

// User interaction handler
function handleUserInteraction() {
  if (!avatarStore.hasUserInteracted) {
    avatarStore.setUserInteraction()
    
    // Try to play video and audio now
    const videoElement = videoRef.value
    const audioElement = document.getElementById('avatarAudio')
    
    if (videoElement) {
      videoElement.muted = false
      videoElement.volume = 1.0
      videoElement.play().catch(console.error)
    }
    
    if (audioElement) {
      audioElement.muted = false
      audioElement.volume = 1.0
      audioElement.play().catch(console.error)
    }
  }
}

// Auto-start when component mounts
onMounted(async () => {
  console.log('Component mounted, starting auto-initialization...')
  await initializeComponent()
})

onUnmounted(() => {
  cleanup()
})

// Watch for streamReady to start services
watch(streamReady, (newVal) => {
  if (newVal) {
    setTimeout(async () => {
      await startConversationRecording()
      startVoiceRecognition()
      resetAutoCloseTimer()
    }, 2000)
  }
})

// Watch speaking status for smart timer
watch(isSpeaking, (newVal) => {
  if (newVal) {
    // Avatar started speaking, pause timer
    pauseAutoCloseTimer()
  } else {
    // Avatar stopped speaking, restart timer
    setTimeout(() => {
      if (isConnected.value && !isSpeaking.value) {
        resetAutoCloseTimer()
      }
    }, 1000)
  }
})

// Initialize component
async function initializeComponent() {
  try {
    if (videoRef.value) {
      videoRef.value.muted = true // Start muted
      videoRef.value.volume = 1.0
      videoRef.value.style.objectFit = 'contain'
    }

    initializeSpeechRecognition()
    
    await kbStore.updateKnowledgeBaseWithCurrentTime(DEFAULT_KB_ID)
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('Starting avatar session with defaults...')
    await avatarStore.startSession(DEFAULT_AVATAR_ID, DEFAULT_VOICE_ID, DEFAULT_KB_ID)

    // Auto greeting after session ready
    setTimeout(async () => {
      if (avatarStore.streamReady && avatarStore.isConnected) {
        const greetingScript = kbStore.generateOpeningScript()
        console.log('Auto greeting:', greetingScript)
        
        await avatarStore.speak(greetingScript, 'talk')
      }
    }, 3000)
    
  } catch (error) {
    console.error('Failed to initialize component:', error)
    addSystemMessage(`Initialization error: ${error.message}`)
  }
}

// Auto-close timer management dengan smart logic
function resetAutoCloseTimer() {
  // Clear existing timers
  clearAutoCloseTimers()
  
  // Only start timer if avatar is NOT speaking
  if (!isSpeaking.value) {
    autoCloseCountdown.value = 25
    
    autoCloseTimer.value = setTimeout(() => {
      handleAutoClose()
    }, AUTO_CLOSE_TIMEOUT)
    
    countdownInterval.value = setInterval(() => {
      if (!isSpeaking.value) {
        autoCloseCountdown.value--
        if (autoCloseCountdown.value <= 0) {
          clearInterval(countdownInterval.value)
        }
      }
    }, 1000)
  }
}

function pauseAutoCloseTimer() {
  clearAutoCloseTimers()
  autoCloseCountdown.value = 0
}

function clearAutoCloseTimers() {
  if (autoCloseTimer.value) {
    clearTimeout(autoCloseTimer.value)
    autoCloseTimer.value = null
  }
  if (countdownInterval.value) {
    clearInterval(countdownInterval.value)
    countdownInterval.value = null
  }
}

async function handleAutoClose() {
  try {
    addSystemMessage('Session auto-closing due to inactivity...')
    
    const closingMessage = "Terima kasih atas waktunya. Semoga harinya menyenangkan!"
    await avatarStore.speak(closingMessage, 'talk')
    
    setTimeout(async () => {
      await closeSessionAndDownload()
    }, 3000)
    
  } catch (error) {
    console.error('Error in auto-close:', error)
    await closeSessionAndDownload()
  }
}

async function closeSessionAndDownload() {
  try {
    if (isRecordingConversation.value) {
      await stopConversationRecording()
    }
    
    await avatarStore.closeSession()
    
    setTimeout(() => {
      downloadRecording()
    }, 1000)
    
    addSystemMessage('Session closed. Files will download automatically.')
    
  } catch (error) {
    console.error('Error closing session:', error)
  }
}

// Speech Recognition Setup
function initializeSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition.value = new SpeechRecognition()
    
    recognition.value.continuous = false
    recognition.value.interimResults = false
    recognition.value.lang = 'id-ID'
    
    recognition.value.onstart = () => {
      console.log('Speech recognition started')
      isRecording.value = true
    }
    
    recognition.value.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      transcribedText.value = transcript
      
      // Auto enable audio on voice input
      if (!hasUserInteracted.value) {
        handleUserInteraction()
      }
      
      setTimeout(() => {
        handleUserMessage(transcript)
      }, 500)
    }
    
    recognition.value.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      isRecording.value = false
      
      setTimeout(() => {
        if (isConnected.value) {
          startVoiceRecognition()
        }
      }, 2000)
    }
    
    recognition.value.onend = () => {
      isRecording.value = false
      
      setTimeout(() => {
        if (isConnected.value && !isRecording.value) {
          startVoiceRecognition()
        }
      }, 1000)
    }
  }
}

function startVoiceRecognition() {
  if (recognition.value && !isRecording.value) {
    try {
      transcribedText.value = ''
      recognition.value.start()
    } catch (error) {
      console.error('Error starting recognition:', error)
    }
  }
}

// Message Handling
async function handleUserMessage(message) {
  if (!message.trim()) return

  resetAutoCloseTimer()
  
  const trimmedMessage = message.trim()
  
  try {
    await avatarStore.speak(trimmedMessage, 'talk')
    transcribedText.value = ''
    
  } catch (error) {
    console.error('Failed to send message:', error)
    addSystemMessage('Failed to send message')
  }
}

// System message helper
function addSystemMessage(content) {
  systemMessages.value.push({
    content,
    time: new Date().toLocaleTimeString()
  })
  
  // Keep only last 5 system messages
  if (systemMessages.value.length > 5) {
    systemMessages.value = systemMessages.value.slice(-5)
  }
}

// Audio Recording Functions
async function startConversationRecording() {
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        channelCount: 2
      } 
    })

    const videoElement = videoRef.value
    let avatarStream = null
    
    if (videoElement && videoElement.captureStream) {
      avatarStream = videoElement.captureStream()
    } else if (videoElement && videoElement.mozCaptureStream) {
      avatarStream = videoElement.mozCaptureStream()
    }

    audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
    const destination = audioContext.value.createMediaStreamDestination()

    const micGain = audioContext.value.createGain()
    const avatarGain = audioContext.value.createGain()
    
    micGain.gain.value = 1.0
    avatarGain.gain.value = 1.0

    const micSource = audioContext.value.createMediaStreamSource(micStream)
    micSource.connect(micGain)
    micGain.connect(destination)

    if (avatarStream) {
      const avatarAudioTracks = avatarStream.getAudioTracks()
      if (avatarAudioTracks.length > 0) {
        const avatarSource = audioContext.value.createMediaStreamSource(avatarStream)
        avatarSource.connect(avatarGain)
        avatarGain.connect(destination)
      }
    }

    mixedStream.value = destination.stream

    let mimeType = 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'
    }

    mediaRecorder.value = new MediaRecorder(mixedStream.value, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000
    })

    recordedChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(recordedChunks.value, { type: 'audio/mpeg' })
      recordedAudioBlob.value = blob
      console.log('Recording ready:', recordedAudioBlob.value.size, 'bytes')
    }

    mediaRecorder.value.start(1000)
    isRecordingConversation.value = true
    
  } catch (error) {
    console.error('Error starting conversation recording:', error)
  }
}

async function stopConversationRecording() {
  try {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
    }

    if (mixedStream.value) {
      mixedStream.value.getTracks().forEach(track => track.stop())
    }

    if (audioContext.value && audioContext.value.state !== 'closed') {
      await audioContext.value.close()
    }

    isRecordingConversation.value = false

  } catch (error) {
    console.error('Error stopping conversation recording:', error)
  }
}

function downloadRecording() {
  if (!recordedAudioBlob.value) {
    console.log('No recording available')
    return
  }

  try {
    const url = URL.createObjectURL(recordedAudioBlob.value)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `conversation_${timestamp}.mp3`
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Error downloading recording:', error)
  }
}

function cleanup() {
  clearAutoCloseTimers()
  if (recognition.value) {
    recognition.value.stop()
  }
  if (isRecordingConversation.value) {
    stopConversationRecording()
  }
}
</script>

<style scoped>
.avatar-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
}

/* User Interaction Notice */
.interaction-notice {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(5px);
}

.notice-content {
  background: white;
  padding: 30px;
  border-radius: 15px;
  text-align: center;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
  max-width: 400px;
}

.notice-content h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 24px;
}

.notice-content p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 16px;
}

.enable-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px 30px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.enable-button:hover {
  background: #0056b3;
}

.main-content-layout {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
}

.video-section {
  flex: 1;
  max-width: 640px;
}

.video-container {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border: 2px solid #333;
}

.avatar-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  object-fit: contain;
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

.session-status {
  margin-top: 15px;
  padding: 12px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  text-align: center;
}

.status-connected {
  color: #28a745;
  font-weight: 500;
  font-size: 14px;
}

.speaking-status {
  margin-top: 5px;
  color: #007bff;
  font-size: 12px;
  font-style: italic;
}

.audio-status {
  margin-top: 5px;
  color: #ffc107;
  font-size: 12px;
  font-style: italic;
}

.status-disconnected {
  color: #dc3545;
  font-weight: 500;
  font-size: 14px;
}

.auto-close-timer {
  margin-top: 8px;
  color: #ffc107;
  font-weight: bold;
  font-size: 13px;
}

.voice-status {
  margin-top: 15px;
  padding: 12px;
  background-color: #e9ecef;
  border-radius: 8px;
  text-align: center;
  border: 1px solid #ced4da;
}

.recording-indicator {
  color: #dc3545;
  font-weight: bold;
  font-size: 14px;
  animation: pulse 1s infinite;
}

.standby-indicator {
  color: #28a745;
  font-weight: 500;
  font-size: 14px;
}

.transcribed-text {
  margin-top: 8px;
  background-color: #fff;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 12px;
  color: #495057;
  border: 1px solid #dee2e6;
  font-style: italic;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.logs-container {
  height: 120px;
  overflow-y: auto;
  background-color: #000;
  color: #00ff00;
  font-family: 'Courier New', monospace;
  font-size: 11px;
  padding: 10px;
  border-radius: 8px;
  line-height: 1.3;
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

/* Responsive Design */
@media (max-width: 1200px) {
  .main-content-layout {
    flex-direction: column;
  }
  
  .video-section {
    max-width: 100%;
  }
}

@media (max-width: 768px) {
  .avatar-container {
    padding: 15px;
  }
  
  .main-content-layout {
    gap: 20px;
  }
  
  .notice-content {
    margin: 20px;
    padding: 20px;
  }
}
</style>
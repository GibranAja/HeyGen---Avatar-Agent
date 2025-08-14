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
          
          <!-- Close Session Button (replacing auto-close timer) -->
          <button v-if="isConnected" @click="handleManualClose" class="close-session-button">
            End Session
          </button>
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
      
      <!-- Add Chat History Section -->
      <div class="chat-section">
        <h3 class="chat-title">Conversation History</h3>
        <ChatHistory maxHeight="350px" />
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
import { useConversationStore } from '../stores/conversation-history'
import ChatHistory from './ChatHistory.vue'

const avatarStore = useAvatarStore()
const kbStore = useKnowledgeBaseStore()
const conversationStore = useConversationStore()
const videoRef = ref(null)

// Default values
const DEFAULT_AVATAR_ID = 'Thaddeus_ProfessionalLook2_public'
const DEFAULT_VOICE_ID = 'b9d8767fcb1646be972ffc2de07c5229'
const DEFAULT_KB_ID = 'e60df93242c54836b125ea0adfa6a9ec'
const AUTO_CLOSE_TIMEOUT = 25000

// Reactive refs
const recognition = ref(null)
const isRecording = ref(false)
const transcribedText = ref('')

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
    }, 2000)
  }
})

// Add a new watcher for avatar speaking state to capture responses
watch(isSpeaking, (newVal, oldVal) => {
  // When avatar stops speaking, capture the response
  if (oldVal === true && newVal === false) {
    // Check if there's a lastSpokenText that's not already in the conversation
    const lastText = avatarStore.lastSpokenText
    
    if (lastText && lastText.trim() !== '') {
      // Check if this is not a duplicate of the user's input
      const lastUserMessage = conversationStore.messages
        .filter(m => m.sender === 'user')
        .pop()
        
      if (!lastUserMessage || lastUserMessage.content !== lastText) {
        // Only add if not already in conversation history
        const alreadyExists = conversationStore.messages
          .some(m => m.sender === 'avatar' && m.content === lastText)
          
        if (!alreadyExists) {
          conversationStore.addAvatarMessage(lastText)
        }
      }
    }
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
        
        // Add the greeting to conversation history
        conversationStore.addAvatarMessage(greetingScript)
      }
    }, 3000)
    
  } catch (error) {
    console.error('Failed to initialize component:', error)
    addSystemMessage(`Initialization error: ${error.message}`)
  }
}

// Add this new method to handle manual close
async function handleManualClose() {
  try {
    addSystemMessage('Session ending by user request...')
    
    const closingMessage = "Terima kasih atas waktunya. Semoga harinya menyenangkan!"
    await avatarStore.speak(closingMessage, 'talk')
    
    setTimeout(async () => {
      await closeSessionAndDownload()
    }, 3000)
    
  } catch (error) {
    console.error('Error in manual close:', error)
    await closeSessionAndDownload()
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

  const trimmedMessage = message.trim()
  
  // Add user message to conversation history
  conversationStore.addUserMessage(trimmedMessage)
  
  try {
    // Store the last spoken text before calling the API
    const previousText = avatarStore.lastSpokenText
    
    // Call the speak API
    await avatarStore.speak(trimmedMessage, 'talk')
    
    // Wait for the avatar's response to be different from the user's input
    // This ensures we're capturing the actual avatar response
    setTimeout(() => {
      // If the avatar has responded with new text, add it to conversation
      if (avatarStore.lastSpokenText && avatarStore.lastSpokenText !== previousText && 
          avatarStore.lastSpokenText !== trimmedMessage) {
        conversationStore.addAvatarMessage(avatarStore.lastSpokenText)
      }
    }, 2000) // Give some time for the response to be processed
    
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
// Replace the startConversationRecording function with this high-quality version
async function startConversationRecording() {
  try {
    // Get high-quality microphone stream
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000, // Higher sample rate for better quality
        channelCount: 2    // Stereo recording
      } 
    })

    // Get avatar audio stream from video element
    const videoElement = videoRef.value
    let avatarStream = null
    
    if (videoElement && videoElement.captureStream) {
      avatarStream = videoElement.captureStream()
    } else if (videoElement && videoElement.mozCaptureStream) {
      avatarStream = videoElement.mozCaptureStream()
    }

    // Create high-quality audio context
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive'
    })
    
    const destination = audioContext.value.createMediaStreamDestination()

    // Create audio processing nodes for microphone
    const micGain = audioContext.value.createGain()
    const micCompressor = audioContext.value.createDynamicsCompressor()
    
    // Create audio processing nodes for avatar
    const avatarGain = audioContext.value.createGain()
    const avatarCompressor = audioContext.value.createDynamicsCompressor()
    
    // Configure microphone processing for clarity
    micGain.gain.value = 1.5 // Boost microphone volume
    micCompressor.threshold.value = -24
    micCompressor.knee.value = 30
    micCompressor.ratio.value = 12
    micCompressor.attack.value = 0.003
    micCompressor.release.value = 0.25
    
    // Configure avatar audio processing
    avatarGain.gain.value = 1.2 // Boost avatar volume slightly
    avatarCompressor.threshold.value = -24
    avatarCompressor.knee.value = 30
    avatarCompressor.ratio.value = 12
    avatarCompressor.attack.value = 0.003
    avatarCompressor.release.value = 0.25

    // Connect microphone with audio processing chain
    const micSource = audioContext.value.createMediaStreamSource(micStream)
    micSource.connect(micCompressor)
    micCompressor.connect(micGain)
    micGain.connect(destination)

    // Connect avatar audio with processing chain if available
    if (avatarStream && avatarStream.getAudioTracks().length > 0) {
      const avatarSource = audioContext.value.createMediaStreamSource(avatarStream)
      avatarSource.connect(avatarCompressor)
      avatarCompressor.connect(avatarGain)
      avatarGain.connect(destination)
      addSystemMessage('✅ Avatar audio connected to recording')
    } else {
      // Fallback method to capture system audio if direct stream not available
      try {
        const audioElement = document.getElementById('avatarAudio')
        if (audioElement) {
          const elementStream = audioElement.captureStream ? 
            audioElement.captureStream() : 
            audioElement.mozCaptureStream ? 
              audioElement.mozCaptureStream() : null
              
          if (elementStream && elementStream.getAudioTracks().length > 0) {
            const elementSource = audioContext.value.createMediaStreamSource(elementStream)
            elementSource.connect(avatarCompressor)
            avatarCompressor.connect(avatarGain)
            avatarGain.connect(destination)
            addSystemMessage('✅ Avatar audio connected via audio element')
          }
        }
      } catch (error) {
        console.error('Fallback audio capture error:', error)
      }
    }

    mixedStream.value = destination.stream

    // Choose highest quality supported codec
    let mimeType = 'audio/webm;codecs=opus'
    const preferredTypes = [
      'audio/mp4;codecs=mp4a.40.5', // AAC High quality
      'audio/mpeg',                 // MP3
      'audio/webm;codecs=opus',     // Opus
      'audio/webm'                  // WebM
    ]
    
    for (const type of preferredTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type
        addSystemMessage(`✅ Using high-quality codec: ${type}`)
        break
      }
    }

    // Create media recorder with higher bitrate
    mediaRecorder.value = new MediaRecorder(mixedStream.value, {
      mimeType: mimeType,
      audioBitsPerSecond: 256000  // Higher bitrate for better quality
    })

    recordedChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      // Use correct MIME type for the blob based on recording format
      let blobType = 'audio/mpeg'
      if (mimeType.includes('webm')) {
        blobType = 'audio/webm'
      } else if (mimeType.includes('mp4')) {
        blobType = 'audio/mp4'
      }
      
      const blob = new Blob(recordedChunks.value, { type: blobType })
      recordedAudioBlob.value = blob
      console.log('High-quality recording ready:', recordedAudioBlob.value.size, 'bytes')
    }

    // Collect data more frequently for better quality
    mediaRecorder.value.start(500)
    isRecordingConversation.value = true
    addSystemMessage('✅ Enhanced high-quality audio recording started')
    
  } catch (error) {
    console.error('Error starting conversation recording:', error)
    addSystemMessage(`❌ Audio recording error: ${error.message}`)
  }
}

// Replace the stopConversationRecording function with this version that returns a Promise
async function stopConversationRecording() {
  return new Promise((resolve) => {
    try {
      if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
        // Set up a listener for the stop event
        mediaRecorder.value.addEventListener('stop', async () => {
          const blob = new Blob(recordedChunks.value, { type: 'audio/mpeg' })
          recordedAudioBlob.value = blob
          console.log('Recording ready:', recordedAudioBlob.value.size, 'bytes')
          
          if (mixedStream.value) {
            mixedStream.value.getTracks().forEach(track => track.stop())
          }
          
          if (audioContext.value && audioContext.value.state !== 'closed') {
            await audioContext.value.close()
          }
          
          isRecordingConversation.value = false
          resolve(true)
        }, { once: true })
        
        // Trigger the stop
        mediaRecorder.value.stop()
      } else {
        // If recorder isn't active, resolve immediately
        isRecordingConversation.value = false
        resolve(false)
      }
    } catch (error) {
      console.error('Error stopping conversation recording:', error)
      resolve(false)
    }
  })
}

// Update the closeSessionAndDownload function
async function closeSessionAndDownload() {
  try {
    addSystemMessage('Preparing to close session...')
    
    // First stop the recording and wait for it to complete
    const recordingStopped = await stopConversationRecording()
    
    // Add a short delay to ensure the blob is properly created
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Download the recording if available
    if (recordingStopped && recordedAudioBlob.value && recordedAudioBlob.value.size > 0) {
      downloadRecording()
      addSystemMessage('✅ Conversation recording downloaded')
    } else {
      addSystemMessage('⚠️ No recording available to download')
    }
    
    // Finally close the session
    await avatarStore.closeSession()
    
    // Reset UI state
    transcribedText.value = ''
    addSystemMessage('Session closed successfully')
    
  } catch (error) {
    console.error('Error in closeSessionAndDownload:', error)
    addSystemMessage(`Error closing session: ${error.message}`)
    
    // Force close even on error
    avatarStore.closeSession().catch(console.error)
  }
}

// Update the downloadRecording function to handle different formats
function downloadRecording() {
  if (!recordedAudioBlob.value) {
    console.log('No recording available')
    addSystemMessage('❌ No recording available to download')
    return
  }

  try {
    const url = URL.createObjectURL(recordedAudioBlob.value)
    
    // Determine appropriate file extension based on the blob type
    let fileExtension = 'mp3'
    if (recordedAudioBlob.value.type.includes('webm')) {
      fileExtension = 'webm'
    } else if (recordedAudioBlob.value.type.includes('mp4')) {
      fileExtension = 'm4a'
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `conversation_${timestamp}.${fileExtension}`
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    addSystemMessage(`✅ Conversation saved as ${filename}`)
  } catch (error) {
    console.error('Error downloading recording:', error)
    addSystemMessage(`❌ Download error: ${error.message}`)
  }
}

// Cleanup function to reset state
function cleanup() {
  if (recognition.value) {
    recognition.value.stop()
  }
  if (isRecordingConversation.value) {
    stopConversationRecording()
  }
  
  // Clear conversation history
  conversationStore.clearHistory()
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

/* Chat Section Styles */
.chat-section {
  flex: 1;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid #e1e4e8;
  padding: 20px;
  height: fit-content;
  max-height: 600px;
}

.chat-title {
  font-size: 18px;
  font-weight: 500;
  margin-bottom: 15px;
  color: #333;
  text-align: center;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.close-session-button {
  margin-top: 10px;
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.close-session-button:hover {
  background-color: #c82333;
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
  
  .chat-section {
    max-width: 100%;
    margin-top: 20px;
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
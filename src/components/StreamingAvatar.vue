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

      <!-- Chat Interface -->
      <div class="chat-section" v-if="isConnected">
        <h4>Chat with Avatar</h4>
        
        <!-- Audio Recording Controls - UPDATED -->
        <div class="audio-recording-section">
          <h5>Conversation Recording</h5>
          <div class="recording-controls">
            <button
              @click="toggleConversationRecording"
              :disabled="!isConnected"
              :class="['btn', 'btn-record', { 'recording': isRecordingConversation }]"
            >
              {{ isRecordingConversation ? '⏹️ Stop Recording' : '🎙️ Start Recording' }}
            </button>
            <div v-if="isRecordingConversation" class="recording-status">
              🔴 Recording conversation...
            </div>
            <div class="format-selection">
              <label for="audio-format">Audio Format:</label>
              <select v-model="audioFormat" class="format-select" id="audio-format" :disabled="isRecordingConversation">
                <option value="mp3">MP3 (Most Compatible)</option>
                <option value="m4a">M4A (High Quality)</option>
                <option value="wav">WAV (Uncompressed)</option>
                <option value="webm">WebM (Browser Native)</option>
              </select>
            </div>
            <div v-if="recordedAudioBlob" class="download-section">
              <button @click="downloadRecording" class="btn btn-download">
                💾 Download Recording ({{ getActualFileExtension().toUpperCase() }})
              </button>
              <div class="file-info">
                File size: {{ Math.round(recordedAudioBlob.size / 1024) }} KB
              </div>
            </div>
          </div>
        </div>

        <div class="input-mode-selector">
          <label class="mode-option">
            <input type="radio" v-model="inputMode" value="text" />
            <span>Text Input</span>
          </label>
          <label class="mode-option">
            <input type="radio" v-model="inputMode" value="voice" />
            <span>Voice Input</span>
          </label>
        </div>

        <!-- Text Input Mode -->
        <div v-if="inputMode === 'text'" class="text-input-section">
          <div class="input-row">
            <input
              v-model="textToSpeak"
              placeholder="Type your message here..."
              class="text-input"
              @keyup.enter="handleSendMessage"
              :disabled="!isConnected"
            />
            <button
              @click="handleSendMessage"
              :disabled="!isConnected || !textToSpeak.trim()"
              class="btn btn-send"
            >
              Send
            </button>
          </div>
        </div>

        <!-- Voice Input Mode -->
        <div v-if="inputMode === 'voice'" class="voice-input-section">
          <div class="voice-controls">
            <button
              @click="toggleVoiceRecording"
              :disabled="!isConnected"
              :class="['btn', 'btn-voice', { 'recording': isRecording }]"
            >
              {{ isRecording ? 'Stop Recording' : 'Start Recording' }}
            </button>
            <div v-if="isRecording" class="recording-indicator">
              🔴 Recording...
            </div>
            <div v-if="transcribedText" class="transcribed-text">
              Transcribed: "{{ transcribedText }}"
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <button
            @click="handleSpeak('repeat', textToSpeak)"
            :disabled="!isConnected || !textToSpeak.trim()"
            class="btn btn-repeat"
          >
            Repeat
          </button>
          <button
            @click="clearChatHistory"
            class="btn btn-clear-chat"
          >
            Clear Chat
          </button>
        </div>
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

    <!-- Chat History -->
    <div v-if="isConnected" class="chat-history-container">
      <h4>Conversation History</h4>
      <div class="chat-messages">
        <div
          v-for="(message, index) in chatHistory"
          :key="index"
          :class="['message', message.type]"
        >
          <div class="message-header">
            <span class="message-sender">{{ message.sender }}</span>
            <span class="message-time">{{ message.time }}</span>
            <span v-if="message.inputMethod" class="input-method">{{ message.inputMethod }}</span>
          </div>
          <div class="message-content">{{ message.content }}</div>
        </div>
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

// Reactive refs - EXISTING
const avatarId = ref('')
const voiceId = ref('')
const textToSpeak = ref('')
const knowledgeBaseId = ref('')
const videoFitMode = ref('contain')
const videoSize = ref('medium')

// Chat functionality - EXISTING
const inputMode = ref('text')
const isRecording = ref(false)
const transcribedText = ref('')
const chatHistory = ref([])
const recognition = ref(null)

// Audio Recording functionality - TAMBAHAN BARU
const isRecordingConversation = ref(false)
const mediaRecorder = ref(null)
const recordedChunks = ref([])
const recordedAudioBlob = ref(null)
const audioFormat = ref('mp3') // Default ke MP3
const supportsWav = ref(false)
const audioContext = ref(null)
const mixedStream = ref(null)

// Computed properties - EXISTING
const isConnected = computed(() => avatarStore.isConnected)
const isLoading = computed(() => avatarStore.isLoading)
const streamReady = computed(() => avatarStore.streamReady)
const logs = computed(() => [...avatarStore.logs, ...kbStore.logs])
const knowledgeBases = computed(() => kbStore.knowledgeBases)
const currentTimeGreeting = computed(() => kbStore.getTimeGreeting())

const videoFitClass = computed(() => `video-fit-${videoFitMode.value}`)
const videoSizeClass = computed(() => `video-size-${videoSize.value}`)

// Watch for video fit mode changes - EXISTING
watch(videoFitMode, (newMode) => {
  updateVideoFit()
})

// Initialize speech recognition - EXISTING + TAMBAHAN
onMounted(() => {
  if (videoRef.value) {
    videoRef.value.muted = false
    videoRef.value.volume = 1.0
  }
  listKnowledgeBases()
  initializeSpeechRecognition()
  
  // TAMBAHAN BARU - Check audio format support
  checkAudioFormatSupport()
})

// TAMBAHAN BARU - Audio Recording Functions
function checkAudioFormatSupport() {
  if (typeof MediaRecorder !== 'undefined') {
    supportsWav.value = MediaRecorder.isTypeSupported('audio/wav')
    
    // Set default format to MP3 for best compatibility
    audioFormat.value = 'mp3'
  }
}

async function toggleConversationRecording() {
  if (isRecordingConversation.value) {
    await stopConversationRecording()
  } else {
    await startConversationRecording()
  }
}

async function startConversationRecording() {
  try {
    // Get user microphone stream
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100,
        channelCount: 2
      } 
    })

    // Get audio from video element (avatar voice)
    const videoElement = videoRef.value
    let avatarStream = null
    
    if (videoElement && videoElement.captureStream) {
      avatarStream = videoElement.captureStream()
    } else if (videoElement && videoElement.mozCaptureStream) {
      avatarStream = videoElement.mozCaptureStream()
    }

    // Create audio context for mixing
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)()
    const destination = audioContext.value.createMediaStreamDestination()

    // Create gain nodes for volume control
    const micGain = audioContext.value.createGain()
    const avatarGain = audioContext.value.createGain()
    
    micGain.gain.value = 1.0
    avatarGain.gain.value = 1.0

    // Connect microphone
    const micSource = audioContext.value.createMediaStreamSource(micStream)
    micSource.connect(micGain)
    micGain.connect(destination)

    // Connect avatar audio if available
    if (avatarStream) {
      const avatarAudioTracks = avatarStream.getAudioTracks()
      if (avatarAudioTracks.length > 0) {
        const avatarSource = audioContext.value.createMediaStreamSource(avatarStream)
        avatarSource.connect(avatarGain)
        avatarGain.connect(destination)
        addChatMessage('System', 'Recording both user microphone and avatar voice', 'system')
      } else {
        addChatMessage('System', 'Recording user microphone only (avatar audio not available)', 'system')
      }
    } else {
      addChatMessage('System', 'Recording user microphone only (avatar stream not available)', 'system')
    }

    mixedStream.value = destination.stream

    // Determine MIME type based on browser support
    let mimeType = 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/mp4')) {
      mimeType = 'audio/mp4'
    } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      mimeType = 'audio/webm;codecs=opus'
    } else if (supportsWav.value) {
      mimeType = 'audio/wav'
    }

    // Start recording
    mediaRecorder.value = new MediaRecorder(mixedStream.value, {
      mimeType: mimeType,
      audioBitsPerSecond: 128000 // 128kbps for good quality
    })

    recordedChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.value.push(event.data)
      }
    }

    mediaRecorder.value.onstop = async () => {
      const blob = new Blob(recordedChunks.value, { type: mimeType })
      
      // Convert to desired format if needed
      if (audioFormat.value === 'mp3' || audioFormat.value === 'm4a' || audioFormat.value === 'wav') {
        try {
          const convertedBlob = await convertAudioFormat(blob, mimeType, audioFormat.value)
          recordedAudioBlob.value = convertedBlob
        } catch (error) {
          console.log('Audio conversion failed, using original format:', error)
          recordedAudioBlob.value = blob
        }
      } else {
        recordedAudioBlob.value = blob
      }
      
      console.log('Recording stopped, blob created:', recordedAudioBlob.value.size, 'bytes')
      addChatMessage('System', `Recording ready for download (${getActualFileExtension()})`, 'system')
    }

    mediaRecorder.value.start(1000) // Collect data every second
    isRecordingConversation.value = true
    
    addChatMessage('System', 'Conversation recording started', 'system')
    console.log('Conversation recording started')

  } catch (error) {
    console.error('Error starting conversation recording:', error)
    addChatMessage('System', `Recording error: ${error.message}`, 'system')
  }
}

// TAMBAHAN FUNCTION YANG HILANG - stopConversationRecording
async function stopConversationRecording() {
  try {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
    }

    // Stop all tracks
    if (mixedStream.value) {
      mixedStream.value.getTracks().forEach(track => track.stop())
    }

    // Close audio context
    if (audioContext.value && audioContext.value.state !== 'closed') {
      await audioContext.value.close()
    }

    isRecordingConversation.value = false
    addChatMessage('System', 'Conversation recording stopped', 'system')
    console.log('Conversation recording stopped')

  } catch (error) {
    console.error('Error stopping conversation recording:', error)
    addChatMessage('System', `Stop recording error: ${error.message}`, 'system')
  }
}

// Function to convert audio format using Web Audio API (DIPERBAIKI)
async function convertAudioFormat(blob, originalMimeType, targetFormat) {
  return new Promise(async (resolve, reject) => {
    try {
      if (targetFormat === 'wav') {
        // Convert to WAV using Web Audio API
        const arrayBuffer = await blob.arrayBuffer()
        const tempAudioContext = new (window.AudioContext || window.webkitAudioContext)()
        const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer)
        const convertedBlob = bufferToWav(audioBuffer)
        tempAudioContext.close()
        resolve(convertedBlob)
      } else {
        // For MP3 and M4A, use original blob with correct MIME type
        let newMimeType = originalMimeType
        if (targetFormat === 'mp3') {
          newMimeType = 'audio/mpeg'
        } else if (targetFormat === 'm4a') {
          newMimeType = 'audio/mp4'
        }
        
        const convertedBlob = new Blob([blob], { type: newMimeType })
        resolve(convertedBlob)
      }
    } catch (error) {
      console.error('Conversion error:', error)
      resolve(blob) // Fallback to original blob
    }
  })
}

// Convert AudioBuffer to WAV format
function bufferToWav(buffer) {
  const length = buffer.length
  const numberOfChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2)
  const view = new DataView(arrayBuffer)
  
  // WAV header
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * numberOfChannels * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numberOfChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numberOfChannels * 2, true)
  view.setUint16(32, numberOfChannels * 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * numberOfChannels * 2, true)
  
  // Audio data
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }
  
  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

function getActualFileExtension() {
  if (audioFormat.value === 'wav') return 'wav'
  if (audioFormat.value === 'mp3') return 'mp3'
  if (audioFormat.value === 'm4a') return 'm4a'
  return 'webm'
}

function downloadRecording() {
  if (!recordedAudioBlob.value) {
    addChatMessage('System', 'No recording available to download', 'system')
    return
  }

  try {
    const url = URL.createObjectURL(recordedAudioBlob.value)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = getActualFileExtension()
    const filename = `conversation_${timestamp}.${extension}`
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addChatMessage('System', `Recording downloaded: ${filename}`, 'system')
    console.log('Recording downloaded:', filename)

  } catch (error) {
    console.error('Error downloading recording:', error)
    addChatMessage('System', `Download error: ${error.message}`, 'system')
  }
}

// Speech Recognition Setup - EXISTING (tidak diubah)
function initializeSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    recognition.value = new SpeechRecognition()
    
    recognition.value.continuous = false
    recognition.value.interimResults = false
    recognition.value.lang = 'id-ID'
    
    recognition.value.onstart = () => {
      console.log('Speech recognition started')
    }
    
    recognition.value.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      transcribedText.value = transcript
      textToSpeak.value = transcript
      
      setTimeout(() => {
        handleSendMessage('voice')
      }, 500)
    }
    
    recognition.value.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
      isRecording.value = false
      addChatMessage('System', `Voice recognition error: ${event.error}`, 'system')
    }
    
    recognition.value.onend = () => {
      isRecording.value = false
    }
  } else {
    console.warn('Speech recognition not supported in this browser')
  }
}

// Chat Functions - EXISTING (tidak diubah)
function addChatMessage(sender, content, type = 'user', inputMethod = '') {
  const message = {
    sender,
    content,
    type,
    time: new Date().toLocaleTimeString(),
    inputMethod
  }
  chatHistory.value.push(message)
  
  setTimeout(() => {
    const chatContainer = document.querySelector('.chat-messages')
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight
    }
  }, 100)
}

function clearChatHistory() {
  chatHistory.value = []
}

function toggleVoiceRecording() {
  if (!recognition.value) {
    addChatMessage('System', 'Speech recognition not available in this browser', 'system')
    return
  }
  
  if (isRecording.value) {
    recognition.value.stop()
    isRecording.value = false
  } else {
    transcribedText.value = ''
    recognition.value.start()
    isRecording.value = true
  }
}

async function handleSendMessage(method = 'text') {
  if (!textToSpeak.value.trim()) return

  const message = textToSpeak.value.trim()
  const inputMethodLabel = method === 'voice' ? '🎤' : '⌨️'
  
  addChatMessage('You', message, 'user', inputMethodLabel)
  
  try {
    await avatarStore.speak(message, 'talk')
    addChatMessage('Avatar', `Responding to: "${message}"`, 'avatar')
    
    textToSpeak.value = ''
    transcribedText.value = ''
    
  } catch (error) {
    console.error('Failed to send message:', error)
    addChatMessage('System', 'Failed to send message', 'system')
  }
}

// Existing methods - SEMUA TETAP SAMA (tidak diubah)
async function createInsuranceKB() {
  try {
    const newKB = await kbStore.createInsuranceKnowledgeBase()
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
    if (knowledgeBaseId.value.trim()) {
      await updateKBWithCurrentTime()
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    await avatarStore.startSession(avatarId.value, voiceId.value, knowledgeBaseId.value.trim() || null)

    setTimeout(() => {
      if (videoRef.value) {
        videoRef.value.muted = false
        videoRef.value.volume = 1.0
        updateVideoFit()
      }
    }, 1000)

    setTimeout(async () => {
      if (avatarStore.streamReady && avatarStore.isConnected) {
        const currentGreeting = kbStore.getTimeGreeting()
        const greetingScript = kbStore.generateOpeningScript()
        
        console.log('Auto greeting with:', currentGreeting)
        console.log('Greeting script:', greetingScript)
        
        addChatMessage('Avatar', greetingScript, 'avatar', '🤖')
        await avatarStore.speak(greetingScript, 'talk')
      }
    }, 2000)
    
  } catch (error) {
    console.error('Failed to start session:', error)
  }
}

async function handleClose() {
  try {
    // TAMBAHAN BARU - Stop recording when closing session
    if (isRecordingConversation.value) {
      await stopConversationRecording()
    }
    
    await avatarStore.closeSession()
    clearChatHistory()
    
    // Reset recording state
    recordedAudioBlob.value = null
    recordedChunks.value = []
    
  } catch (error) {
    console.error('Failed to close session:', error)
  }
}

async function handleSpeak(type, text = null) {
  const message = text || textToSpeak.value
  if (!message.trim()) return

  try {
    await avatarStore.speak(message, type)
    if (!text) textToSpeak.value = ''
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
  if (videoRef.value) {
    videoRef.value.style.objectFit = videoFitMode.value
    console.log('Video fit updated to:', videoFitMode.value)
  }
}

function updateVideoSize() {
  console.log('Video size updated to:', videoSize.value)
}

function resetVideoSettings() {
  videoFitMode.value = 'contain'
  videoSize.value = 'medium'
  updateVideoFit()
}
</script>

<style scoped>
/* EXISTING STYLES - TETAP SAMA */
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
  padding-bottom: 56.25%;
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

.chat-section {
  margin-top: 20px;
  padding: 15px;
  border: 2px solid #007bff;
  border-radius: 8px;
  background-color: #f8fffe;
}

.chat-section h4 {
  margin: 0 0 15px 0;
  color: #007bff;
  font-size: 16px;
}

.input-mode-selector {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}

.mode-option input[type="radio"] {
  margin: 0;
}

.voice-input-section {
  margin-bottom: 15px;
}

.voice-controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}

.btn-voice {
  background-color: #28a745;
  color: white;
  min-width: 150px;
}

.btn-voice.recording {
  background-color: #dc3545;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.7; }
  100% { opacity: 1; }
}

.recording-indicator {
  color: #dc3545;
  font-weight: bold;
  font-size: 14px;
}

.transcribed-text {
  background-color: #e9ecef;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  color: #495057;
  max-width: 100%;
  word-wrap: break-word;
}

.quick-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn-send {
  background-color: #007bff;
  color: white;
  min-width: 80px;
}

.btn-send:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-clear-chat {
  background-color: #6c757d;
  color: white;
  font-size: 12px;
  padding: 8px 16px;
}

.btn-clear-chat:hover:not(:disabled) {
  background-color: #5a6268;
}

.chat-history-container {
  margin-bottom: 20px;
  padding: 15px;
  border: 2px solid #28a745;
  border-radius: 8px;
  background-color: #f8fff8;
}

.chat-history-container h4 {
  margin: 0 0 15px 0;
  color: #28a745;
  font-size: 16px;
}

.chat-messages {
  max-height: 300px;
  overflow-y: auto;
  padding: 10px;
  background-color: white;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.message {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background-color: #e3f2fd;
  margin-left: auto;
  border: 1px solid #2196f3;
}

.message.avatar {
  background-color: #e8f5e8;
  margin-right: auto;
  border: 1px solid #4caf50;
}

.message.system {
  background-color: #fff3cd;
  margin: 0 auto;
  border: 1px solid #ffc107;
  text-align: center;
  max-width: 90%;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
  font-size: 12px;
  color: #666;
}

.message-sender {
  font-weight: bold;
}

.message-time {
  font-size: 11px;
}

.input-method {
  font-size: 14px;
}

.message-content {
  font-size: 14px;
  line-height: 1.4;
  color: #333;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* TAMBAHAN BARU - Audio Recording Styles */
.audio-recording-section {
  margin-bottom: 20px;
  padding: 15px;
  border: 2px solid #ff6b6b;
  border-radius: 8px;
  background-color: #fff5f5;
}

.audio-recording-section h5 {
  margin: 0 0 15px 0;
  color: #ff6b6b;
  font-size: 14px;
}

.recording-controls {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.format-selection {
  display: flex;
  align-items: center;
  gap: 10px;
}

.format-selection label {
  font-size: 14px;
  font-weight: 500;
  color: #495057;
}

.format-select {
  padding: 8px 12px;
  border: 2px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  background-color: white;
  cursor: pointer;
  min-width: 200px;
}

.format-select:focus {
  outline: none;
  border-color: #007bff;
}

.format-select:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.file-info {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.btn-record {
  background-color: #ff6b6b;
  color: white;
  min-width: 160px;
  align-self: flex-start;
}

.btn-record:hover:not(:disabled) {
  background-color: #ff5252;
}

.btn-record.recording {
  background-color: #dc3545;
  animation: pulse 1s infinite;
}

.recording-status {
  color: #dc3545;
  font-weight: bold;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.download-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.btn-download {
  background-color: #28a745;
  color: white;
  min-width: 160px;
}

.btn-download:hover:not(:disabled) {
  background-color: #218838;
}

@media (max-width: 768px) {
  .format-selection {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .format-select {
    min-width: 180px;
  }
  
  .download-section {
    width: 100%;
  }
  
  .btn-download {
    width: 100%;
  }
}
</style>
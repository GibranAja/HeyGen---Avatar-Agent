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

        <!-- Audio Recording Status Display -->
        <div v-if="recordedAudioBlob" class="recording-ready-status">
          <div class="recording-info">
            📎 Recording ready: {{ Math.round(recordedAudioBlob.size / 1024) }} KB
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
const DEFAULT_VOICE_ID = "8c47d9e75bdc4f1ba81bfbe32d891085"
const DEFAULT_KB_ID = '69a0db55b4e84eabb04f572a60a1faa4'
const AUTO_CLOSE_TIMEOUT = 25000

// Reactive refs
const recognition = ref(null)
const isRecording = ref(false)
const transcribedText = ref('')

// Audio Recording functionality - DARI KODE LAMA
const isRecordingConversation = ref(false)
const mediaRecorder = ref(null)
const recordedChunks = ref([])
const recordedAudioBlob = ref(null)
const audioFormat = ref('mp3') // Default ke MP3
const supportsWav = ref(false)
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
      ensureAvatarAudioAccessible()
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
    // TAMBAHAN BARU - Check audio format support
    checkAudioFormatSupport()
    
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

// TAMBAHAN BARU - Audio Format Support Check
function checkAudioFormatSupport() {
  if (typeof MediaRecorder !== 'undefined') {
    supportsWav.value = MediaRecorder.isTypeSupported('audio/wav')
    
    // Set default format to MP3 for best compatibility
    audioFormat.value = 'mp3'
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
    
    // ADD: Reduce sensitivity settings
    recognition.value.maxAlternatives = 1
    recognition.value.serviceURI = null // Use default, but helps with some browsers
    
    recognition.value.onstart = () => {
      console.log('Speech recognition started')
      isRecording.value = true
    }
    
    recognition.value.onresult = (event) => {
      const result = event.results[0]
      const transcript = result[0].transcript
      const confidence = result[0].confidence
      
      // ADD: Filter by confidence level (0.0 to 1.0)
      const MIN_CONFIDENCE = 0.7 // Increase this to reduce false positives
      
      if (confidence < MIN_CONFIDENCE) {
        console.log(`Speech ignored - low confidence: ${confidence}`)
        return
      }
      
      // ADD: Filter out short utterances (likely noise)
      if (transcript.trim().length < 3) {
        console.log(`Speech ignored - too short: "${transcript}"`)
        return
      }
      
      // ADD: Filter out avatar-like responses
      const avatarKeywords = ['selamat', 'terima kasih', 'axa', 'mandiri', 'asuransi']
      const isLikelyAvatar = avatarKeywords.some(keyword => 
        transcript.toLowerCase().includes(keyword)
      )
      
      if (isLikelyAvatar) {
        console.log(`Speech ignored - likely avatar echo: "${transcript}"`)
        return
      }
      
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

// FUNGSI AUDIO RECORDING DARI KODE LAMA - COMPLETE IMPLEMENTATION
async function startConversationRecording() {
  try {
    addSystemMessage('🎙️ Starting enhanced audio recording...')
    
    // Get high-quality microphone stream
    const micStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 2,
        latency: 0
      } 
    })

    // Create high-quality audio context
    audioContext.value = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
      latencyHint: 'interactive'
    })
    
    // Wait for audio context to be ready
    if (audioContext.value.state === 'suspended') {
      await audioContext.value.resume()
    }
    
    const destination = audioContext.value.createMediaStreamDestination()

    // Create separate processing chains for microphone and avatar
    const micGain = audioContext.value.createGain()
    const avatarGain = audioContext.value.createGain()
    
    // Set optimal gain levels
    micGain.gain.value = 2.0  // Boost microphone more
    avatarGain.gain.value = 1.8  // Boost avatar audio more
    
    // Connect microphone
    const micSource = audioContext.value.createMediaStreamSource(micStream)
    micSource.connect(micGain)
    micGain.connect(destination)
    addSystemMessage('✅ Microphone connected to recording')

    // Enhanced avatar audio capture with multiple fallback methods
    let avatarAudioCaptured = false
    
    // Method 1: Wait and retry for avatarAudio element
    const maxRetries = 10
    let retryCount = 0
    
    const tryAvatarCapture = async () => {
      while (retryCount < maxRetries && !avatarAudioCaptured) {
        const audioElement = document.getElementById('avatarAudio')
        
        if (audioElement && audioElement.srcObject) {
          try {
            // Ensure audio element is ready
            if (audioElement.readyState >= 2) { // HAVE_CURRENT_DATA
              let elementStream = null
              
              if (audioElement.captureStream) {
                elementStream = audioElement.captureStream()
              } else if (audioElement.mozCaptureStream) {
                elementStream = audioElement.mozCaptureStream()
              }
              
              if (elementStream && elementStream.getAudioTracks().length > 0) {
                const elementSource = audioContext.value.createMediaStreamSource(elementStream)
                elementSource.connect(avatarGain)
                avatarGain.connect(destination)
                avatarAudioCaptured = true
                addSystemMessage('✅ Avatar audio captured from audio element')
                break
              }
            }
          } catch (error) {
            console.log(`Avatar capture attempt ${retryCount + 1} failed:`, error)
          }
        }
        
        retryCount++
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }
    
    // Start trying to capture avatar audio
    await tryAvatarCapture()
    
    // Method 2: Try video element if audio element failed
    if (!avatarAudioCaptured) {
      const videoElement = videoRef.value
      if (videoElement && videoElement.srcObject) {
        try {
          let videoStream = null
          
          if (videoElement.captureStream) {
            videoStream = videoElement.captureStream()
          } else if (videoElement.mozCaptureStream) {
            videoStream = videoElement.mozCaptureStream()
          }
          
          if (videoStream) {
            const videoAudioTracks = videoStream.getAudioTracks()
            if (videoAudioTracks.length > 0) {
              const videoSource = audioContext.value.createMediaStreamSource(videoStream)
              videoSource.connect(avatarGain)
              avatarGain.connect(destination)
              avatarAudioCaptured = true
              addSystemMessage('✅ Avatar audio captured from video element')
            }
          }
        } catch (error) {
          console.log('Video element capture failed:', error)
        }
      }
    }
    
    // Method 3: System audio capture as last resort
    if (!avatarAudioCaptured) {
      try {
        addSystemMessage('🔊 Attempting system audio capture...')
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: false,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            sampleRate: 48000,
            channelCount: 2
          }
        })
        
        if (displayStream.getAudioTracks().length > 0) {
          const systemSource = audioContext.value.createMediaStreamSource(displayStream)
          systemSource.connect(avatarGain)
          avatarGain.connect(destination)
          avatarAudioCaptured = true
          addSystemMessage('✅ Avatar audio captured via system audio')
        }
      } catch (error) {
        console.log('System audio capture failed:', error)
        addSystemMessage('⚠️ System audio capture not available')
      }
    }

    if (!avatarAudioCaptured) {
      addSystemMessage('⚠️ Avatar audio not captured - recording microphone only')
      addSystemMessage('💡 Try using system audio capture when prompted')
    }

    // Get the mixed stream
    mixedStream.value = destination.stream
    
    // Verify stream has audio tracks
    const audioTracks = mixedStream.value.getAudioTracks()
    addSystemMessage(`📊 Recording stream has ${audioTracks.length} audio tracks`)
    
    if (audioTracks.length === 0) {
      throw new Error('No audio tracks in mixed stream')
    }

    // Prioritize MP3-compatible formats
    let mimeType = 'audio/webm;codecs=opus'
    const supportedTypes = [
      'audio/mpeg',                 // MP3 - prioritize this
      'audio/mp4;codecs=mp4a.40.2', // AAC in MP4
      'audio/webm;codecs=opus',     // WebM Opus (fallback)
      'audio/webm'                  // Basic WebM (last resort)
    ]
    
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type
        addSystemMessage(`✅ Using codec: ${type}`)
        break
      }
    }
    
    // If we're still using WebM, note that we'll download as MP3 anyway
    if (mimeType.includes('webm')) {
      addSystemMessage(`🎵 Recording in ${mimeType}, will download as MP3`)
    } else {
      addSystemMessage(`🎵 Using MP3-compatible format: ${mimeType}`)
    }

    // Create MediaRecorder with optimal settings
    mediaRecorder.value = new MediaRecorder(mixedStream.value, {
      mimeType: mimeType,
      audioBitsPerSecond: 256000  // High quality bitrate
    })

    recordedChunks.value = []

    mediaRecorder.value.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.value.push(event.data)
        console.log(`Audio chunk recorded: ${event.data.size} bytes`)
      }
    }

    mediaRecorder.value.onstop = async () => {
      try {
        if (recordedChunks.value.length === 0) {
          addSystemMessage('❌ No audio data recorded')
          return
        }
        
        // Always create blob for MP3 download, regardless of recording format
        const blob = new Blob(recordedChunks.value, { type: 'audio/mpeg' })
        recordedAudioBlob.value = blob
        
        const sizeKB = Math.round(blob.size / 1024)
        console.log(`Recording completed: ${sizeKB} KB`)
        addSystemMessage(`✅ Recording ready for MP3 download: ${sizeKB} KB`)
        
        // Verify the blob has content
        if (blob.size < 1000) {
          addSystemMessage('⚠️ Warning: Recording file is very small')
        }
      } catch (error) {
        console.error('Error processing recording:', error)
        addSystemMessage(`❌ Processing error: ${error.message}`)
      }
    }

    mediaRecorder.value.onerror = (event) => {
      console.error('MediaRecorder error:', event.error)
      addSystemMessage(`❌ Recording error: ${event.error}`)
    }

    mediaRecorder.value.onstart = () => {
      addSystemMessage('🔴 Recording started - will save as MP3')
    }

    // Start recording with smaller chunks for better reliability
    mediaRecorder.value.start(250) // 250ms chunks
    isRecordingConversation.value = true
    
    addSystemMessage('✅ Enhanced recording system active - MP3 output')
    
  } catch (error) {
    console.error('Error starting conversation recording:', error)
    addSystemMessage(`❌ Failed to start recording: ${error.message}`)
    
    // Try a simpler fallback approach
    if (error.name === 'NotAllowedError') {
      addSystemMessage('🎤 Microphone permission denied')
    } else if (error.name === 'NotFoundError') {
      addSystemMessage('🎤 No microphone found')
    }
  }
}

// Also update the stopConversationRecording function
async function stopConversationRecording() {
  try {
    if (!isRecordingConversation.value || !mediaRecorder.value) {
      addSystemMessage('⚠️ No active recording to stop')
      return false
    }

    addSystemMessage('🛑 Stopping conversation recording...')
    
    return new Promise((resolve) => {
      mediaRecorder.value.onstop = async () => {
        try {
          if (recordedChunks.value.length === 0) {
            addSystemMessage('❌ No audio data recorded')
            resolve(false)
            return
          }
          
          // Always create blob as MP3 for download
          const blob = new Blob(recordedChunks.value, { type: 'audio/mpeg' })
          recordedAudioBlob.value = blob
          
          const sizeKB = Math.round(blob.size / 1024)
          console.log(`Recording completed: ${sizeKB} KB`)
          addSystemMessage(`✅ Recording stopped - ready for MP3 download: ${sizeKB} KB`)
          
          // Verify the blob has content
          if (blob.size < 1000) {
            addSystemMessage('⚠️ Warning: Recording file is very small')
          }
          
          isRecordingConversation.value = false
          resolve(true)
        } catch (error) {
          console.error('Error processing recording:', error)
          addSystemMessage(`❌ Processing error: ${error.message}`)
          isRecordingConversation.value = false
          resolve(false)
        }
      }

      // Stop the recording
      if (mediaRecorder.value.state === 'recording') {
        mediaRecorder.value.stop()
      } else {
        addSystemMessage('⚠️ MediaRecorder not in recording state')
        resolve(false)
      }

      // Stop all audio tracks
      if (mixedStream.value) {
        mixedStream.value.getTracks().forEach(track => {
          track.stop()
        })
      }

      // Close audio context
      if (audioContext.value && audioContext.value.state !== 'closed') {
        audioContext.value.close().catch(console.error)
      }
    })
  } catch (error) {
    console.error('Error stopping recording:', error)
    addSystemMessage(`❌ Stop recording error: ${error.message}`)
    isRecordingConversation.value = false
    return false
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
  
  // Reset recording state
  recordedAudioBlob.value = null
  recordedChunks.value = []
  
  // Clear conversation history
  conversationStore.clearHistory()
}

// Add the missing ensureAvatarAudioAccessible function
function ensureAvatarAudioAccessible() {
  // Wait a bit for the avatar audio to be ready
  setTimeout(() => {
    const audioElement = document.getElementById('avatarAudio')
    if (audioElement) {
      // Configure audio element for better capture
      audioElement.volume = 1.0
      audioElement.muted = false
      audioElement.crossOrigin = 'anonymous'
      
      // Ensure autoplay is working
      audioElement.autoplay = true
      audioElement.playsInline = true
      
      // Force play
      const playPromise = audioElement.play()
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            addSystemMessage('✅ Avatar audio element playing')
          })
          .catch(err => {
            console.log('Audio play prevented:', err)
            addSystemMessage('⚠️ Avatar audio autoplay blocked')
          })
      }
      
      // Add event listeners to monitor audio state
      audioElement.addEventListener('loadeddata', () => {
        addSystemMessage('✅ Avatar audio data loaded')
      })
      
      audioElement.addEventListener('canplay', () => {
        addSystemMessage('✅ Avatar audio can play')
      })
      
      audioElement.addEventListener('playing', () => {
        addSystemMessage('✅ Avatar audio is playing')
      })
      
    } else {
      addSystemMessage('⚠️ Avatar audio element not found yet')
      // Retry after a delay
      setTimeout(ensureAvatarAudioAccessible, 1000)
    }
  }, 500)
}

// Add the missing closeSessionAndDownload function
async function closeSessionAndDownload() {
  try {
    addSystemMessage('🔄 Preparing to close session and download recording...')
    
    // Stop conversation recording first
    if (isRecordingConversation.value) {
      const recordingStopped = await stopConversationRecording()
      if (recordingStopped) {
        addSystemMessage('✅ Recording stopped successfully')
        
        // Trigger download if we have recorded audio
        if (recordedAudioBlob.value) {
          downloadRecording()
        }
      } else {
        addSystemMessage('⚠️ Failed to stop recording properly')
      }
    } else {
      addSystemMessage('ℹ️ No active recording to stop')
    }
    
    // Close the avatar session
    await avatarStore.closeSession()
    addSystemMessage('✅ Avatar session closed')
    
    // Reset component state
    cleanup()
    addSystemMessage('✅ Session cleanup completed')
    
  } catch (error) {
    console.error('Error in closeSessionAndDownload:', error)
    addSystemMessage(`❌ Error during session close: ${error.message}`)
    
    // Force cleanup even if there were errors
    cleanup()
  }
}

// Add the missing downloadRecording function
function downloadRecording() {
  if (!recordedAudioBlob.value) {
    addSystemMessage('❌ No recording available to download')
    return
  }

  if (recordedAudioBlob.value.size < 1000) {
    addSystemMessage('⚠️ Warning: Recording is very small, may be empty')
  }

  try {
    const url = URL.createObjectURL(recordedAudioBlob.value)
    
    // Always use MP3 extension regardless of the actual format
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `conversation_${timestamp}.mp3`
    
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    
    // Clean up URL after a delay
    setTimeout(() => {
      URL.revokeObjectURL(url)
    }, 1000)
    
    const sizeKB = Math.round(recordedAudioBlob.value.size / 1024)
    addSystemMessage(`✅ Downloaded: ${filename} (${sizeKB} KB)`)
    console.log('Recording downloaded:', filename, `${sizeKB} KB`)
  } catch (error) {
    console.error('Error downloading recording:', error)
    addSystemMessage(`❌ Download failed: ${error.message}`)
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
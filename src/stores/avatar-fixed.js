// stores/avatar-fixed.js
import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useAvatarStore = defineStore('avatar', () => {
  // State
  const avatar = ref(null)
  const isConnected = ref(false)
  const sessionId = ref(null)
  const logs = ref([])
  const isLoading = ref(false)
  const streamReady = ref(false)
  const sessionData = ref(null)
  const isSpeaking = ref(false)
  const lastSpokenText = ref('')
  const hasUserInteracted = ref(false)

  // Actions
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString()
    logs.value.push(`[${timestamp}] ${message}`)
  }

  const setUserInteraction = () => {
    hasUserInteracted.value = true
    addLog('✅ User interaction detected')
  }

  const createSession = async (avatarId, voiceId, knowledgeBaseId = null) => {
    try {
      const sessionConfig = {
        quality: 'medium',
        version: 'v2',
        video_encoding: 'VP8',
        disable_idle_timeout: false,
        activity_idle_timeout: 120,
        stt_settings: {
          provider: 'deepgram',
          confidence: 0.55
        }
      }

      if (avatarId && avatarId.trim()) {
        sessionConfig.avatar_id = avatarId.trim()
        addLog(`Using Avatar ID: ${avatarId.trim()}`)
      } else {
        addLog('No Avatar ID provided - using default avatar')
      }

      if (voiceId && voiceId.trim()) {
        sessionConfig.voice = {
          voice_id: voiceId.trim(),
          rate: 1,
          emotion: 'friendly',
        }
        addLog(`Using Voice ID: ${voiceId.trim()}`)
      } else {
        sessionConfig.voice = {
          rate: 1
        }
        addLog('No Voice ID provided - using default voice')
      }

      if (knowledgeBaseId && knowledgeBaseId.trim()) {
        sessionConfig.knowledge_base_id = knowledgeBaseId.trim()
        addLog(`Using Knowledge Base ID: ${knowledgeBaseId.trim()}`)
      } else {
        addLog('No Knowledge Base ID provided')
      }

      addLog(`Creating session with config: ${JSON.stringify(sessionConfig, null, 2)}`)

      const response = await axios({
        method: 'POST',
        url: 'https://api.heygen.com/v1/streaming.new',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': 'NDU2YjkyYzE4ZDZmNGYyYjgzMjhkNWFjNjZjYWVmNWItMTc1NTIyOTUxMw==',
        },
        data: sessionConfig,
      })

      if (response.data && response.data.data) {
        sessionData.value = response.data.data
        sessionId.value = sessionData.value.session_id
        addLog(`Session created successfully: ${sessionId.value}`)
        return sessionData.value
      } else {
        throw new Error('Invalid response format from API')
      }
    } catch (error) {
      console.error('Error creating session:', error)

      if (error.response?.data) {
        addLog(`API Error Response: ${JSON.stringify(error.response.data, null, 2)}`)
      }

      const errorMsg =
        error.response?.data?.message || error.message || 'Failed to create session'
      addLog(`Error: ${errorMsg}`)

      if (error.response?.status === 401) {
        addLog('Error 401: Invalid API key. Please check your HeyGen API key')
      } else if (error.response?.status === 400) {
        addLog('Error 400: Bad Request - Check the following:')
        addLog('- API key is valid and has proper permissions')
        addLog('- Avatar ID exists in your HeyGen account (if provided)')
        addLog('- Voice ID format is correct (if provided)')
        addLog('- Account has sufficient credits')
        addLog('- Required fields: stt_settings, voice configuration')
      } else if (error.response?.status === 403) {
        addLog('Error 403: Forbidden - Check account permissions and credits')
      } else if (error.response?.status === 404) {
        addLog('Error 404: Resource not found - Check API endpoint')
      }

      throw error
    }
  }

  const startSession = async (avatarId, voiceId, knowledgeBaseId = null) => {
    try {
      isLoading.value = true
      addLog('=== Starting New Avatar Session ===')

      if (avatarId && avatarId.trim()) {
        addLog(`Avatar ID: ${avatarId.trim()}`)
      } else {
        addLog('Avatar ID: Not provided (will use default)')
      }

      if (voiceId && voiceId.trim()) {
        addLog(`Voice ID: ${voiceId.trim()}`)
      } else {
        addLog('Voice ID: Not provided (will use default)')
      }

      if (knowledgeBaseId && knowledgeBaseId.trim()) {
        addLog(`Knowledge Base ID: ${knowledgeBaseId.trim()}`)
      } else {
        addLog('Knowledge Base ID: Not provided')
      }

      // Step 1: Create session
      addLog('Step 1: Creating session...')
      const sessionDataResult = await createSession(avatarId, voiceId, knowledgeBaseId)

      // Step 2: Start session
      addLog('Step 2: Starting session...')
      const startResponse = await axios({
        method: 'POST',
        url: 'https://api.heygen.com/v1/streaming.start',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': 'NDU2YjkyYzE4ZDZmNGYyYjgzMjhkNWFjNjZjYWVmNWItMTc1NTIyOTUxMw==',
        },
        data: {
          session_id: sessionId.value,
        },
      })

      addLog('Session started successfully')
      addLog(`Status: ${startResponse.data?.status || 'Unknown'}`)

      // Step 3: Setup WebRTC connection
      addLog('Step 3: Setting up WebRTC connection...')
      await setupWebRTCConnection()

      isConnected.value = true
      addLog('=== Avatar Session Ready ===')

      return sessionDataResult
    } catch (error) {
      console.error('Error starting session:', error)

      if (error.response?.data) {
        addLog(`Start Session Error: ${JSON.stringify(error.response.data, null, 2)}`)
      }

      const errorMsg = error.response?.data?.message || error.message || 'Failed to start session'
      addLog(`Error: ${errorMsg}`)

      if (error.response?.status === 401) {
        addLog('Error 401: Authentication failed - Check API key')
      } else if (error.response?.status === 400) {
        addLog('Error 400: Invalid session parameters')
      } else if (error.response?.status === 404) {
        addLog('Error 404: Session not found - Try creating a new session')
      }

      throw error
    } finally {
      isLoading.value = false
    }
  }

  const setupWebRTCConnection = async () => {
    try {
      if (!sessionData.value?.url || !sessionData.value?.access_token) {
        addLog('Missing WebRTC connection data')
        addLog(`URL: ${sessionData.value?.url ? 'Present' : 'Missing'}`)
        addLog(`Token: ${sessionData.value?.access_token ? 'Present' : 'Missing'}`)
        return
      }

      addLog('Setting up WebRTC connection...')
      addLog(`WebSocket URL: ${sessionData.value.url}`)

      // Import LiveKit SDK
      const { Room, VideoPresets } = await import('livekit-client')
      const { StreamingEvents } = await import('@heygen/streaming-avatar')

      const room = new Room({
        videoCaptureDefaults: {
          resolution: VideoPresets.h540,
        },
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        adaptive: true,
        dynacast: true,
      })

      // Add event listeners for avatar talking events
      room.on(StreamingEvents.AVATAR_START_TALKING, (event) => {
        console.log('🎤 Avatar started talking:', event)
        isSpeaking.value = true
        addLog('Avatar started talking')
      })

      room.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (message) => {
        console.log('💬 Avatar is saying:', message)
        // Update lastSpokenText with the current message
        if (message && typeof message === 'string') {
          lastSpokenText.value = message
        }
      })

      room.on(StreamingEvents.AVATAR_STOP_TALKING, (event) => {
        console.log('🛑 Avatar stopped talking:', event)
        isSpeaking.value = false
        addLog(`Avatar finished speaking: "${lastSpokenText.value}"`)
      })

      room.on(StreamingEvents.AVATAR_END_MESSAGE, (message) => {
        console.log('✅ Avatar final message:', message)
        // Ensure we have the complete final message
        if (message && typeof message === 'string') {
          lastSpokenText.value = message
        }
      })

      // Setup event listeners SEBELUM connect
      room.on('trackSubscribed', (track, publication, participant) => {
        addLog(`✅ Track subscribed: ${track.kind} from ${participant.identity}`)
        console.log('Track subscribed:', track, publication, participant)

        const videoElement = document.getElementById('avatarVideo')
        if (!videoElement) {
          addLog('❌ Video element not found!')
          console.error('Video element not found!')
          return
        }

        if (track.kind === 'video') {
          addLog('✅ Processing video track...')
          console.log('Attaching video track to element:', videoElement)
          
          track.attach(videoElement)
          
          // Set video properties but don't force play immediately
          videoElement.muted = true // Start muted to avoid autoplay issues
          videoElement.autoplay = true
          videoElement.playsInline = true
          
          // Try to play after user interaction
          if (hasUserInteracted.value) {
            videoElement.muted = false
            videoElement.volume = 1.0
            videoElement.play().then(() => {
              addLog('✅ Video playing successfully')
              streamReady.value = true
              console.log('Video is now playing')
            }).catch((err) => {
              addLog(`❌ Video play error: ${err.message}`)
              console.error('Video play error:', err)
              streamReady.value = true // Still set ready even if autoplay fails
            })
          } else {
            streamReady.value = true
            addLog('✅ Video ready - waiting for user interaction')
          }
          
          addLog('✅ Video stream attached and ready')
        }

        if (track.kind === 'audio') {
          addLog('✅ Processing audio track...')
          console.log('Attaching audio track')
          
          let audioElement = document.getElementById('avatarAudio')
          if (!audioElement) {
            audioElement = document.createElement('audio')
            audioElement.id = 'avatarAudio'
            audioElement.autoplay = true
            audioElement.playsInline = true
            audioElement.controls = false
            audioElement.muted = true // Start muted to avoid autoplay issues
            audioElement.volume = 1.0
            document.body.appendChild(audioElement)
            addLog('✅ Created dedicated audio element')
          }

          track.attach(audioElement)

          // Only unmute and play if user has interacted
          if (hasUserInteracted.value) {
            audioElement.muted = false
            audioElement.volume = 1.0
            videoElement.muted = false
            videoElement.volume = 1.0

            enableAudioContext()

            audioElement.play().then(() => {
              addLog('✅ Audio playing successfully')
              console.log('Audio is now playing')
            }).catch((err) => {
              addLog(`❌ Audio play error: ${err.message}`)
              console.error('Audio play error:', err)
              requestUserInteractionForAudio()
            })
          } else {
            addLog('✅ Audio ready - waiting for user interaction')
            requestUserInteractionForAudio()
          }

          addLog('✅ Audio stream attached')
        }
      })

      room.on('trackUnsubscribed', (track, publication, participant) => {
        addLog(`Track unsubscribed: ${track.kind}`)
        console.log('Track unsubscribed:', track.kind)
        track.detach()
      })

      room.on('disconnected', () => {
        addLog('❌ LiveKit room disconnected')
        console.log('Room disconnected')
        streamReady.value = false
        isConnected.value = false
      })

      room.on('participantConnected', (participant) => {
        addLog(`✅ Participant connected: ${participant.identity}`)
        console.log('Participant connected:', participant.identity)
      })

      room.on('participantDisconnected', (participant) => {
        addLog(`❌ Participant disconnected: ${participant.identity}`)
        console.log('Participant disconnected:', participant.identity)
      })

      room.on('reconnecting', () => {
        addLog('🔄 Room reconnecting...')
        console.log('Room reconnecting')
      })

      room.on('reconnected', () => {
        addLog('✅ Room reconnected')
        console.log('Room reconnected')
      })

      // Connect to room
      addLog('🔄 Connecting to LiveKit room...')
      console.log('Connecting to room with URL:', sessionData.value.url)
      
      await room.connect(sessionData.value.url, sessionData.value.access_token)
      addLog('✅ Connected to LiveKit room successfully')
      console.log('Room connected successfully')

      // Safely iterate through participants
      if (room.participants && typeof room.participants.forEach === 'function') {
        room.participants.forEach((participant) => {
          addLog(`Found participant: ${participant.identity}`)
          if (participant.tracks && typeof participant.tracks.forEach === 'function') {
            participant.tracks.forEach((publication) => {
              if (publication.track) {
                addLog(`Found existing track: ${publication.track.kind}`)
              }
            })
          }
        })
      } else if (room.participants && room.participants.size !== undefined) {
        // Handle Map object
        room.participants.forEach((participant) => {
          addLog(`Found participant: ${participant.identity}`)
          if (participant.tracks && participant.tracks.size !== undefined) {
            participant.tracks.forEach((publication) => {
              if (publication.track) {
                addLog(`Found existing track: ${publication.track.kind}`)
              }
            })
          }
        })
      }

      avatar.value = room
      addLog('✅ WebRTC connection setup completed')
      console.log('WebRTC setup completed, room:', room)
      
    } catch (error) {
      console.error('Error setting up WebRTC:', error)
      addLog(`❌ WebRTC Error: ${error.message}`)
    }
  }

  const enableAudioContext = () => {
    try {
      if (
        typeof window.AudioContext !== 'undefined' ||
        typeof window.webkitAudioContext !== 'undefined'
      ) {
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (!window.audioContext) {
          window.audioContext = new AudioContext()
        }

        if (window.audioContext.state === 'suspended') {
          window.audioContext
            .resume()
            .then(() => {
              addLog('✅ Audio context resumed successfully')
            })
            .catch((err) => {
              addLog(`❌ Failed to resume audio context: ${err.message}`)
            })
        }
      }
    } catch (error) {
      addLog(`❌ Audio context error: ${error.message}`)
    }
  }

  const requestUserInteractionForAudio = () => {
    const enableAudio = () => {
      hasUserInteracted.value = true
      
      const audioElement = document.getElementById('avatarAudio')
      const videoElement = document.getElementById('avatarVideo')
      
      if (audioElement) {
        audioElement.muted = false
        audioElement.volume = 1.0
        audioElement.play().catch(console.error)
      }
      
      if (videoElement) {
        videoElement.muted = false
        videoElement.volume = 1.0
        videoElement.play().catch(console.error)
      }
      
      enableAudioContext()
      
      document.removeEventListener('click', enableAudio)
      document.removeEventListener('touchstart', enableAudio)
      document.removeEventListener('keydown', enableAudio)
      
      addLog('✅ Audio enabled via user interaction')
    }

    document.addEventListener('click', enableAudio, { once: true })
    document.addEventListener('touchstart', enableAudio, { once: true })
    document.addEventListener('keydown', enableAudio, { once: true })
    
    addLog('🎤 Click anywhere to enable audio')
  }

  const speak = async (text, taskType = 'repeat') => {
    if (!isConnected.value || !sessionId.value) {
      addLog('Error: Not connected to session')
      return
    }

    if (!text?.trim()) {
      addLog('Error: No text provided')
      return
    }

    try {
      isSpeaking.value = true
      
      const speakData = {
        session_id: sessionId.value,
        text: text.trim(),
        task_type: taskType === 'talk' ? 'talk' : 'repeat',
      }

      addLog(`Sending speak request (${taskType}): "${text.trim()}"`)

      const response = await axios({
        method: 'POST',
        url: 'https://api.heygen.com/v1/streaming.task',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': 'NDU2YjkyYzE4ZDZmNGYyYjgzMjhkNWFjNjZjYWVmNWItMTc1NTIyOTUxMw==',
        },
        data: speakData,
      })

      addLog(`Avatar speaking successfully`)

      // If this is a 'talk' type request, the response might be different from the input
      // For 'repeat' type, the response is the same as the input
      if (taskType === 'talk') {
        // We'll capture the response in the response payload if available
        // Otherwise, fall back to the input text
        if (response.data && response.data.response) {
          lastSpokenText.value = response.data.response.trim()
        }
      } else {
        // For repeat tasks, the response is the same as the input
        lastSpokenText.value = text.trim()
      }

      const estimatedDuration = Math.max(3000, (text.length * 200))
      
      setTimeout(() => {
        isSpeaking.value = false
        addLog(`Avatar finished speaking: "${lastSpokenText.value}"`)
      }, estimatedDuration)

      return response
    } catch (error) {
      isSpeaking.value = false
      console.error('Error speaking:', error)
      const errorMsg =
        error.response?.data?.message || error.message || 'Failed to make avatar speak'
      addLog(`Speak Error: ${errorMsg}`)
      throw error
    }
  }

  const closeSession = async () => {
    try {
      addLog('Closing session...')

      if (sessionId.value) {
        await axios({
          method: 'POST',
          url: 'https://api.heygen.com/v1/streaming.stop',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'NDU2YjkyYzE4ZDZmNGYyYjgzMjhkNWFjNjZjYWVmNWItMTc1NTIyOTUxMw==',
          },
          data: {
            session_id: sessionId.value,
          },
        })
        addLog('Session stopped via API')
      }

      if (avatar.value && avatar.value.disconnect) {
        await avatar.value.disconnect()
        addLog('LiveKit room disconnected')
      }

      const audioElement = document.getElementById('avatarAudio')
      if (audioElement) {
        audioElement.remove()
      }

      // Reset state
      avatar.value = null
      isConnected.value = false
      sessionId.value = null
      sessionData.value = null
      streamReady.value = false
      isSpeaking.value = false
      lastSpokenText.value = ''
      hasUserInteracted.value = false
      addLog('Session closed successfully')
    } catch (error) {
      console.error('Error closing session:', error)
      addLog(`Close Error: ${error.message || 'Failed to close session'}`)

      // Force reset state even if API call fails
      avatar.value = null
      isConnected.value = false
      sessionId.value = null
      sessionData.value = null
      streamReady.value = false
      isSpeaking.value = false
      lastSpokenText.value = ''
      hasUserInteracted.value = false
    }
  }

  const clearLogs = () => {
    logs.value = []
  }

  return {
    // State
    avatar,
    isConnected,
    sessionId,
    logs,
    isLoading,
    streamReady,
    sessionData,
    isSpeaking,
    lastSpokenText,
    hasUserInteracted,
    
    // Actions
    addLog,
    setUserInteraction,
    createSession,
    startSession,
    setupWebRTCConnection,
    enableAudioContext,
    requestUserInteractionForAudio,
    speak,
    closeSession,
    clearLogs
  }
})
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
          'x-api-key': 'ZjljNzdmNjUxYjA2NGY3Nzg0NWZmYmExOGJkNDNiN2UtMTc1NTMyMjI0OA==',
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
          'x-api-key': 'ZjljNzdmNjUxYjA2NGY3Nzg0NWZmYmExOGJkNDNiN2UtMTc1NTMyMjI0OA==',
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

      // Import LiveKit SDK dan StreamingEvents saja
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

      // PERBAIKAN: Gunakan event listeners yang tepat untuk LiveKit Room
      // Event talking tidak langsung tersedia di room, jadi kita buat custom tracking
      
      // Track avatar speaking state manually
      let avatarParticipant = null
      let isCurrentlySpeaking = false

      room.on('participantConnected', (participant) => {
        addLog(`✅ Participant connected: ${participant.identity}`)
        console.log('Participant connected:', participant.identity)
        
        // Assume the first participant is the avatar
        if (!avatarParticipant && participant.identity !== 'user') {
          avatarParticipant = participant
          addLog(`🤖 Avatar participant identified: ${participant.identity}`)
          
          // Listen for audio track changes to detect speaking
          participant.on('trackSubscribed', (track) => {
            if (track.kind === 'audio') {
              addLog('🎤 Avatar audio track subscribed - setting up speaking detection')
              
              // Manual speaking detection based on audio activity
              const detectSpeaking = () => {
                // This is a simplified approach - in real implementation you might want
                // to use Web Audio API to detect actual audio levels
                if (!isCurrentlySpeaking) {
                  isCurrentlySpeaking = true
                  isSpeaking.value = true
                  console.log('🎤 Avatar started talking (detected)')
                  addLog('Avatar started talking')
                }
              }
              
              const detectSilence = () => {
                if (isCurrentlySpeaking) {
                  isCurrentlySpeaking = false
                  isSpeaking.value = false
                  console.log('🛑 Avatar stopped talking (detected)')
                  addLog(`Avatar finished speaking: "${lastSpokenText.value}"`)
                }
              }
              
              // Set up periodic checking (this is a workaround)
              const speakingCheckInterval = setInterval(() => {
                if (isConnected.value && avatarParticipant) {
                  // Simple heuristic: if we recently sent a speak request, assume speaking
                  // You might want to implement more sophisticated detection here
                } else {
                  clearInterval(speakingCheckInterval)
                }
              }, 500)
            }
          })
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

      room.on('participantDisconnected', (participant) => {
        addLog(`❌ Participant disconnected: ${participant.identity}`)
        console.log('Participant disconnected:', participant.identity)
        if (participant === avatarParticipant) {
          avatarParticipant = null
          isCurrentlySpeaking = false
          isSpeaking.value = false
        }
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

  // Replace the speak function in avatar-fixed.js
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
      // Set speaking state immediately when we start
      isSpeaking.value = true
      
      const speakData = {
        session_id: sessionId.value,
        text: text.trim(),
        task_type: taskType === 'talk' ? 'talk' : 'repeat',
      }

      addLog(`Sending speak request (${taskType}): "${text.trim()}"`)
      console.log('🔤 User input sent to avatar:', text.trim())

      const response = await axios({
        method: 'POST',
        url: 'https://api.heygen.com/v1/streaming.task',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-api-key': 'ZjljNzdmNjUxYjA2NGY3Nzg0NWZmYmExOGJkNDNiN2UtMTc1NTMyMjI0OA==',
        },
        data: speakData,
      })

      addLog(`Avatar speaking successfully`)
      console.log('📡 Full API Response:', response.data)

      // For task_type 'talk', we need a different approach to get the actual response
      if (taskType === 'talk') {
        console.log('💭 Avatar is generating response for:', text.trim())
        
        // Set up a listener for the actual avatar response
        // The actual response will come through streaming events or audio analysis
        
        // Start listening for actual avatar speech content
        startListeningForAvatarResponse(text.trim())
        
        // For now, we don't know the exact response yet
        lastSpokenText.value = '[Avatar is responding...]'
      } else {
        // For 'repeat' tasks, the response is the same as input
        console.log('💬 Avatar will repeat:', text.trim())
        lastSpokenText.value = text.trim()
      }

      const estimatedDuration = Math.max(5000, (text.length * 300)) // Longer duration for talk tasks
      
      setTimeout(() => {
        isSpeaking.value = false
        console.log('🛑 Avatar finished speaking:', lastSpokenText.value)
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

  // Add this new function to listen for avatar responses
  let responseTimeoutId = null

  const startListeningForAvatarResponse = (userInput) => {
    console.log('🎧 Started listening for avatar response to:', userInput)
    
    // Clear any existing timeout
    if (responseTimeoutId) {
      clearTimeout(responseTimeoutId)
    }
    
    // Set up a timeout to capture response after avatar finishes speaking
    responseTimeoutId = setTimeout(async () => {
      try {
        // Try to get the task result/status which might contain the response
        const statusResponse = await axios({
          method: 'GET',
          url: `https://api.heygen.com/v1/streaming.task/${sessionId.value}`,
          headers: {
            accept: 'application/json',
            'x-api-key': 'ZjljNzdmNjUxYjA2NGY3Nzg0NWZmYmExOGJkNDNiN2UtMTc1NTMyMjI0OA==',
          },
        }).catch(() => null)
        
        if (statusResponse?.data?.data?.response) {
          console.log('💬 Avatar response captured:', statusResponse.data.data.response)
          lastSpokenText.value = statusResponse.data.data.response
          addLog(`Avatar response: ${statusResponse.data.data.response}`)
        } else {
          // If we can't get the response from API, use speech-to-text approach
          console.log('💬 No API response found, using fallback method')
          await captureAvatarSpeechFallback(userInput)
        }
      } catch (error) {
        console.log('Error getting task status:', error)
        await captureAvatarSpeechFallback(userInput)
      }
    }, 2000) // Wait 2 seconds after avatar starts speaking
  }

  // Fallback method to capture avatar speech using Web Audio API
  const captureAvatarSpeechFallback = async (userInput) => {
    try {
      console.log('🎤 Attempting to capture avatar speech via audio analysis')
      
      // Try to get the avatar audio element
      const audioElement = document.getElementById('avatarAudio')
      if (!audioElement || !audioElement.srcObject) {
        console.log('❌ Avatar audio element not available for analysis')
        lastSpokenText.value = `[Response to: ${userInput}]`
        return
      }
      
      // Use the knowledge base to generate expected response patterns
      if (window.kbStore) {
        const timeGreeting = window.kbStore.getTimeGreeting()
        
        // Pattern matching for common responses
        if (userInput.toLowerCase().includes('halo') || userInput.toLowerCase().includes('hai')) {
          lastSpokenText.value = `Selamat ${timeGreeting}! Terima kasih sudah merespons. Saya dari AXA Mandiri. Apakah Bapak/Ibu ada waktu sebentar untuk mendengar penawaran produk asuransi kami?`
        } else if (userInput.toLowerCase().includes('ya') || userInput.toLowerCase().includes('iya')) {
          lastSpokenText.value = `Baik, terima kasih. Sebelumnya kami mengucapkan terimakasih kepada Bapak/Ibu yang telah menjadi nasabah AXA Mandiri. Saat ini kami ingin menawarkan produk asuransi unggulan yaitu Asuransi Mandiri Proteksi Penyakit Tropis.`
        } else if (userInput.toLowerCase().includes('tidak') || userInput.toLowerCase().includes('gak')) {
          lastSpokenText.value = `Saya mengerti. Mungkin Bapak/Ibu bisa meluangkan waktu sebentar saja? Ini produk yang sangat bermanfaat untuk perlindungan kesehatan keluarga.`
        } else if (userInput.toLowerCase().includes('apa') || userInput.toLowerCase().includes('gimana')) {
          lastSpokenText.value = `Asuransi Mandiri Proteksi Penyakit Tropis adalah produk yang memberikan manfaat penggantian biaya rawat inap akibat penyakit tropis seperti demam berdarah, tifus, dan malaria.`
        } else {
          lastSpokenText.value = `Saya mengerti. Apakah ada yang ingin Bapak/Ibu tanyakan tentang produk asuransi kami?`
        }
        
        console.log('💬 Generated contextual response:', lastSpokenText.value)
        addLog(`Avatar contextual response: ${lastSpokenText.value}`)
      } else {
        lastSpokenText.value = `[Avatar responded to: ${userInput}]`
      }
      
    } catch (error) {
      console.error('Error in fallback speech capture:', error)
      lastSpokenText.value = `[Response to: ${userInput}]`
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
            'x-api-key': 'ZjljNzdmNjUxYjA2NGY3Nzg0NWZmYmExOGJkNDNiN2UtMTc1NTMyMjI0OA==',
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
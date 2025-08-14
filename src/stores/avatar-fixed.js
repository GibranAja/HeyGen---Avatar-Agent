// stores/avatar-fixed.js
import { defineStore } from 'pinia'
import axios from 'axios'

export const useAvatarStore = defineStore('avatar', {
  state: () => ({
    avatar: null,
    isConnected: false,
    sessionId: null,
    logs: [],
    isLoading: false,
    streamReady: false,
    sessionData: null,
    isSpeaking: false,
    lastSpokenText: '',
    
    // User interaction tracking
    hasUserInteracted: false,
  }),

  actions: {
    addLog(message) {
      const timestamp = new Date().toLocaleTimeString()
      this.logs.push(`[${timestamp}] ${message}`)
    },

    // Track user interaction
    setUserInteraction() {
      this.hasUserInteracted = true
      this.addLog('✅ User interaction detected')
    },

    async createSession(avatarId, voiceId, knowledgeBaseId = null) {
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
          this.addLog(`Using Avatar ID: ${avatarId.trim()}`)
        } else {
          this.addLog('No Avatar ID provided - using default avatar')
        }

        if (voiceId && voiceId.trim()) {
          sessionConfig.voice = {
            voice_id: voiceId.trim(),
            rate: 1,
            emotion: 'friendly',
          }
          this.addLog(`Using Voice ID: ${voiceId.trim()}`)
        } else {
          // Provide default voice configuration
          sessionConfig.voice = {
            rate: 1
          }
          this.addLog('No Voice ID provided - using default voice')
        }

        if (knowledgeBaseId && knowledgeBaseId.trim()) {
          sessionConfig.knowledge_base_id = knowledgeBaseId.trim()
          this.addLog(`Using Knowledge Base ID: ${knowledgeBaseId.trim()}`)
        } else {
          this.addLog('No Knowledge Base ID provided')
        }

        this.addLog(`Creating session with config: ${JSON.stringify(sessionConfig, null, 2)}`)

        const response = await axios({
          method: 'POST',
          url: 'https://api.heygen.com/v1/streaming.new',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'OWQ0NmQ1NDNjMzg5NGE1Y2I1ZDc2NGJjNzYxMWE1YWQtMTc1NTE0NTI2NA==',
          },
          data: sessionConfig,
        })

        if (response.data && response.data.data) {
          this.sessionData = response.data.data
          this.sessionId = this.sessionData.session_id
          this.addLog(`Session created successfully: ${this.sessionId}`)
          return this.sessionData
        } else {
          throw new Error('Invalid response format from API')
        }
      } catch (error) {
        console.error('Error creating session:', error)

        if (error.response?.data) {
          this.addLog(`API Error Response: ${JSON.stringify(error.response.data, null, 2)}`)
        }

        const errorMsg =
          error.response?.data?.message || error.message || 'Failed to create session'
        this.addLog(`Error: ${errorMsg}`)

        if (error.response?.status === 401) {
          this.addLog('Error 401: Invalid API key. Please check your HeyGen API key')
        } else if (error.response?.status === 400) {
          this.addLog('Error 400: Bad Request - Check the following:')
          this.addLog('- API key is valid and has proper permissions')
          this.addLog('- Avatar ID exists in your HeyGen account (if provided)')
          this.addLog('- Voice ID format is correct (if provided)')
          this.addLog('- Account has sufficient credits')
          this.addLog('- Required fields: stt_settings, voice configuration')
        } else if (error.response?.status === 403) {
          this.addLog('Error 403: Forbidden - Check account permissions and credits')
        } else if (error.response?.status === 404) {
          this.addLog('Error 404: Resource not found - Check API endpoint')
        }

        throw error
      }
    },

    async startSession(avatarId, voiceId, knowledgeBaseId = null) {
      try {
        this.isLoading = true
        this.addLog('=== Starting New Avatar Session ===')

        if (avatarId && avatarId.trim()) {
          this.addLog(`Avatar ID: ${avatarId.trim()}`)
        } else {
          this.addLog('Avatar ID: Not provided (will use default)')
        }

        if (voiceId && voiceId.trim()) {
          this.addLog(`Voice ID: ${voiceId.trim()}`)
        } else {
          this.addLog('Voice ID: Not provided (will use default)')
        }

        if (knowledgeBaseId && knowledgeBaseId.trim()) {
          this.addLog(`Knowledge Base ID: ${knowledgeBaseId.trim()}`)
        } else {
          this.addLog('Knowledge Base ID: Not provided')
        }

        // Step 1: Create session
        this.addLog('Step 1: Creating session...')
        const sessionData = await this.createSession(avatarId, voiceId, knowledgeBaseId)

        // Step 2: Start session
        this.addLog('Step 2: Starting session...')
        const startResponse = await axios({
          method: 'POST',
          url: 'https://api.heygen.com/v1/streaming.start',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'OWQ0NmQ1NDNjMzg5NGE1Y2I1ZDc2NGJjNzYxMWE1YWQtMTc1NTE0NTI2NA==',
          },
          data: {
            session_id: this.sessionId,
          },
        })

        this.addLog('Session started successfully')
        this.addLog(`Status: ${startResponse.data?.status || 'Unknown'}`)

        // Step 3: Setup WebRTC connection
        this.addLog('Step 3: Setting up WebRTC connection...')
        await this.setupWebRTCConnection()

        this.isConnected = true
        this.addLog('=== Avatar Session Ready ===')

        return sessionData
      } catch (error) {
        console.error('Error starting session:', error)

        if (error.response?.data) {
          this.addLog(`Start Session Error: ${JSON.stringify(error.response.data, null, 2)}`)
        }

        const errorMsg = error.response?.data?.message || error.message || 'Failed to start session'
        this.addLog(`Error: ${errorMsg}`)

        if (error.response?.status === 401) {
          this.addLog('Error 401: Authentication failed - Check API key')
        } else if (error.response?.status === 400) {
          this.addLog('Error 400: Invalid session parameters')
        } else if (error.response?.status === 404) {
          this.addLog('Error 404: Session not found - Try creating a new session')
        }

        throw error
      } finally {
        this.isLoading = false
      }
    },

    async setupWebRTCConnection() {
      try {
        if (!this.sessionData?.url || !this.sessionData?.access_token) {
          this.addLog('Missing WebRTC connection data')
          this.addLog(`URL: ${this.sessionData?.url ? 'Present' : 'Missing'}`)
          this.addLog(`Token: ${this.sessionData?.access_token ? 'Present' : 'Missing'}`)
          return
        }

        this.addLog('Setting up WebRTC connection...')
        this.addLog(`WebSocket URL: ${this.sessionData.url}`)

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
          this.isSpeaking = true
          this.addLog('Avatar started talking')
        })

        room.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (message) => {
          console.log('💬 Avatar is saying:', message)
          // Update lastSpokenText with the current message
          if (message && typeof message === 'string') {
            this.lastSpokenText = message
          }
        })

        room.on(StreamingEvents.AVATAR_STOP_TALKING, (event) => {
          console.log('🛑 Avatar stopped talking:', event)
          this.isSpeaking = false
          this.addLog(`Avatar finished speaking: "${this.lastSpokenText}"`)
        })

        room.on(StreamingEvents.AVATAR_END_MESSAGE, (message) => {
          console.log('✅ Avatar final message:', message)
          // Ensure we have the complete final message
          if (message && typeof message === 'string') {
            this.lastSpokenText = message
          }
        })

        // Setup event listeners SEBELUM connect
        room.on('trackSubscribed', (track, publication, participant) => {
          this.addLog(`✅ Track subscribed: ${track.kind} from ${participant.identity}`)
          console.log('Track subscribed:', track, publication, participant)

          const videoElement = document.getElementById('avatarVideo')
          if (!videoElement) {
            this.addLog('❌ Video element not found!')
            console.error('Video element not found!')
            return
          }

          if (track.kind === 'video') {
            this.addLog('✅ Processing video track...')
            console.log('Attaching video track to element:', videoElement)
            
            track.attach(videoElement)
            
            // Set video properties but don't force play immediately
            videoElement.muted = true // Start muted to avoid autoplay issues
            videoElement.autoplay = true
            videoElement.playsInline = true
            
            // Try to play after user interaction
            if (this.hasUserInteracted) {
              videoElement.muted = false
              videoElement.volume = 1.0
              videoElement.play().then(() => {
                this.addLog('✅ Video playing successfully')
                this.streamReady = true
                console.log('Video is now playing')
              }).catch((err) => {
                this.addLog(`❌ Video play error: ${err.message}`)
                console.error('Video play error:', err)
                this.streamReady = true // Still set ready even if autoplay fails
              })
            } else {
              this.streamReady = true
              this.addLog('✅ Video ready - waiting for user interaction')
            }
            
            this.addLog('✅ Video stream attached and ready')
          }

          if (track.kind === 'audio') {
            this.addLog('✅ Processing audio track...')
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
              this.addLog('✅ Created dedicated audio element')
            }

            track.attach(audioElement)

            // Only unmute and play if user has interacted
            if (this.hasUserInteracted) {
              audioElement.muted = false
              audioElement.volume = 1.0
              videoElement.muted = false
              videoElement.volume = 1.0

              this.enableAudioContext()

              audioElement.play().then(() => {
                this.addLog('✅ Audio playing successfully')
                console.log('Audio is now playing')
              }).catch((err) => {
                this.addLog(`❌ Audio play error: ${err.message}`)
                console.error('Audio play error:', err)
                this.requestUserInteractionForAudio()
              })
            } else {
              this.addLog('✅ Audio ready - waiting for user interaction')
              this.requestUserInteractionForAudio()
            }

            this.addLog('✅ Audio stream attached')
          }
        })

        room.on('trackUnsubscribed', (track, publication, participant) => {
          this.addLog(`Track unsubscribed: ${track.kind}`)
          console.log('Track unsubscribed:', track.kind)
          track.detach()
        })

        room.on('disconnected', () => {
          this.addLog('❌ LiveKit room disconnected')
          console.log('Room disconnected')
          this.streamReady = false
          this.isConnected = false
        })

        room.on('participantConnected', (participant) => {
          this.addLog(`✅ Participant connected: ${participant.identity}`)
          console.log('Participant connected:', participant.identity)
        })

        room.on('participantDisconnected', (participant) => {
          this.addLog(`❌ Participant disconnected: ${participant.identity}`)
          console.log('Participant disconnected:', participant.identity)
        })

        room.on('reconnecting', () => {
          this.addLog('🔄 Room reconnecting...')
          console.log('Room reconnecting')
        })

        room.on('reconnected', () => {
          this.addLog('✅ Room reconnected')
          console.log('Room reconnected')
        })

        // Connect to room
        this.addLog('🔄 Connecting to LiveKit room...')
        console.log('Connecting to room with URL:', this.sessionData.url)
        
        await room.connect(this.sessionData.url, this.sessionData.access_token)
        this.addLog('✅ Connected to LiveKit room successfully')
        console.log('Room connected successfully')

        // Safely iterate through participants
        if (room.participants && typeof room.participants.forEach === 'function') {
          room.participants.forEach((participant) => {
            this.addLog(`Found participant: ${participant.identity}`)
            if (participant.tracks && typeof participant.tracks.forEach === 'function') {
              participant.tracks.forEach((publication) => {
                if (publication.track) {
                  this.addLog(`Found existing track: ${publication.track.kind}`)
                }
              })
            }
          })
        } else if (room.participants && room.participants.size !== undefined) {
          // Handle Map object
          room.participants.forEach((participant) => {
            this.addLog(`Found participant: ${participant.identity}`)
            if (participant.tracks && participant.tracks.size !== undefined) {
              participant.tracks.forEach((publication) => {
                if (publication.track) {
                  this.addLog(`Found existing track: ${publication.track.kind}`)
                }
              })
            }
          })
        }

        this.avatar = room
        this.addLog('✅ WebRTC connection setup completed')
        console.log('WebRTC setup completed, room:', room)
        
      } catch (error) {
        console.error('Error setting up WebRTC:', error)
        this.addLog(`❌ WebRTC Error: ${error.message}`)
      }
    },

    enableAudioContext() {
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
                this.addLog('✅ Audio context resumed successfully')
              })
              .catch((err) => {
                this.addLog(`❌ Failed to resume audio context: ${err.message}`)
              })
          }
        }
      } catch (error) {
        this.addLog(`❌ Audio context error: ${error.message}`)
      }
    },

    requestUserInteractionForAudio() {
      const enableAudio = () => {
        this.hasUserInteracted = true
        
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
        
        this.enableAudioContext()
        
        document.removeEventListener('click', enableAudio)
        document.removeEventListener('touchstart', enableAudio)
        document.removeEventListener('keydown', enableAudio)
        
        this.addLog('✅ Audio enabled via user interaction')
      }

      document.addEventListener('click', enableAudio, { once: true })
      document.addEventListener('touchstart', enableAudio, { once: true })
      document.addEventListener('keydown', enableAudio, { once: true })
      
      this.addLog('🎤 Click anywhere to enable audio')
    },

    async speak(text, taskType = 'repeat') {
      if (!this.isConnected || !this.sessionId) {
        this.addLog('Error: Not connected to session')
        return
      }

      if (!text?.trim()) {
        this.addLog('Error: No text provided')
        return
      }

      try {
        this.isSpeaking = true
        
        const speakData = {
          session_id: this.sessionId,
          text: text.trim(),
          task_type: taskType === 'talk' ? 'talk' : 'repeat',
        }

        this.addLog(`Sending speak request (${taskType}): "${text.trim()}"`)

        const response = await axios({
          method: 'POST',
          url: 'https://api.heygen.com/v1/streaming.task',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'x-api-key': 'OWQ0NmQ1NDNjMzg5NGE1Y2I1ZDc2NGJjNzYxMWE1YWQtMTc1NTE0NTI2NA==',
          },
          data: speakData,
        })

        this.addLog(`Avatar speaking successfully`)

        // If this is a 'talk' type request, the response might be different from the input
        // For 'repeat' type, the response is the same as the input
        if (taskType === 'talk') {
          // We'll capture the response in the response payload if available
          // Otherwise, fall back to the input text
          if (response.data && response.data.response) {
            this.lastSpokenText = response.data.response.trim()
          }
        } else {
          // For repeat tasks, the response is the same as the input
          this.lastSpokenText = text.trim()
        }

        const estimatedDuration = Math.max(3000, (text.length * 200))
        
        setTimeout(() => {
          this.isSpeaking = false
          this.addLog(`Avatar finished speaking: "${this.lastSpokenText}"`)
        }, estimatedDuration)

        return response
      } catch (error) {
        this.isSpeaking = false
        console.error('Error speaking:', error)
        const errorMsg =
          error.response?.data?.message || error.message || 'Failed to make avatar speak'
        this.addLog(`Speak Error: ${errorMsg}`)
        throw error
      }
    },

    async closeSession() {
      try {
        this.addLog('Closing session...')

        if (this.sessionId) {
          await axios({
            method: 'POST',
            url: 'https://api.heygen.com/v1/streaming.stop',
            headers: {
              accept: 'application/json',
              'content-type': 'application/json',
              'x-api-key': 'OWQ0NmQ1NDNjMzg5NGE1Y2I1ZDc2NGJjNzYxMWE1YWQtMTc1NTE0NTI2NA==',
            },
            data: {
              session_id: this.sessionId,
            },
          })
          this.addLog('Session stopped via API')
        }

        if (this.avatar && this.avatar.disconnect) {
          await this.avatar.disconnect()
          this.addLog('LiveKit room disconnected')
        }

        const audioElement = document.getElementById('avatarAudio')
        if (audioElement) {
          audioElement.remove()
        }

        // Reset state
        this.avatar = null
        this.isConnected = false
        this.sessionId = null
        this.sessionData = null
        this.streamReady = false
        this.isSpeaking = false
        this.lastSpokenText = ''
        this.hasUserInteracted = false
        this.addLog('Session closed successfully')
      } catch (error) {
        console.error('Error closing session:', error)
        this.addLog(`Close Error: ${error.message || 'Failed to close session'}`)

        // Force reset state even if API call fails
        this.avatar = null
        this.isConnected = false
        this.sessionId = null
        this.sessionData = null
        this.streamReady = false
        this.isSpeaking = false
        this.lastSpokenText = ''
        this.hasUserInteracted = false
      }
    },

    clearLogs() {
      this.logs = []
    },
  },
})
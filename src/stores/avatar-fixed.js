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
  }),

  actions: {
    addLog(message) {
      const timestamp = new Date().toLocaleTimeString()
      this.logs.push(`[${timestamp}] ${message}`)
    },

    async createSession(avatarId, voiceId, knowledgeBaseId = null) {
      try {
        // Basic session configuration
        const sessionConfig = {
          quality: 'medium',
          version: 'v2',
          video_encoding: 'VP8',
          disable_idle_timeout: false,
          activity_idle_timeout: 120,
        }

        // Only add avatar_id if provided and not empty
        if (avatarId && avatarId.trim()) {
          sessionConfig.avatar_id = avatarId.trim()
          this.addLog(`Using Avatar ID: ${avatarId.trim()}`)
        } else {
          this.addLog('No Avatar ID provided - using default avatar')
        }

        // Only add voice settings if provided and not empty
        if (voiceId && voiceId.trim()) {
          sessionConfig.voice = {
            voice_id: voiceId.trim(),
            rate: 1,
            emotion: 'friendly',
          }
          this.addLog(`Using Voice ID: ${voiceId.trim()}`)
        } else {
          this.addLog('No Voice ID provided - using default voice')
        }

        // Add knowledge base if provided
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
            'x-api-key': 'YzY0ZTllY2Q3NjI4NGMyY2I5ZjQ2MzIwZDg5MDUzZTEtMTc1NDQ1NTUxNg==',
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

        // Validate inputs
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
            'x-api-key': 'YzY0ZTllY2Q3NjI4NGMyY2I5ZjQ2MzIwZDg5MDUzZTEtMTc1NDQ1NTUxNg==',
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

        const room = new Room({
          videoCaptureDefaults: {
            resolution: VideoPresets.h540,
          },
        })

        // Connect to room
        await room.connect(this.sessionData.url, this.sessionData.access_token)
        this.addLog('Connected to LiveKit room')

        // Setup video and audio streams
        room.on('trackSubscribed', (track, publication, participant) => {
          this.addLog(`Track subscribed: ${track.kind} from ${participant.identity}`)

          const videoElement = document.getElementById('avatarVideo')
          if (!videoElement) {
            this.addLog('Video element not found')
            return
          }

          if (track.kind === 'video') {
            this.addLog('Processing video track...')
            track.attach(videoElement)
            this.streamReady = true
            this.addLog('Video stream attached and ready')
          }

          if (track.kind === 'audio') {
            this.addLog('Processing audio track...')
            track.attach(videoElement)

            // Force unmute and set volume
            videoElement.muted = false
            videoElement.volume = 1.0

            // Try to enable audio context if blocked
            this.enableAudioContext()

            this.addLog('Audio stream attached and unmuted')
          }
        })

        room.on('trackUnsubscribed', (track, publication, participant) => {
          this.addLog(`Track unsubscribed: ${track.kind}`)
          track.detach()
        })

        room.on('disconnected', () => {
          this.addLog('LiveKit room disconnected')
          this.streamReady = false
          this.isConnected = false
        })

        room.on('participantConnected', (participant) => {
          this.addLog(`Participant connected: ${participant.identity}`)
        })

        room.on('participantDisconnected', (participant) => {
          this.addLog(`Participant disconnected: ${participant.identity}`)
        })

        this.avatar = room // Store room instance
        this.addLog('WebRTC connection setup completed')
      } catch (error) {
        console.error('Error setting up WebRTC:', error)
        this.addLog(`WebRTC Error: ${error.message}`)
      }
    },

    // Tambahkan method baru untuk mengatasi audio context blocking
    enableAudioContext() {
      try {
        // Create audio context if it doesn't exist
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
                this.addLog('Audio context resumed successfully')
              })
              .catch((err) => {
                this.addLog(`Failed to resume audio context: ${err.message}`)
              })
          }
        }
      } catch (error) {
        this.addLog(`Audio context error: ${error.message}`)
      }
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
            'x-api-key': 'YzY0ZTllY2Q3NjI4NGMyY2I5ZjQ2MzIwZDg5MDUzZTEtMTc1NDQ1NTUxNg==',
          },
          data: speakData,
        })

        this.addLog(`Avatar speaking successfully`)
      } catch (error) {
        console.error('Error speaking:', error)
        const errorMsg =
          error.response?.data?.message || error.message || 'Failed to make avatar speak'
        this.addLog(`Speak Error: ${errorMsg}`)
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
              'x-api-key': 'YzY0ZTllY2Q3NjI4NGMyY2I5ZjQ2MzIwZDg5MDUzZTEtMTc1NDQ1NTUxNg==',
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

        // Reset state
        this.avatar = null
        this.isConnected = false
        this.sessionId = null
        this.sessionData = null
        this.streamReady = false
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
      }
    },

    clearLogs() {
      this.logs = []
    },
  },
})

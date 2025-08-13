// utils/conversationHelpers.js

import { MESSAGE_SENDER } from '../stores/conversation'

/**
 * Format timestamp for display
 * @param {string|Date} timestamp - The timestamp to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted time string
 */
export const formatTimestamp = (timestamp, options = {}) => {
  try {
    const date = new Date(timestamp)
    const defaultOptions = {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      ...options
    }
    
    return date.toLocaleTimeString('en-US', defaultOptions)
  } catch (error) {
    console.error('Error formatting timestamp:', error)
    return ''
  }
}

/**
 * Format date for display
 * @param {string|Date} timestamp - The timestamp to format
 * @returns {string} Formatted date string
 */
export const formatDate = (timestamp) => {
  try {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch (error) {
    console.error('Error formatting date:', error)
    return ''
  }
}

/**
 * Get sender display name
 * @param {string} sender - MESSAGE_SENDER enum value
 * @returns {string} Display name for sender
 */
export const getSenderDisplayName = (sender) => {
  switch (sender) {
    case MESSAGE_SENDER.USER:
      return 'You'
    case MESSAGE_SENDER.AVATAR:
      return 'Avatar'
    default:
      return 'Unknown'
  }
}

/**
 * Get CSS classes for message bubble based on sender
 * @param {string} sender - MESSAGE_SENDER enum value
 * @returns {Object} CSS classes object
 */
export const getMessageClasses = (sender) => {
  return {
    'message-user': sender === MESSAGE_SENDER.USER,
    'message-avatar': sender === MESSAGE_SENDER.AVATAR,
    'message-self': sender === MESSAGE_SENDER.USER,
    'message-other': sender === MESSAGE_SENDER.AVATAR
  }
}

/**
 * Truncate message content for preview
 * @param {string} content - Message content
 * @param {number} maxLength - Maximum length (default: 50)
 * @returns {string} Truncated content
 */
export const truncateMessage = (content, maxLength = 50) => {
  if (!content || typeof content !== 'string') return ''
  
  if (content.length <= maxLength) return content
  
  return content.substring(0, maxLength).trim() + '...'
}

/**
 * Generate unique message ID
 * @returns {string} Unique message ID
 */
export const generateMessageId = () => {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Validate message content
 * @param {string} content - Message content to validate
 * @returns {Object} Validation result
 */
export const validateMessageContent = (content) => {
  const result = {
    isValid: false,
    errors: [],
    cleanContent: ''
  }

  if (!content) {
    result.errors.push('Message content is required')
    return result
  }

  if (typeof content !== 'string') {
    result.errors.push('Message content must be a string')
    return result
  }

  const cleanContent = content.trim()
  
  if (cleanContent.length === 0) {
    result.errors.push('Message content cannot be empty')
    return result
  }

  if (cleanContent.length > 5000) {
    result.errors.push('Message content is too long (max 5000 characters)')
    return result
  }

  result.isValid = true
  result.cleanContent = cleanContent
  return result
}

/**
 * Extract keywords from message content
 * @param {string} content - Message content
 * @param {number} maxKeywords - Maximum number of keywords (default: 5)
 * @returns {string[]} Array of keywords
 */
export const extractKeywords = (content, maxKeywords = 5) => {
  if (!content || typeof content !== 'string') return []

  // Simple keyword extraction - remove common words and get meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ])

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.has(word))

  // Count word frequency
  const wordCount = {}
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1
  })

  // Sort by frequency and return top keywords
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word)
}

/**
 * Calculate conversation statistics
 * @param {Array} messages - Array of messages
 * @returns {Object} Conversation statistics
 */
export const calculateConversationStats = (messages) => {
  if (!Array.isArray(messages)) {
    return {
      totalMessages: 0,
      userMessages: 0,
      avatarMessages: 0,
      totalWords: 0,
      averageMessageLength: 0,
      conversationDuration: 0,
      firstMessageTime: null,
      lastMessageTime: null
    }
  }

  const userMessages = messages.filter(msg => msg.sender === MESSAGE_SENDER.USER)
  const avatarMessages = messages.filter(msg => msg.sender === MESSAGE_SENDER.AVATAR)
  
  const totalWords = messages.reduce((count, msg) => {
    return count + (msg.content ? msg.content.split(/\s+/).length : 0)
  }, 0)

  const averageMessageLength = messages.length > 0 
    ? Math.round(totalWords / messages.length)
    : 0

  const timestamps = messages
    .map(msg => new Date(msg.timestamp))
    .filter(date => !isNaN(date.getTime()))
    .sort((a, b) => a - b)

  const firstMessageTime = timestamps.length > 0 ? timestamps[0] : null
  const lastMessageTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : null
  
  const conversationDuration = firstMessageTime && lastMessageTime
    ? Math.round((lastMessageTime - firstMessageTime) / 1000) // in seconds
    : 0

  return {
    totalMessages: messages.length,
    userMessages: userMessages.length,
    avatarMessages: avatarMessages.length,
    totalWords,
    averageMessageLength,
    conversationDuration,
    firstMessageTime,
    lastMessageTime
  }
}

/**
 * Export conversation to different formats
 * @param {Array} messages - Array of messages
 * @param {string} format - Export format ('json', 'text', 'csv')
 * @returns {string} Exported conversation data
 */
export const exportConversation = (messages, format = 'json') => {
  if (!Array.isArray(messages)) {
    throw new Error('Messages must be an array')
  }

  switch (format.toLowerCase()) {
    case 'json':
      return JSON.stringify({
        messages,
        stats: calculateConversationStats(messages),
        exportedAt: new Date().toISOString()
      }, null, 2)

    case 'text':
      return messages.map(msg => {
        const time = formatTimestamp(msg.timestamp)
        const sender = getSenderDisplayName(msg.sender)
        return `[${time}] ${sender}: ${msg.content}`
      }).join('\n')

    case 'csv':
      const csvHeader = 'Timestamp,Sender,Content\n'
      const csvRows = messages.map(msg => {
        const timestamp = new Date(msg.timestamp).toISOString()
        const sender = getSenderDisplayName(msg.sender)
        const content = msg.content.replace(/"/g, '""') // Escape quotes
        return `"${timestamp}","${sender}","${content}"`
      }).join('\n')
      return csvHeader + csvRows

    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

/**
 * Search messages by content
 * @param {Array} messages - Array of messages
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Array} Filtered messages
 */
export const searchMessages = (messages, query, options = {}) => {
  if (!Array.isArray(messages) || !query || typeof query !== 'string') {
    return []
  }

  const {
    caseSensitive = false,
    exactMatch = false,
    sender = null,
    dateRange = null
  } = options

  const searchTerm = caseSensitive ? query : query.toLowerCase()

  return messages.filter(msg => {
    // Content search
    const content = caseSensitive ? msg.content : msg.content.toLowerCase()
    const contentMatch = exactMatch 
      ? content === searchTerm
      : content.includes(searchTerm)

    if (!contentMatch) return false

    // Sender filter
    if (sender && msg.sender !== sender) return false

    // Date range filter
    if (dateRange) {
      const msgDate = new Date(msg.timestamp)
      if (dateRange.start && msgDate < new Date(dateRange.start)) return false
      if (dateRange.end && msgDate > new Date(dateRange.end)) return false
    }

    return true
  })
}

/**
 * Group messages by date
 * @param {Array} messages - Array of messages
 * @returns {Object} Messages grouped by date
 */
export const groupMessagesByDate = (messages) => {
  if (!Array.isArray(messages)) return {}

  const groups = {}

  messages.forEach(msg => {
    const date = formatDate(msg.timestamp)
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(msg)
  })

  return groups
}

/**
 * Get conversation insights
 * @param {Array} messages - Array of messages
 * @returns {Object} Conversation insights
 */
export const getConversationInsights = (messages) => {
  if (!Array.isArray(messages)) return {}

  const stats = calculateConversationStats(messages)
  const keywords = extractKeywords(messages.map(m => m.content).join(' '), 10)
  const groupedByDate = groupMessagesByDate(messages)

  return {
    ...stats,
    keywords,
    dailyBreakdown: Object.keys(groupedByDate).map(date => ({
      date,
      messageCount: groupedByDate[date].length
    })),
    mostActiveHour: getMostActiveHour(messages),
    longestMessage: getLongestMessage(messages),
    shortestMessage: getShortestMessage(messages)
  }
}

/**
 * Get most active hour from messages
 * @param {Array} messages - Array of messages
 * @returns {number|null} Most active hour (0-23)
 */
const getMostActiveHour = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return null

  const hourCounts = {}
  
  messages.forEach(msg => {
    const hour = new Date(msg.timestamp).getHours()
    hourCounts[hour] = (hourCounts[hour] || 0) + 1
  })

  return Object.entries(hourCounts).reduce((max, [hour, count]) => {
    return count > max.count ? { hour: parseInt(hour), count } : max
  }, { hour: null, count: 0 }).hour
}

/**
 * Get longest message
 * @param {Array} messages - Array of messages
 * @returns {Object|null} Longest message
 */
const getLongestMessage = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return null

  return messages.reduce((longest, msg) => {
    return msg.content.length > (longest?.content?.length || 0) ? msg : longest
  }, null)
}

/**
 * Get shortest message
 * @param {Array} messages - Array of messages
 * @returns {Object|null} Shortest message
 */
const getShortestMessage = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return null

  return messages.reduce((shortest, msg) => {
    return msg.content.length < (shortest?.content?.length || Infinity) ? msg : shortest
  }, null)
}
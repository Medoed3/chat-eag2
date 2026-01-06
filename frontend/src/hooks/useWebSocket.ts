// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react'

interface UseWebSocketOptions {
  onMessage?: (data: any) => void
  onOpen?: () => void
  onClose?: (event: CloseEvent) => void
  onError?: (error: Event) => void
}

export const useWebSocket = (chatId: number | null, options: UseWebSocketOptions = {}) => {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const connect = useCallback(() => {
    if (!chatId) return

    const token = localStorage.getItem('access_token')
    if (!token) {
      console.error('Токен не найден')
      return
    }

    // Закрываем существующее соединение
    if (wsRef.current) {
      wsRef.current.close()
    }

    // Создаем WebSocket соединение с backend
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const backendPort = import.meta.env.VITE_BACKEND_PORT || '8000'
    const wsUrl = `${protocol}//localhost:${backendPort}/api/ws/${chatId}?token=${token}`

    console.log('WebSocket connecting to:', wsUrl)
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('WebSocket connected to chat:', chatId)
      options.onOpen?.()

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }

      // Ping для поддержания соединения
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }
      pingIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }))
        }
      }, 30000)
    }

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        options.onMessage?.(data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason)
      options.onClose?.(event)

      // Очищаем интервал ping
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Автоматическое переподключение
      if (event.code !== 1000) {
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('Reconnecting WebSocket...')
            connect()
          }, 3000)
        }
      }
    }

    socket.onerror = (error) => {
      console.error('WebSocket error:', error)
      options.onError?.(error)
    }

    wsRef.current = socket

    return socket
  }, [chatId, options])

  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
      return true
    }
    return false
  }, [])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close(1000, "Disconnecting")
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  return {
    send: sendMessage,
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  }
}
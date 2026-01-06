// frontend/src/utils/formatTime.ts
export const formatTime = (date: Date): string => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const messageDate = new Date(date)
  const messageDay = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate())

  if (messageDay.getTime() === today.getTime()) {
    // Сегодня: показываем только время
    return messageDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } else if (messageDay.getTime() === yesterday.getTime()) {
    // Вчера: показываем "Вчера" и время
    return `Вчера, ${messageDate.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    })}`
  } else if (now.getTime() - messageDate.getTime() < 7 * 24 * 60 * 60 * 1000) {
    // В течение недели: показываем день недели и время
    return messageDate.toLocaleDateString('ru-RU', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } else {
    // Более недели назад: показываем дату и время
    return messageDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}
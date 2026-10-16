import { useContext } from 'react'
import { NotificationsContext } from './NotificationsContext.js'

export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications doit être utilisé dans <NotificationsProvider>')
  return context
}

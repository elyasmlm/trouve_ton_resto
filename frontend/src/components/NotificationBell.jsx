import { Link, NavLink } from 'react-router-dom'
import { useNotifications } from '../notifications/useNotifications.js'
import { BellIcon } from './Icons.jsx'

// Cloche d'en-tête avec la pastille des notifications non lues ; `plain` : simple lien (fil plein écran)
export default function NotificationBell({ className, plain }) {
  const { unread } = useNotifications()
  const label = unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'
  const Tag = plain ? Link : NavLink
  return (
    <Tag to="/notifications" className={`${className} bell`} aria-label={label}>
      <BellIcon />
      {unread > 0 && <span className="bell__dot">{unread > 9 ? '9+' : unread}</span>}
    </Tag>
  )
}

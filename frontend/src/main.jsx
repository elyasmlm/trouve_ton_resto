import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/rubik'
import './index.css'
import App from './App.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import ListsProvider from './lists/ListsProvider.jsx'
import NotificationsProvider from './notifications/NotificationsProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ListsProvider>
          <NotificationsProvider>
            <App />
          </NotificationsProvider>
        </ListsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
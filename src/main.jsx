import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from '@/hooks/useAuth'
import AppRouter from '@/router'
import '@/styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </React.StrictMode>
)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { TopbarProvider } from './context/TopbarContext.jsx'
import { installSaveNotifications } from './utils/saveNotifications.js'

installSaveNotifications()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <TopbarProvider>
        <App />
      </TopbarProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

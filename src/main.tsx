import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)

// Register the Smart Minds installable app service worker.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/smart-minds/sw.js', { scope: '/smart-minds/' }).catch((error) => {
      console.error('Smart Minds service worker registration failed:', error)
    })
  })
}

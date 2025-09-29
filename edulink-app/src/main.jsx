import './polyfills.js' // Import polyfills first
// import { StrictMode } from 'react' // Disabled for socket stability
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  // <StrictMode> // Disabled for socket stability
    <App />
  // </StrictMode>,
)

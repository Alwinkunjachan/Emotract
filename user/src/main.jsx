import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { SocketProvider } from "./context/SocketProvider";
import Auth0ProviderWithNavigate from "./context/Auth0ProviderWithNavigate";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Auth0ProviderWithNavigate>
        <SocketProvider>
          <App />
        </SocketProvider>
      </Auth0ProviderWithNavigate>
    </BrowserRouter>
  </StrictMode>,
)

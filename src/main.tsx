import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { registerClientApiInterceptor } from './lib/client-api-interceptor'
import './index.css'
import App from './App'

import { getQueryClient } from './lib/query-client'

// Register client-side API interceptor for 100% offline/standalone execution
registerClientApiInterceptor()

const queryClient = getQueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)

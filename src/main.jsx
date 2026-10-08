import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import App from './App'
import './index.css'
import { installScrollbarFade } from './lib/scrollbars'

installScrollbarFade()

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <MotionConfig reducedMotion="user">
          <App />
        </MotionConfig>
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
)

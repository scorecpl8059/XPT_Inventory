'use client'

import { Auth0Provider } from '@auth0/auth0-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { Toaster } from 'sonner'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  const domain    = process.env.NEXT_PUBLIC_AUTH0_DOMAIN!
  const clientId  = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID!
  const audience  = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE!

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: typeof window !== 'undefined'
          ? `${window.location.origin}/auth/callback`
          : '',
        audience,
        scope: 'openid profile email',
      }}
      cacheLocation="localstorage"
    >
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster richColors position="top-right" closeButton />
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </Auth0Provider>
  )
}

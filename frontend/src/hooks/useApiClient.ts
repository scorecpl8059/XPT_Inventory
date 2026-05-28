'use client'

import { useAuth0 } from '@auth0/auth0-react'
import { useMemo } from 'react'
import { ApiClient } from '@/lib/api-client'

export function useApiClient(): ApiClient {
  const { getAccessTokenSilently } = useAuth0()
  return useMemo(
    () => new ApiClient(getAccessTokenSilently),
    [getAccessTokenSilently]
  )
}

/**
 * OrgProvider — manages the active organization selection.
 *
 * Mounted once at the root. Waits for isAuthenticated before making API calls.
 * Uses silent refresh to avoid unmounting child components.
 */
'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { ApiClient } from '@/lib/api-client'
import type { Organization } from '@/types'

interface OrgContextValue {
  activeOrg:    Organization | null
  organizations: Organization[]
  setActiveOrgId: (orgId: string) => void
  refresh:       () => Promise<void>
  isLoading:     boolean
}

const OrgContext = createContext<OrgContextValue | null>(null)

const STORAGE_KEY = 'xpt-inv-active-org-id'

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: authLoading, getAccessTokenSilently } = useAuth0()

  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [activeOrgId,   setActiveOrgIdState] = useState<string | null>(null)
  const [isLoading,     setIsLoading]     = useState(true)

  const clientRef = useRef<ApiClient | null>(null)
  if (!clientRef.current) {
    clientRef.current = new ApiClient(() => getAccessTokenSilently())
  }

  const loadOrganizations = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const api = clientRef.current!
      await api.bootstrap()
      const { organizations: orgList } = await api.listOrganizations()
      setOrganizations(orgList)

      const savedId    = localStorage.getItem(STORAGE_KEY)
      const validSaved = orgList.find(o => o.orgId === savedId)

      if (validSaved) {
        setActiveOrgIdState(validSaved.orgId)
      } else if (orgList.length > 0) {
        setActiveOrgIdState(orgList[0].orgId)
        localStorage.setItem(STORAGE_KEY, orgList[0].orgId)
      }
    } catch (err) {
      console.error('[OrgProvider] Failed to load organizations:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const didLoad = useRef(false)
  useEffect(() => {
    if (authLoading || !isAuthenticated || didLoad.current) return
    didLoad.current = true
    loadOrganizations()
  }, [authLoading, isAuthenticated, loadOrganizations])

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setIsLoading(false)
    }
  }, [authLoading, isAuthenticated])

  const setActiveOrgId = useCallback((orgId: string) => {
    setActiveOrgIdState(orgId)
    localStorage.setItem(STORAGE_KEY, orgId)
  }, [])

  const activeOrg = organizations.find(o => o.orgId === activeOrgId) ?? null

  return (
    <OrgContext.Provider value={{ activeOrg, organizations, setActiveOrgId, refresh: () => loadOrganizations(true), isLoading }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrg(): OrgContextValue {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within an OrgProvider')
  return ctx
}

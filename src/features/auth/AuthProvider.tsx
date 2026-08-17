import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthProfile } from './AuthContext'

type AuthProviderProps = {
  children: ReactNode
}

type InventoryAuthState = {
  profile: AuthProfile | null
  canWriteInventory: boolean
}

async function fetchInventoryAuthState(session: Session | null): Promise<InventoryAuthState> {
  if (!session?.user) {
    return {
      profile: null,
      canWriteInventory: false,
    }
  }

  const [profileResult, writeAccessResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, role')
      .eq('id', session.user.id)
      .maybeSingle(),
    supabase.rpc('has_inventory_write_access'),
  ])

  if (profileResult.error) {
    console.error('No fue posible cargar el perfil de inventario.', profileResult.error)
  }

  if (writeAccessResult.error) {
    console.error('No fue posible verificar permisos de escritura.', writeAccessResult.error)
  }

  const profile = profileResult.data as AuthProfile | null
  const roleAllowsWriting = profile?.role === 'admin' || profile?.role === 'operator'

  return {
    profile,
    canWriteInventory: writeAccessResult.data ?? roleAllowsWriting,
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [canWriteInventory, setCanWriteInventory] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function syncSession(nextSession: Session | null) {
      setIsLoading(true)

      const nextAuthState = await fetchInventoryAuthState(nextSession)

      if (!isMounted) return

      setSession(nextSession)
      setProfile(nextAuthState.profile)
      setCanWriteInventory(nextAuthState.canWriteInventory)
      setIsLoading(false)
    }

    async function loadSession() {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession()

      await syncSession(currentSession)
    }

    void loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncSession(nextSession)
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        canWriteInventory,
        isLoading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

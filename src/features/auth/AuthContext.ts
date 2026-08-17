import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export type InventoryRole = 'admin' | 'operator' | 'viewer'

export type AuthProfile = {
  id: string
  display_name: string
  role: InventoryRole
}

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: AuthProfile | null
  canWriteInventory: boolean
  isLoading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

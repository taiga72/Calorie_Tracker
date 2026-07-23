import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import type { Profile } from '../types'
import { getProfile, updateProfile as updateProfileStore } from '../lib/storage'

interface ProfileContextValue {
  profile: Profile | null
  loading: boolean
  refreshProfile: () => void
  setProfile: (fields: Partial<Profile>) => void
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfileState] = useState<Profile | null>(() => getProfile())
  const [loading] = useState(false)

  const refreshProfile = useCallback(() => {
    setProfileState(getProfile())
  }, [])

  const setProfile = useCallback((fields: Partial<Profile>) => {
    const updated = updateProfileStore(fields)
    setProfileState(updated)
  }, [])

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider')
  return ctx
}

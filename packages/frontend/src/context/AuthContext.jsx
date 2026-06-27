import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = loading
  const [token, setToken] = useState(() => localStorage.getItem('meshgit_token'))

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const exchangeCode = params.get('exchange')
    if (!exchangeCode) return

    // Strip the exchange code from the URL immediately — it's single-use
    window.history.replaceState({}, '', window.location.pathname)

    // Redeem the opaque code for the JWT via POST (never exposed in URLs or logs)
    fetch('/api/auth/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: exchangeCode }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.token) {
          localStorage.setItem('meshgit_token', data.token)
          setToken(data.token)
        }
      })
  }, [])

  useEffect(() => {
    if (!token) { setUser(null); return }

    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((u) => setUser(u))
      .catch(() => setUser(null))
  }, [token])

  const logout = async () => {
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {})
    }
    localStorage.removeItem('meshgit_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

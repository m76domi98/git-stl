import type { AuthModule } from '../shared/auth/types.js'

export const TEST_USER_HEADER = 'x-test-user'

/** Authenticates as whatever user id the request names in `x-test-user`. */
export const fakeAuth: AuthModule = {
  authenticate(req, res, next) {
    const userId = req.header(TEST_USER_HEADER)
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }
    req.user = { userId }
    next()
  },
}

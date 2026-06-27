import passport from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import pool from '../db.js'

passport.use(new GitHubStrategy(
  {
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3001/api/auth/github/callback',
    scope: ['read:user', 'user:email'],
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (github_id, github_username, github_avatar, email)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (github_id) DO UPDATE
           SET github_username = EXCLUDED.github_username,
               github_avatar   = EXCLUDED.github_avatar,
               email           = COALESCE(EXCLUDED.email, users.email)
         RETURNING *`,
        [
          profile.id,
          profile.username,
          profile.photos?.[0]?.value ?? null,
          profile.emails?.[0]?.value ?? null,
        ]
      )
      done(null, rows[0])
    } catch (err) {
      done(err)
    }
  }
))

export default passport

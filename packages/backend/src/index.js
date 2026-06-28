import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import passport from './auth/passport.js'
import { migrate } from './db/migrate.js'
import authRouter from './routes/auth.js'
import projectsRouter from './routes/projects.js'
import commitsRouter from './routes/commits.js'
import diffRouter from './routes/diff.js'
import mergeRouter from './routes/merge.js'
import { authenticate } from './middleware/authenticate.js'

if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET env var is required')
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET env var is required')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
}))
app.use(passport.initialize())
app.use(passport.session())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/auth', authRouter)
app.use('/api/projects', authenticate, projectsRouter)
app.use('/api/commits', authenticate, commitsRouter)
app.use('/api/diff', authenticate, diffRouter)
app.use('/api/merge', authenticate, mergeRouter)

app.use((err, req, res, _next) => {
  console.error(`[ERROR] ${req.method} ${req.url}:`, err.message, err.stack)
  res.status(500).json({ error: err.message })
})

migrate().then(() => {
  app.listen(PORT, () => console.log(`Backend running on port ${PORT}`))
})

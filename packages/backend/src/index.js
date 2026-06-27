import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import projectsRouter from './routes/projects.js'
import commitsRouter from './routes/commits.js'
import diffRouter from './routes/diff.js'
import mergeRouter from './routes/merge.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.use('/api/projects', projectsRouter)
app.use('/api/commits', commitsRouter)
app.use('/api/diff', diffRouter)
app.use('/api/merge', mergeRouter)

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`)
})

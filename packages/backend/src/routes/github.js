import { Router } from 'express'
import { Octokit } from '@octokit/rest'
import pool from '../db.js'
import { decrypt } from '../lib/tokenCrypto.js'
import { pushCommitToGitHub } from '../lib/githubSync.js'

const router = Router()

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100)
}

// POST /api/projects/:id/github — create a GitHub repo and link it to this project
router.post('/:id/github', async (req, res, next) => {
  try {
    const { rows: [project] } = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND owner_id = $2',
      [req.params.id, req.user.userId]
    )
    if (!project) return res.status(404).json({ error: 'Project not found' })
    if (project.github_repo_name) return res.status(409).json({ error: 'Project already linked to a GitHub repo' })

    const { rows: [userRow] } = await pool.query(
      'SELECT github_username, github_access_token FROM users WHERE id = $1',
      [req.user.userId]
    )
    if (!userRow.github_access_token) {
      return res.status(403).json({ error: 'No GitHub token on file. Please log out and sign in again.' })
    }

    const ghToken = decrypt(userRow.github_access_token)
    const octokit = new Octokit({ auth: ghToken })
    const repoName = slugify(project.name) || `meshgit-project-${project.id.slice(0, 8)}`

    const { is_private: privateRepo = false } = req.body

    const { data: ghRepo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: project.description || `MeshGit project: ${project.name}`,
      private: privateRepo,
      auto_init: false,
    })

    await pool.query(
      'UPDATE projects SET github_repo_owner = $1, github_repo_name = $2 WHERE id = $3',
      [ghRepo.owner.login, ghRepo.name, project.id]
    )

    // If the project already has commits, push the latest one to GitHub
    const { rows: [latestCommit] } = await pool.query(
      `SELECT c.id, c.mesh_id, c.message FROM commits c
       WHERE c.project_id = $1 ORDER BY c.created_at DESC LIMIT 1`,
      [project.id]
    )

    if (latestCommit) {
      await pushCommitToGitHub({
        token: ghToken,
        owner: ghRepo.owner.login,
        repo: ghRepo.name,
        meshId: latestCommit.mesh_id,
        projectId: project.id,
        message: latestCommit.message || 'Initial commit',
      })
    }

    res.status(201).json({
      github_repo_owner: ghRepo.owner.login,
      github_repo_name: ghRepo.name,
      github_url: ghRepo.html_url,
    })
  } catch (err) {
    if (err.status === 422) return res.status(422).json({ error: 'GitHub repo name already taken or invalid.' })
    next(err)
  }
})

export default router

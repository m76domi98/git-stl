import { Octokit } from '@octokit/rest'
import { readMesh } from '../storage.js'

export async function pushCommitToGitHub({ token, owner, repo, meshId, projectId, message }) {
  const octokit = new Octokit({ auth: token })

  const stlBuffer = await readMesh(projectId, meshId)

  const { data: blob } = await octokit.git.createBlob({
    owner, repo,
    content: stlBuffer.toString('base64'),
    encoding: 'base64',
  })

  let baseTree
  let parentShas = []
  try {
    const { data: ref } = await octokit.git.getRef({ owner, repo, ref: 'heads/main' })
    const { data: parentCommit } = await octokit.git.getCommit({ owner, repo, commit_sha: ref.object.sha })
    baseTree = parentCommit.tree.sha
    parentShas = [ref.object.sha]
  } catch (err) {
    if (err.status !== 404) throw err
  }

  const { data: tree } = await octokit.git.createTree({
    owner, repo,
    ...(baseTree ? { base_tree: baseTree } : {}),
    tree: [{ path: 'model.stl', mode: '100644', type: 'blob', sha: blob.sha }],
  })

  const { data: newCommit } = await octokit.git.createCommit({
    owner, repo,
    message: message || 'commit',
    tree: tree.sha,
    parents: parentShas,
  })

  if (parentShas.length > 0) {
    await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: newCommit.sha })
  } else {
    await octokit.git.createRef({ owner, repo, ref: 'refs/heads/main', sha: newCommit.sha })
  }

  return newCommit.sha
}

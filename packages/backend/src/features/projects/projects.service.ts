import { notFound } from '../../shared/http/errors.js'
import type { ProjectsRepository } from './projects.repository.js'
import type { CreateProjectInput, Project, ProjectSummary } from './projects.types.js'

export interface ProjectsService {
  list(userId: string): Promise<ProjectSummary[]>
  create(userId: string, input: CreateProjectInput): Promise<Project>
  get(userId: string, projectId: string): Promise<Project>
}

export function createProjectsService(repo: ProjectsRepository): ProjectsService {
  return {
    list: (userId) => repo.listByOwner(userId),
    create: (userId, input) => repo.create(userId, input),
    async get(userId, projectId) {
      const project = await repo.findOwned(projectId, userId)
      if (!project) throw notFound('Project')
      return project
    },
  }
}

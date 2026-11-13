import { AppError, notFound } from '../../shared/http/errors.js'
import type { Quotas } from '../../shared/quotas.js'
import type { ProjectsRepository } from './projects.repository.js'
import type { CreateProjectInput, Project, ProjectSummary } from './projects.types.js'

export interface ProjectsService {
  list(userId: string): Promise<ProjectSummary[]>
  create(userId: string, input: CreateProjectInput): Promise<Project>
  get(userId: string, projectId: string): Promise<Project>
}

export function createProjectsService(
  repo: ProjectsRepository,
  quotas: Pick<Quotas, 'maxProjects'>,
): ProjectsService {
  return {
    list: (userId) => repo.listByOwner(userId),
    async create(userId, input) {
      if ((await repo.countByOwner(userId)) >= quotas.maxProjects) {
        throw new AppError(403, 'Project limit reached')
      }
      return repo.create(userId, input)
    },
    async get(userId, projectId) {
      const project = await repo.findOwned(projectId, userId)
      if (!project) throw notFound('Project')
      return project
    },
  }
}

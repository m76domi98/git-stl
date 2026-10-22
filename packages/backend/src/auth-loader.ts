import type { Pool } from 'pg'
import type { Config } from './config.js'
import type { CommitEvents } from './features/commits/commit-events.js'
import { createDevAuth } from './shared/auth/dev-auth.js'
import type { AuthModule } from './shared/auth/types.js'
import type { MeshStorage } from './shared/storage.js'

export interface AuthModuleContext {
  config: Config
  db: Pool
  storage: MeshStorage
  events: CommitEvents
}

/** What `features/auth/index` must export when AUTH_MODE=github. */
export type AuthModuleFactory = (ctx: AuthModuleContext) => AuthModule | Promise<AuthModule>

// Kept outside the public repo; resolved at runtime so the build does not need it.
const PRIVATE_AUTH_MODULE = './features/auth/index.js'

type Importer = (specifier: string) => Promise<unknown>
const importModule: Importer = (specifier) => import(specifier)

export async function loadAuth(
  ctx: AuthModuleContext,
  load: Importer = importModule,
): Promise<AuthModule> {
  if (ctx.config.authMode === 'dev') return createDevAuth(ctx.db, ctx.config.nodeEnv)

  let mod: unknown
  try {
    mod = await load(new URL(PRIVATE_AUTH_MODULE, import.meta.url).href)
  } catch (err) {
    throw new Error(
      'AUTH_MODE=github needs the auth module in src/features/auth. Set AUTH_MODE=dev for local development.',
      { cause: err },
    )
  }

  const factory = (mod as { createAuthModule?: unknown }).createAuthModule
  if (typeof factory !== 'function') {
    throw new Error('src/features/auth/index must export createAuthModule(ctx)')
  }
  return (factory as AuthModuleFactory)(ctx)
}

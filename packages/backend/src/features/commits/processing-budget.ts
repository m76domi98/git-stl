import { lockUser, type UserDb } from '../../db/user-db.js'

/**
 * Counts every mesh cleaning a user starts, including ones that fail, so broken
 * files cost geometry CPU allowance too. Separate from the daily upload limit,
 * which only counts commits that succeeded.
 */
export interface ProcessingBudget {
  /** Records one attempt and returns true, or returns false if the user is at `maxPerDay`. */
  claim(userId: string, maxPerDay: number): Promise<boolean>
}

export function createProcessingBudget(db: UserDb): ProcessingBudget {
  return {
    // Committed before cleaning starts, so a crash or failed clean still counts.
    claim: (userId, maxPerDay) =>
      db.transaction(userId, async (tx) => {
        await lockUser(tx, userId)
        // Keeps the table small. The window below is 1 day, so these never count.
        await tx.query(
          `DELETE FROM processing_attempts
           WHERE user_id = $1 AND created_at < NOW() - INTERVAL '2 days'`,
          [userId],
        )
        const { rows } = await tx.query<{ attempts: number }>(
          `SELECT COUNT(*)::int AS attempts FROM processing_attempts
           WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 day'`,
          [userId],
        )
        if ((rows[0]?.attempts ?? 0) >= maxPerDay) return false
        await tx.query('INSERT INTO processing_attempts (user_id) VALUES ($1)', [userId])
        return true
      }),
  }
}

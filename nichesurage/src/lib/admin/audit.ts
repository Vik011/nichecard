import crypto from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/supabase/service'

export interface IntentInput {
  adminEmail: string
  action: string
  targetType: string
  targetId: string | null
  beforeJson: unknown
  reason: string
  ip: string | null
  userAgent: string | null
  sudoVerifiedAt: string | null
}

export interface OutcomeInput {
  intentId: string
  adminEmail: string
  action: string
  targetType: string
  targetId: string | null
  outcome: 'success' | 'failed'
  afterJson: unknown
  errorText: string | null
}

/**
 * Phase-1 of the 2-row pattern. Returns the intent_id so the caller can
 * thread it into logOutcome later. THROWS on insert failure — the caller
 * MUST abort the action if this throws, so we always have an intent record
 * even for actions that crashed mid-flight.
 */
export async function logIntent(input: IntentInput): Promise<string> {
  const supabase = createServiceClient()
  const intentId = crypto.randomUUID()
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_email: input.adminEmail,
    action: input.action,
    phase: 'intent',
    intent_id: intentId,
    target_type: input.targetType,
    target_id: input.targetId,
    before_json: input.beforeJson,
    reason: input.reason,
    ip: input.ip,
    user_agent: input.userAgent,
    sudo_verified_at: input.sudoVerifiedAt,
  })
  if (error) {
    console.error('[audit.logIntent] insert failed:', error)
    throw new Error(`logIntent failed: ${error.message}`)
  }
  return intentId
}

/**
 * Phase-2 of the 2-row pattern. Best-effort: if this insert fails, the
 * underlying action is already committed and we cannot roll it back. Log
 * the orphan to Sentry + console and return normally so the Server Action
 * still reports success to the admin.
 *
 * To find orphans later:
 *   SELECT * FROM admin_audit_log WHERE phase='intent'
 *     AND intent_id NOT IN (SELECT intent_id FROM admin_audit_log WHERE phase='outcome');
 */
export async function logOutcome(input: OutcomeInput): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('admin_audit_log').insert({
    admin_email: input.adminEmail,
    action: input.action,
    phase: 'outcome',
    intent_id: input.intentId,
    target_type: input.targetType,
    target_id: input.targetId,
    outcome: input.outcome,
    after_json: input.afterJson,
    error_text: input.errorText,
  })
  if (error) {
    console.error('[audit.logOutcome] orphaned intent:', input.intentId, error)
    Sentry.captureException(new Error(`audit logOutcome failed: ${error.message}`), {
      tags: { intent_id: input.intentId, action: input.action },
    })
  }
}

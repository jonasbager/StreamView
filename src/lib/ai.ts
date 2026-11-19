import type { GatewayProviderOptions } from '@ai-sdk/gateway'

/**
 * Primary model, overridable with AI_MODEL. If it is unavailable (e.g. the team is
 * on free Gateway credits, which only cover small models) the Gateway falls back in order.
 */
export const AI_MODEL = process.env.AI_MODEL || 'anthropic/claude-sonnet-5.5'

export const aiProviderOptions = {
  gateway: { models: ['openai/gpt-5-mini'] } satisfies GatewayProviderOptions,
}

import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import { blobToDataURL, resizeImage } from './images'

const RecipeSchema = z.object({
  name: z.string(),
  category: z.string().describe('Short category like "Curry", "Breakfast", "Dessert", "Salad"'),
  prepMinutes: z.number().nullable().describe('Total time in minutes, or null if not stated'),
  servings: z.number().nullable(),
  ingredients: z.array(z.string()).describe('One ingredient per item, with quantity and unit first, e.g. "2 cups basmati rice"'),
  steps: z.array(z.string()).describe('One step per item, without numbering'),
  tags: z.array(z.string()).describe('2-5 lowercase tags, e.g. "vegetarian", "quick", "spicy"'),
  notes: z.string().describe('Tips or notes from the source, or empty string'),
})

export type ExtractedRecipe = z.infer<typeof RecipeSchema>

const INSTRUCTIONS = `Extract the recipe from the input into the given structure.
Keep the recipe's own wording and quantities; translate to English if it's in another language.
For handwriting or photos, read carefully and fix obvious spelling mistakes.
If the input contains no recipe at all, return name "" and empty lists.`

export class AiError extends Error {}

/** Turns a photo or pasted text into a structured recipe using Claude, with the user's own API key. */
export async function extractRecipe(apiKey: string, input: { image?: Blob; text?: string }): Promise<ExtractedRecipe> {
  // The key belongs to the person using this app and never leaves their browser except to Anthropic.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const content: Anthropic.Beta.BetaContentBlockParam[] = []
  if (input.image) {
    const dataUrl = await blobToDataURL(await resizeImage(input.image, 1600, 0.85))
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: dataUrl.split(',')[1] },
    })
  }
  content.push({ type: 'text', text: input.text?.trim() ? `${INSTRUCTIONS}\n\n<input>\n${input.text}\n</input>` : INSTRUCTIONS })

  let response
  try {
    response = await client.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low', format: betaZodOutputFormat(RecipeSchema) },
      // If the model declines, the API retries on a fallback model within the same call
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content }],
    })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) throw new AiError('That API key was rejected — check it in Settings.')
    if (error instanceof Anthropic.PermissionDeniedError) throw new AiError('This API key does not have access to the model.')
    if (error instanceof Anthropic.RateLimitError) throw new AiError('Too many requests — wait a moment and try again.')
    if (error instanceof Anthropic.BadRequestError) throw new AiError(`The request was rejected: ${error.message}`)
    if (error instanceof Anthropic.APIError) throw new AiError(`Anthropic API error (${error.status ?? 'network'}). Try again.`)
    throw new AiError('Could not reach Anthropic. Check your internet connection.')
  }

  if (response.stop_reason === 'refusal') throw new AiError('Claude declined to process this input.')
  if (response.stop_reason === 'max_tokens') throw new AiError('The recipe was too long to read in one go.')
  const recipe = response.parsed_output
  if (!recipe) throw new AiError('Could not read a recipe from the response. Try again.')
  if (!recipe.name && recipe.ingredients.length === 0) throw new AiError('No recipe found in that input.')
  return recipe
}

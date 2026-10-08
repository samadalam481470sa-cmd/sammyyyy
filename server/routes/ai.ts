import { Router } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/security.ts'
import { askNewportAi } from '../services/aiAssistant.ts'

export const aiRouter = Router()

aiRouter.use(requireAuth)

const askSchema = z.object({
  question: z.string().min(2).max(2000),
})

aiRouter.post('/ask', async (req, res) => {
  const parsed = askSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid question' })

  try {
    const result = await askNewportAi(parsed.data.question)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'AI assistant failed' })
  }
})

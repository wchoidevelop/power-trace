import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod';
import { roleSchema, InitialScore, generateQuestionnaire } from '@/lib/ai';
import { invalidBody, withRoute } from '@/lib/http';

// same reasoning tier as scoring — see the note in scoring/route.ts
export const maxDuration = 300;

const bodySchema = z.object({
    org: z.string().min(1),
    roles: z.array(roleSchema).min(1),
    scoring: z.array(z.object({
        ...InitialScore.shape,
        power_index: z.number()
    })).min(1)
})

export const POST = withRoute('questionnaire', async (req: NextRequest) => {
  const params = bodySchema.safeParse(await req.json());
  if (!params.success) return invalidBody(params.error);

  const {org, roles, scoring} = params.data;

  const ai = await generateQuestionnaire({org, roles, scoring});

  return NextResponse.json(ai);
});

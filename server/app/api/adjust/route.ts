import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod';
import { roleSchema, InitialScore, adjustScoring, Questionnaire } from '@/lib/ai';
import { badRequest, invalidBody, withRoute } from '@/lib/http';

// the bias audit is the heaviest reasoning step — see scoring/route.ts
export const maxDuration = 300;

const bodySchema = z.object({
    org: z.string().min(1),
    // the id of the user's own position, not a prose description — adjustScoring
    // hands it to the model as <user_position> and joins on it
    selfRoleId: z.string().min(1),
    roles: z.array(roleSchema).min(1),
    scoring: z.array(z.object({
        ...InitialScore.shape,
        power_index: z.number()
    })).min(1),
    questionAnswers: z.array(z.object({
        ...Questionnaire.shape,
        id: z.coerce.number(),
        answer: z.string()
    }))
})

export const POST = withRoute('adjust', async (req: NextRequest) => {
  const params = bodySchema.safeParse(await req.json());
  if (!params.success) return invalidBody(params.error);

  const {org, selfRoleId, roles, scoring, questionAnswers} = params.data;

  // adjustScoring throws on this too, but as an opaque 500 the client would
  // offer a pointless retry for. It is the caller's mistake: say so as a 400.
  if (!roles.some((r) => r.id === selfRoleId)) {
    return badRequest(`selfRoleId "${selfRoleId}" is not one of the submitted roles.`);
  }

  const ai = await adjustScoring({org, selfRoleId, roles, scoring, questionAnswers});

  return NextResponse.json(ai);
});

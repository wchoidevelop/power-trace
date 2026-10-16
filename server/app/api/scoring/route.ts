import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod';
import { Role, roleSchema, generateInitialScoring } from '@/lib/ai';
import { invalidBody, withRoute } from '@/lib/http';

// High-effort reasoning over the whole role list runs 60-90s. Deploy platforms
// cap function execution well below that by default (Vercel: 60s), which would
// kill this mid-call in production even though it works locally.
export const maxDuration = 300;

const bodySchema = z.object({
    org: z.string().min(1),
    roles: z.array(roleSchema).min(1)
})

export const POST = withRoute('scoring', async (req: NextRequest) => {
  const params = bodySchema.safeParse(await req.json());
  if (!params.success) return invalidBody(params.error);

  const {org, roles} = params.data;

  const ai = await generateInitialScoring({org, roles});

  return NextResponse.json(ai);
});
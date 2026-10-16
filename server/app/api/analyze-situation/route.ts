import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AdjustedOutput, analyzeSituation, LaborDataSchema, POWER_BASES, type PowerBase } from '@/lib/ai';
import { invalidBody, withRoute } from '@/lib/http';

// long-form synthesis over the full map — see scoring/route.ts
export const maxDuration = 300;

// The per-base movement adjustScoring computes in code. Built from POWER_BASES
// so this cannot drift out of step with the six bases.
const deltaBlock = z.object(
  Object.fromEntries(POWER_BASES.map((b) => [b, z.number()])) as Record<PowerBase, z.ZodNumber>,
);

/**
 * A role as it comes back from /api/adjust (a FinalRole: model output plus the
 * index and deltas computed server-side), with the description the frontend
 * joins back on by id. analyzeSituation reads all of it — power_index and the
 * deltas both appear in the prompt it builds.
 */
const describedRole = z.object({
  ...AdjustedOutput.shape.adjusted_roles.element.shape,
  power_index: z.number(),
  deltas: deltaBlock.nullable(),
  moved: z.boolean().nullable(),
  description: z.string(),
});

// the adjustScores response, but with descriptions on each role
const describedAdjusted = z.object({
  adjusted_roles: z.array(describedRole).min(1),
  bias_flags: AdjustedOutput.shape.bias_flags,
  confidence: AdjustedOutput.shape.confidence,
  confidence_rationale: AdjustedOutput.shape.confidence_rationale.optional(),
});

const bodySchema = z.object({
  org: z.string().min(1),
  situationText: z.string().min(20),
  userRole: describedRole,
  roles: describedAdjusted,
  // absent for unpaid organizations — school clubs, churches, volunteer groups —
  // where BLS employment data does not describe the user's situation
  laborData: LaborDataSchema.optional(),
});

export const POST = withRoute('analyze-situation', async (req: NextRequest) => {
  const params = bodySchema.safeParse(await req.json());
  if (!params.success) {
    console.log(params)
    return invalidBody(params.error);
  }

  const { org, situationText, userRole, roles, laborData } = params.data;

  const ai = await analyzeSituation({
    orgDescription: org,
    situationText,
    userRole,
    allRoles: roles.adjusted_roles,
    biasFlags: roles.bias_flags,
    confidence: roles.confidence,
    // the model weighs the flags against why the map was rated this confident
    confidenceRationale: roles.confidence_rationale,
    laborData,
  });

  return NextResponse.json(ai);
});
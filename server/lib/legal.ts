/**
 * Privacy Policy and Terms of Service — the single source of truth.
 *
 * Rendered three ways from this one file:
 *   - /privacy and /terms          (public web pages; the URLs an app store asks for)
 *   - GET /api/legal?doc=privacy   (JSON the mobile app fetches and renders natively)
 *
 * Keeping the text here rather than in the app means a correction ships without
 * an app release — which matters, because a policy that no longer describes what
 * the software does is worse than no policy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TWO THINGS BEFORE THIS GOES LIVE
 *
 * 1. Fill in every TODO in OPERATOR below. The pages render the placeholder text
 *    verbatim, so an unfilled field is visible to anyone who reads the policy.
 *
 * 2. These are drafts written to describe this codebase accurately — they are not
 *    reviewed legal advice. The factual sections (what is sent where, what is
 *    stored) were checked against the code and are correct as of the version
 *    below. The liability, warranty, and governing-law sections are conventional
 *    boilerplate and are the parts worth having someone qualified read,
 *    especially before charging money or collecting accounts.
 *
 * WHEN THE CODE CHANGES, THIS FILE CHANGES. Specifically, revisit it if you:
 *   - add accounts, login, or any server-side storage of what users type
 *   - add analytics, crash reporting, or advertising
 *   - send user text to any service other than OpenAI
 *   - start retaining request logs that contain user content
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const OPERATOR = {
  /** The app's name as users see it. */
  appName: 'Power Trace',
  /** TODO: who is responsible for this. A person's name is fine for a personal project. */
  name: 'Wonjun Choi',
  /** TODO: an address you actually read. Required — a policy with no contact route is not a policy. */
  contactEmail: 'wchoi2027@gmail.com',
  /** TODO: e.g. 'New York, United States'. Used for the governing-law section. */
  jurisdiction: 'TODO_JURISDICTION',
  /** Canonical web home for these documents. TODO once deployed. */
  siteUrl: 'https://TODO.example.com',
  /** Minimum age. 18 is the safe default for anything touching employment disputes. */
  minimumAge: 13,
} as const;

export type LegalSection = {
  heading: string;
  /** Paragraphs. Rendered as separate blocks on web and in the app. */
  body: string[];
};

export type LegalDocSlug = 'privacy' | 'terms';

export type LegalDoc = {
  slug: LegalDocSlug;
  title: string;
  /** ISO date. Bump with any substantive edit. */
  effective: string;
  version: string;
  /** Plain-language summary, shown above the document itself. */
  summary: string;
  sections: LegalSection[];
};

const EFFECTIVE = '2026-08-06';
const VERSION = '1.0';

/* ────────────────────────────────────────────────────────────────
   PRIVACY POLICY

   Every factual claim below was verified against the code:
     - no user-provided content is written to MongoDB (the `soc` and `cps`
       collections are read-only reference data for occupation matching)
     - there is no account system and no analytics or crash-reporting SDK
     - only industry/occupation CODES reach the BLS API, never user text
     - saved runs live in AsyncStorage on the device
     - server logs carry field names, ids and counts — not user text
   ──────────────────────────────────────────────────────────────── */

const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  effective: EFFECTIVE,
  version: VERSION,
  summary:
    `${OPERATOR.appName} has no accounts and asks for no personal details. What you type is sent to ` +
    `OpenAI to produce the analysis, and is kept on your own device only if you choose to save a run. ` +
    `Nothing you type is stored on our server, and nothing is sold, shared for advertising, or tracked.`,
  sections: [
    {
      heading: 'Who runs this',
      body: [
        `${OPERATOR.appName} is a personal, non-commercial project by ${OPERATOR.name}. It is not a company, ` +
          `and it is not affiliated with, endorsed by, or acting on behalf of any employer, university, or ` +
          `government agency whose data it cites.`,
        `Questions about this policy, or about data you have submitted, go to ${OPERATOR.contactEmail}.`,
      ],
    },
    {
      heading: 'What you give us',
      body: [
        `There is no sign-up. We never ask for your name, email address, phone number, employer, or location, ` +
          `and there is nothing to log in to.`,
        `What the app does receive is what you type into it: a description of your organization, the roles you ` +
          `list and describe, a description of your own role, your answers to the follow-up questions, and — if ` +
          `you use that step — the situation you describe for analysis.`,
        `You choose how specific any of that is. The analysis works from job functions and reporting ` +
          `relationships; it does not need real names, and we recommend leaving them out.`,
      ],
    },
    {
      heading: 'Where it goes',
      body: [
        `To produce an analysis, the text you enter is sent from the app to our server, and from there to OpenAI, ` +
          `which runs the language models that do the scoring, generate the follow-up questions, and write the ` +
          `situation analysis. OpenAI processes that text on our behalf and handles it under its own terms and ` +
          `data-retention practices, which we do not control.`,
        `Labor-market figures come from the U.S. Bureau of Labor Statistics. Only impersonal industry and ` +
          `occupation classification codes are sent there — for example a code meaning "computer and mathematical ` +
          `occupations". None of your text, and nothing identifying you, is sent to the BLS.`,
        `Matching your role description to an occupation code involves a lookup against a read-only reference ` +
          `database of published occupation classifications. That lookup reads; it never writes what you typed.`,
      ],
    },
    {
      heading: 'What our server keeps',
      body: [
        `Nothing you type is saved on our server. Your text exists there only for the seconds it takes to ` +
          `forward it, get the analysis back, and return it to your device. There is no database of submissions, ` +
          `and no way for us to look up what you entered afterwards.`,
        `Ordinary operational logs record which step ran, how long it took, and any error — field names, ` +
          `identifiers, and counts. They are not designed to capture what you wrote, and we do not use them to.`,
        `The practical consequence: we cannot email you a copy of a past analysis, and we cannot delete one for ` +
          `you, because we do not have it. Your device does.`,
      ],
    },
    {
      heading: 'What your device keeps',
      body: [
        `When you tap Save, the analysis and the inputs behind it are written to your device's own app storage ` +
          `so you can reopen them later. This does not leave your device and is not synced or backed up to us.`,
        `You can delete any saved setup or run from the Library at any time. Deleting the app removes all of it. ` +
          `Bear in mind that a device backup you have configured yourself — an iCloud or Android backup, for ` +
          `instance — may include app storage, under that provider's terms rather than ours.`,
      ],
    },
    {
      heading: 'Information about other people',
      body: [
        `This is the part worth reading twice. Describing a workplace conflict usually means describing other ` +
          `people — a manager, a colleague, whoever else was involved. Those people are not using this app, have ` +
          `not agreed to this policy, and cannot see or correct what is said about them.`,
        `So keep them non-identifiable. Write "my direct manager" rather than a name. Describe what a role ` +
          `controls rather than who holds it. The analysis is built around positions and power relationships, so ` +
          `it loses nothing when you leave names, contact details, and identifying particulars out.`,
        `You are responsible for what you submit about others, including whether you are permitted to share it.`,
      ],
    },
    {
      heading: 'Sensitive situations',
      body: [
        `People bring genuinely sensitive things to a tool like this: harassment, discrimination, retaliation, ` +
          `investigations, health circumstances, disputes that may end up in a legal or HR process.`,
        `Two things to weigh before typing that in. It will be sent to OpenAI for processing, as described above. ` +
          `And a saved run sits on your device, where someone else with access to your unlocked phone or to a ` +
          `company-managed device could read it.`,
        `If a matter is already in front of a lawyer, a union representative, or an investigator, treat their ` +
          `guidance on what to write down as authoritative over anything this app suggests. Nothing you enter ` +
          `here is privileged or confidential in a legal sense.`,
      ],
    },
    {
      heading: 'What we do not do',
      body: [
        `No advertising, and no advertising identifiers. No analytics or tracking software: the app contains no ` +
          `analytics, attribution, or crash-reporting SDK. No selling, renting, or sharing of what you type for ` +
          `anyone else's commercial purposes. No profiles built about you across sessions — with no accounts, ` +
          `there is nothing to attach a profile to.`,
        `We may disclose information if we are legally required to, but since we hold no submissions, in practice ` +
          `there is very little that could be produced.`,
      ],
    },
    {
      heading: `Age ${OPERATOR.minimumAge} and over`,
      body: [
        `${OPERATOR.appName} is intended for people aged ${OPERATOR.minimumAge} or older who are in or entering ` +
          `the workforce. It is not directed at children, and we do not knowingly collect information from them. ` +
          `If you believe a child has submitted information, write to ${OPERATOR.contactEmail}.`,
      ],
    },
    {
      heading: 'Your choices',
      body: [
        `You can use the app without saving anything, in which case nothing persists once you close it. You can ` +
          `delete saved runs individually, or remove all of them by deleting the app. You can decline to enter a ` +
          `situation at all and still use the power-mapping steps.`,
        `Depending on where you live you may have rights to access, correct, or erase personal data held about ` +
          `you. Since we hold no submissions on our server, requests of that kind are mostly answered by the ` +
          `Library on your own device — but write to ${OPERATOR.contactEmail} if you have a question we should ` +
          `answer directly.`,
      ],
    },
    {
      heading: 'Changes',
      body: [
        `If this policy changes, the updated version appears here with a new effective date, and the app fetches ` +
          `it from this same source. Material changes to how your information is handled will be summarized at ` +
          `the top of the document.`,
      ],
    },
  ],
};

/* ────────────────────────────────────────────────────────────────
   TERMS OF SERVICE
   ──────────────────────────────────────────────────────────────── */

const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  effective: EFFECTIVE,
  version: VERSION,
  summary:
    `${OPERATOR.appName} is an educational tool that applies published organizational-psychology research to a ` +
    `workplace situation you describe. It is not legal, HR, or professional advice, its analysis is generated by ` +
    `a language model and can be wrong, and it comes with no warranty. Use it to think, not to decide.`,
  sections: [
    {
      heading: 'The agreement',
      body: [
        `By using ${OPERATOR.appName} you agree to these terms. If you do not, do not use it. The app is provided ` +
          `free of charge as a personal, non-commercial project by ${OPERATOR.name}.`,
      ],
    },
    {
      heading: 'This is not advice',
      body: [
        `${OPERATOR.appName} does not provide legal advice, human-resources advice, medical or psychological ` +
          `advice, or professional counsel of any kind. Using it creates no attorney–client, counselor–client, or ` +
          `professional relationship of any sort.`,
        `It is an educational tool. It takes a description you write and reads it against published research — ` +
          `French and Raven on power bases, Hirschman and Rusbult on exit and voice, Edmondson on psychological ` +
          `safety, and others named in the analysis. What comes back is one framing of your situation, not a ` +
          `finding about it.`,
        `For anything with real consequences — a grievance, a complaint, a resignation, a legal claim, a ` +
          `disciplinary process — consult an employment lawyer, your union representative, or another qualified ` +
          `professional. Do not substitute this app for that, and do not delay getting proper help because of ` +
          `something it told you.`,
      ],
    },
    {
      heading: 'How to read the output',
      body: [
        `The analysis is generated by a language model. It can be mistaken, internally inconsistent, or ` +
          `confidently wrong, and two runs on the same input may differ.`,
        `The power scores are estimates drawn from your own description of the roles. Where a description said ` +
          `nothing, the model fills the gap with what that kind of role usually looks like — a labelled ` +
          `assumption, not a measurement of the person.`,
        `Bias flags are hypotheses about how the description was written, not conclusions about you, and each one ` +
          `is shown with the case for it being wrong. Read both sides. Nothing in the output establishes that any ` +
          `named or describable person did anything.`,
        `Labor-market figures come from the U.S. Bureau of Labor Statistics and describe an industry or ` +
          `occupation in aggregate. They say nothing about your specific employer or your prospects. The "worker ` +
          `power index" is a composite constructed for this app, not an official statistic.`,
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        `Use ${OPERATOR.appName} for your own situation. Do not use it to build a case against a specific person, ` +
          `to monitor or evaluate employees, to screen candidates, or to make or justify decisions about someone ` +
          `else's employment, pay, or discipline. It was not designed for that and is not reliable for it.`,
        `Do not submit more information about other people than the analysis needs — see the Privacy Policy on ` +
          `keeping colleagues non-identifiable. Do not submit anyone's confidential medical, financial, or ` +
          `government-identifier data. Do not submit material you are contractually or legally barred from ` +
          `sharing, including your employer's confidential information.`,
        `Do not use the app unlawfully, to harass anyone, or to attempt to disrupt, overload, reverse-engineer, ` +
          `or extract the underlying prompts and models from the service.`,
      ],
    },
    {
      heading: 'Your content',
      body: [
        `What you type remains yours. We claim no ownership of it, and we do not store it on our server — see the ` +
          `Privacy Policy for where it does go. You are responsible for what you submit and for having the right ` +
          `to submit it.`,
        `To produce an analysis we need permission to transmit and process your text for that purpose, including ` +
          `sending it to OpenAI. That permission is limited to running the analysis you asked for.`,
      ],
    },
    {
      heading: 'Availability',
      body: [
        `This is a personal project running on paid third-party services. It may be slow, unavailable, changed, ` +
          `or discontinued at any time, without notice. Some steps take over a minute because the models behind ` +
          `them are doing genuine work.`,
        `Anything you want to keep, keep yourself. A saved run lives on your device and does not depend on the ` +
          `service continuing to exist — but nothing stops us from having to shut the service down.`,
      ],
    },
    {
      heading: 'No warranty',
      body: [
        `${OPERATOR.appName} is provided "as is" and "as available", without warranties of any kind, whether ` +
          `express or implied, including any implied warranty of merchantability, fitness for a particular ` +
          `purpose, accuracy, or non-infringement. We do not warrant that the analysis is accurate, complete, or ` +
          `suitable for any decision you are facing.`,
      ],
    },
    {
      heading: 'Limitation of liability',
      body: [
        `To the fullest extent permitted by law, ${OPERATOR.name} is not liable for any indirect, incidental, ` +
          `special, consequential, or punitive damages, or for any loss of employment, income, opportunity, data, ` +
          `or reputation, arising from your use of ${OPERATOR.appName} or from any action you took or did not take ` +
          `based on its output.`,
        `Some jurisdictions do not allow certain limitations, so parts of this section may not apply to you. ` +
          `Nothing here limits liability that cannot lawfully be limited.`,
      ],
    },
    {
      heading: `Age ${OPERATOR.minimumAge} and over`,
      body: [
        `You must be at least ${OPERATOR.minimumAge} years old to use ${OPERATOR.appName}.`,
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        `These terms may change. The current version, with its effective date, always appears here and in the ` +
          `app. Continuing to use ${OPERATOR.appName} after a change means you accept the revised terms.`,
      ],
    },
    {
      heading: 'Governing law',
      body: [
        `These terms are governed by the laws of ${OPERATOR.jurisdiction}, without regard to its conflict-of-laws ` +
          `rules. This does not deprive you of the protection of mandatory consumer-protection law where you live.`,
      ],
    },
    {
      heading: 'Contact',
      body: [`Questions about these terms: ${OPERATOR.contactEmail}.`],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalDocSlug, LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS) as LegalDocSlug[];

export function isLegalSlug(v: string | null | undefined): v is LegalDocSlug {
  return v === 'privacy' || v === 'terms';
}

/** Plain text, for anyone who wants to read or diff the whole thing at once. */
export function renderLegalText(doc: LegalDoc): string {
  return [
    doc.title.toUpperCase(),
    `Effective ${doc.effective} · Version ${doc.version}`,
    '',
    doc.summary,
    '',
    ...doc.sections.flatMap((s) => [s.heading.toUpperCase(), ...s.body, '']),
  ].join('\n');
}

import Link from 'next/link';
import { OPERATOR, type LegalDoc } from '@/lib/legal';

/**
 * Shared rendering for both legal documents. Deliberately plain: this page has to
 * stay readable when an app-store reviewer opens it on a phone, and it is the
 * canonical copy of the text the mobile app renders natively.
 */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === 'privacy' ? 'terms' : 'privacy';
  const otherLabel = doc.slug === 'privacy' ? 'Terms of Service' : 'Privacy Policy';

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <p className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        {OPERATOR.appName}
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{doc.title}</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Effective {doc.effective} · Version {doc.version}
      </p>

      <p className="mt-8 border-l-2 border-neutral-300 pl-4 text-[15px] leading-7 dark:border-neutral-700">
        {doc.summary}
      </p>

      {doc.sections.map((section) => (
        <section key={section.heading} className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
          {section.body.map((paragraph, i) => (
            <p key={i} className="mt-3 text-[15px] leading-7 text-neutral-700 dark:text-neutral-300">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <footer className="mt-14 border-t border-neutral-200 pt-6 text-sm dark:border-neutral-800">
        <Link href={`/${other}`} className="font-medium underline underline-offset-4">
          {otherLabel}
        </Link>
        <p className="mt-3 text-neutral-500">
          {OPERATOR.appName} is a personal, non-commercial project by {OPERATOR.name}. Contact:{' '}
          {OPERATOR.contactEmail}
        </p>
      </footer>
    </main>
  );
}

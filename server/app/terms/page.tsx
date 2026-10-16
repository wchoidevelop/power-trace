import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { LEGAL_DOCS, OPERATOR } from '@/lib/legal';

const doc = LEGAL_DOCS.terms;

export const metadata: Metadata = {
  title: `${doc.title} · ${OPERATOR.appName}`,
  description: doc.summary,
};

export default function TermsOfServicePage() {
  return <LegalPage doc={doc} />;
}

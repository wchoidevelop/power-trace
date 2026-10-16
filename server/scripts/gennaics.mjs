// generate-naics.mjs
import fs from 'fs';
import path from 'path';
import { Industry } from 'naics';

const main = async () => {
  const allEntries = Array.from(Industry.codes());
  const nationals = allEntries.filter(ent => ent.code.length === 6);

  const rows = nationals.map(nat => {
    const ind5 = nat.parent();
    const grp4 = ind5?.parent();
    const sub3 = grp4?.parent();
    const sec2 = sub3?.parent();
    return {
      sector_code:            sec2?.code  || '',
      sector_title:           sec2?.title || '',
      subsector_code:         sub3?.code  || '',
      subsector_title:        sub3?.title || '',
      industry_group_code:    grp4?.code  || '',
      industry_group_title:   grp4?.title || '',
      naics_industry_code:    ind5?.code  || '',
      naics_industry_title:   ind5?.title || '',
      national_industry_code:  nat.code,
      national_industry_title: nat.title,
    };
  });

  const header = [
    'sector_code', 'sector_title',
    'subsector_code', 'subsector_title',
    'industry_group_code', 'industry_group_title',
    'naics_industry_code', 'naics_industry_title',
    'national_industry_code', 'national_industry_title',
  ].join(',');

  const q = s => `"${s.replace(/"/g, '""')}"`;

  const lines = rows.map(r => [
    r.sector_code,          q(r.sector_title),
    r.subsector_code,       q(r.subsector_title),
    r.industry_group_code,  q(r.industry_group_title),
    r.naics_industry_code,  q(r.naics_industry_title),
    r.national_industry_code, q(r.national_industry_title),
  ].join(','));

  const csv = [header, ...lines].join('\n');

  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const now = new Date();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const yyyy = now.getFullYear();

  const outPath = path.resolve(dataDir, `${mm}-${dd}-${yyyy}.csv`);
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`✅ Wrote ${rows.length} rows to ${outPath}`);
};

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
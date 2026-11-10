import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { normalisePostcode, validateUpload } from './validateUpload';

function parse(csv: string): ReturnType<typeof validateUpload> {
  const res = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: 'greedy' });
  return validateUpload(res.meta.fields ?? [], res.data);
}

describe('normalisePostcode', () => {
  it('normalises to pcds form', () => {
    expect(normalisePostcode('yo305nj')).toBe('YO30 5NJ');
    expect(normalisePostcode(' SW1A  1AA ')).toBe('SW1A 1AA');
    expect(normalisePostcode('W1 1AA')).toBe('W1 1AA');
    expect(normalisePostcode('not a postcode')).toBeNull();
  });
});

describe('validateUpload', () => {
  it('accepts the published sample CSV with no errors', () => {
    const csv = readFileSync(fileURLToPath(new URL('../../public/data/portfolio_sample.csv', import.meta.url)), 'utf-8');
    const r = parse(csv);
    expect(r.errors).toEqual([]);
    expect(r.rows).toHaveLength(180);
    expect(r.rows[0]).toMatchObject({ asset_id: 'RL-0001', use: 'residential', tenure: 'rented' });
  });

  it('normalises values and allows £ and commas in amounts', () => {
    const r = parse(
      'Asset_ID,UPRN,Postcode,Use,Tenure,floor_area_m2,value_gbp\n' +
        'A1,,yo305nj,Residential,Owner-Occupied,85.5,"£250,000"\n',
    );
    expect(r.errors).toEqual([]);
    expect(r.rows[0]).toEqual({
      asset_id: 'A1',
      uprn: null,
      postcode: 'YO30 5NJ',
      use: 'residential',
      tenure: 'owner_occupied',
      floor_area_m2: 85.5,
      value_gbp: 250000,
    });
  });

  it('reports missing required columns at file level', () => {
    const r = parse('asset_id,use\nA1,residential\n');
    expect(r.rows).toEqual([]);
    expect(r.errors.map((e) => e.message)).toEqual([
      'Missing required column "tenure".',
      'The file needs a "uprn" column, a "postcode" column, or both.',
    ]);
  });

  it('reports row-level errors with file line numbers', () => {
    const r = parse(
      'asset_id,uprn,postcode,use,tenure,value_gbp\n' +
        'A1,123,,residential,rented,\n' + // line 2: ok
        'A1,456,,residential,rented,\n' + // line 3: duplicate id
        'A3,12ab,,office,leased,-5\n' + // line 4: bad uprn, use, tenure, value
        'A4,,,commercial,rented,\n' + // line 5: no uprn or postcode
        'A5,,ZZ,commercial,rented,\n', // line 6: bad postcode
    );
    expect(r.rows.map((x) => x.asset_id)).toEqual(['A1']);
    const at = (line: number): string[] => r.errors.filter((e) => e.line === line).map((e) => e.column ?? '-');
    expect(at(3)).toEqual(['asset_id']);
    expect(at(4)).toEqual(['uprn', 'use', 'tenure', 'value_gbp']);
    expect(at(5)).toEqual(['-']);
    expect(at(6)).toEqual(['postcode']);
  });

  it('warns about unknown columns but still validates', () => {
    const r = parse('asset_id,uprn,use,tenure,notes\nA1,1,residential,rented,hello\n');
    expect(r.errors).toEqual([]);
    expect(r.warnings[0]?.message).toContain('notes');
  });
});

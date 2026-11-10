import type { EnrichSummary } from '../lib/enrich';
import styles from './UploadBanner.module.css';

interface UploadBannerProps {
  fileName: string;
  summary: EnrichSummary;
  ms: number;
  onBack: () => void;
}

const MAX_IDS = 8;

export function UploadBanner({ fileName, summary: s, ms, onBack }: UploadBannerProps) {
  const ids = s.notCoveredIds.slice(0, MAX_IDS).join(', ');
  const more = s.notCoveredIds.length > MAX_IDS ? ` and ${String(s.notCoveredIds.length - MAX_IDS)} more` : '';
  return (
    <section className={styles.banner} aria-label="Uploaded portfolio summary" role="status">
      <div className={styles.text}>
        <p className={styles.title}>
          Showing your uploaded portfolio <span className={styles.file}>{fileName}</span>
        </p>
        <ul className={styles.counts}>
          <li>
            <strong>{s.byUprn}</strong> matched by UPRN
          </li>
          <li>
            <strong>{s.byPostcode}</strong> matched by postcode
          </li>
          {s.noEpc > 0 && (
            <li>
              <strong>{s.noEpc}</strong> located, no EPC found
            </li>
          )}
          <li>
            <strong>{s.notCovered}</strong> not covered in demo
          </li>
        </ul>
        {s.notCovered > 0 && (
          <p className={styles.note}>
            Not covered (outside the demo areas or not found): {ids}
            {more}.
          </p>
        )}
        <p className={styles.note}>
          Enriched in your browser in {(ms / 1000).toFixed(1)} s. Nothing was uploaded to a server.
        </p>
      </div>
      <button type="button" className={styles.back} onClick={onBack}>
        Back to demo portfolio
      </button>
    </section>
  );
}

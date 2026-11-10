import { ATTRIBUTION, DISCLAIMER, OGL_URL } from '../config/legal';
import styles from './Footer.module.css';

// Text lives in config/legal.ts so the footer and the PDF export stay identical (ARCHITECTURE.md §7).
export function Footer() {
  const [lead, ...rest] = DISCLAIMER.split('. ');
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>
        <strong>{lead}.</strong> {rest.join('. ')}
      </p>
      <p className={styles.attribution}>
        {ATTRIBUTION}{' '}
        <a href={OGL_URL} rel="noreferrer">
          Open Government Licence v3.0
        </a>
        {' · '}
        <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
          OpenStreetMap copyright
        </a>
      </p>
    </footer>
  );
}

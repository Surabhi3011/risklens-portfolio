import { brand } from '../config/brand';
import styles from './Header.module.css';

interface HeaderProps {
  asOf: string | null;
  uploaded?: boolean;
  onUpload?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  exporting?: boolean;
}

export function Header({ asOf, uploaded = false, onUpload, onExportCsv, onExportPdf, exporting = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.brand}>{brand.name}</h1>
        <p className={styles.tagline}>{brand.tagline}</p>
      </div>
      <div className={styles.meta}>
        <span className={styles.badge}>{uploaded ? 'Uploaded portfolio' : 'Demo portfolio'}</span>
        {asOf && <span className={styles.asOf}>Rules as of {asOf}</span>}
        {(onExportCsv ?? onExportPdf) && (
          <span className={styles.group} role="group" aria-label="Export the current selection">
            {onExportCsv && (
              <button type="button" className={styles.secondary} onClick={onExportCsv}>
                Export CSV
              </button>
            )}
            {onExportPdf && (
              <button type="button" className={styles.secondary} onClick={onExportPdf} disabled={exporting}>
                {exporting ? 'Building PDF…' : 'Export PDF'}
              </button>
            )}
          </span>
        )}
        {onUpload && (
          <button type="button" className={styles.action} onClick={onUpload}>
            Upload portfolio
          </button>
        )}
      </div>
    </header>
  );
}

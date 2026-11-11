import { FileSpreadsheet, FileText, ScanSearch, Upload } from 'lucide-react';
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

const ICON = { size: 16, strokeWidth: 2, 'aria-hidden': true } as const;

export function Header({ asOf, uploaded = false, onUpload, onExportCsv, onExportPdf, exporting = false }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <span className={styles.mark} aria-hidden="true">
            <ScanSearch size={18} strokeWidth={2.25} />
          </span>
          <div className={styles.titles}>
            <h1 className={styles.brand}>{brand.name}</h1>
            <p className={styles.tagline}>{brand.tagline}</p>
          </div>
        </div>

        <div className={styles.meta}>
          <span className={`${styles.badge} ${uploaded ? styles.badgeUpload : ''}`}>
            <span className={styles.dot} aria-hidden="true" />
            {uploaded ? 'Uploaded portfolio' : 'Demo portfolio'}
          </span>
          <span className={styles.asOf}>Rules as of {asOf ?? '…'}</span>
        </div>

        <div className={styles.actions}>
          {(onExportCsv ?? onExportPdf) && (
            <span className={styles.group} role="group" aria-label="Export the current selection">
              {onExportCsv && (
                <button type="button" className={styles.ghost} onClick={onExportCsv}>
                  <FileSpreadsheet {...ICON} />
                  <span>Export CSV</span>
                </button>
              )}
              {onExportPdf && (
                <button type="button" className={styles.ghost} onClick={onExportPdf} disabled={exporting}>
                  <FileText {...ICON} />
                  <span>{exporting ? 'Building PDF…' : 'Export PDF'}</span>
                </button>
              )}
            </span>
          )}
          {onUpload && (
            <button type="button" className={styles.primary} onClick={onUpload}>
              <Upload {...ICON} />
              <span>Upload portfolio</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

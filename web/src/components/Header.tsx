import { brand } from '../config/brand';
import styles from './Header.module.css';

interface HeaderProps {
  asOf: string | null;
  uploaded?: boolean;
  onUpload?: () => void;
}

export function Header({ asOf, uploaded = false, onUpload }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.brand}>{brand.name}</h1>
        <p className={styles.tagline}>{brand.tagline}</p>
      </div>
      <div className={styles.meta}>
        <span className={styles.badge}>{uploaded ? 'Uploaded portfolio' : 'Demo portfolio'}</span>
        {asOf && <span className={styles.asOf}>Rules as of {asOf}</span>}
        {onUpload && (
          <button type="button" className={styles.action} onClick={onUpload}>
            Upload portfolio
          </button>
        )}
      </div>
    </header>
  );
}

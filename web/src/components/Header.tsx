import { brand } from '../config/brand';
import styles from './Header.module.css';

interface HeaderProps {
  asOf: string | null;
  onUpload?: () => void;
}

export function Header({ asOf, onUpload }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.titles}>
        <h1 className={styles.brand}>{brand.name}</h1>
        <p className={styles.tagline}>{brand.tagline}</p>
      </div>
      <div className={styles.meta}>
        <span className={styles.badge}>Demo portfolio</span>
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

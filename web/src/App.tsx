import { useEffect } from 'react';
import styles from './App.module.css';
import { brand } from './config/brand';
import { usePortfolioStore } from './state/portfolioStore';

export default function App() {
  const load = usePortfolioStore((s) => s.load);
  const assets = usePortfolioStore((s) => s.assets);
  const rules = usePortfolioStore((s) => s.rules);
  const init = usePortfolioStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.brand}>{brand.name}</h1>
        <p className={styles.tagline}>{brand.tagline}</p>
      </header>
      <main className={styles.main} aria-live="polite">
        {load.status === 'error' && <p className={styles.error}>Could not load portfolio data: {load.message}</p>}
        {(load.status === 'idle' || load.status === 'loading') && <p className={styles.meta}>Loading portfolio…</p>}
        {load.status === 'ready' && (
          <>
            <p className={styles.count} data-testid="asset-count">
              {assets.length} assets
            </p>
            <p className={styles.meta}>Rules as of {rules?.as_of ?? 'unknown'}</p>
          </>
        )}
      </main>
    </div>
  );
}

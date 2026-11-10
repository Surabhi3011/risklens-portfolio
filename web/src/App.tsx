import { useEffect } from 'react';
import styles from './App.module.css';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
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
      <Header asOf={rules?.as_of ?? null} />
      <main className={styles.main}>
        <div aria-live="polite">
          {load.status === 'error' && <p className={styles.error}>Could not load portfolio data: {load.message}</p>}
          {(load.status === 'idle' || load.status === 'loading') && <p className={styles.meta}>Loading portfolio…</p>}
        </div>
        {load.status === 'ready' && (
          <>
            <KpiRow assets={assets} />
            <div className={styles.grid}>
              <section className={styles.mapPanel} aria-label="Risk map">
                <p className={styles.placeholder}>Risk map (P2.4)</p>
              </section>
              <section className={styles.chartPanel} aria-label="Charts">
                <p className={styles.placeholder}>EPC bands and compliance timeline (P2.5)</p>
              </section>
            </div>
            <section className={styles.tablePanel} aria-label="Assets">
              <p className={styles.placeholder}>Asset table (P2.6)</p>
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

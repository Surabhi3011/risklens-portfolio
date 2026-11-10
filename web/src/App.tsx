import { useEffect, useMemo } from 'react';
import styles from './App.module.css';
import { AssetTable } from './components/AssetTable';
import { ChartsPanel } from './components/ChartsPanel';
import { Filters } from './components/Filters';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { RiskMap } from './components/RiskMap';
import { filterAssets } from './lib/filters';
import { usePortfolioStore } from './state/portfolioStore';

export default function App() {
  const load = usePortfolioStore((s) => s.load);
  const assets = usePortfolioStore((s) => s.assets);
  const rules = usePortfolioStore((s) => s.rules);
  const init = usePortfolioStore((s) => s.init);
  const selectedId = usePortfolioStore((s) => s.selectedId);
  const select = usePortfolioStore((s) => s.select);
  const filters = usePortfolioStore((s) => s.filters);
  const setFilter = usePortfolioStore((s) => s.setFilter);
  const resetFilters = usePortfolioStore((s) => s.resetFilters);
  const sort = usePortfolioStore((s) => s.sort);
  const sortBy = usePortfolioStore((s) => s.sortBy);

  useEffect(() => {
    void init();
  }, [init]);

  // One filtered list drives the KPIs, map, charts and table together.
  const visible = useMemo(() => filterAssets(assets, filters), [assets, filters]);

  return (
    <div className={styles.shell}>
      <Header asOf={rules?.as_of ?? null} />
      <main className={styles.main}>
        <div aria-live="polite">
          {load.status === 'error' && <p className={styles.error}>Could not load portfolio data: {load.message}</p>}
          {(load.status === 'idle' || load.status === 'loading') && <p className={styles.meta}>Loading portfolio…</p>}
        </div>
        {load.status === 'ready' && rules && (
          <>
            <Filters
              assets={assets}
              filters={filters}
              shown={visible.length}
              onChange={setFilter}
              onReset={resetFilters}
            />
            <KpiRow assets={visible} />
            <div className={styles.grid}>
              <section className={styles.mapPanel} aria-label="Risk map">
                <RiskMap assets={visible} selectedId={selectedId} onSelect={select} />
              </section>
              <section className={styles.chartPanel} aria-label="Charts">
                <ChartsPanel assets={visible} rules={rules} />
              </section>
            </div>
            <section className={styles.tablePanel} aria-label="Assets">
              <AssetTable
                assets={visible}
                rules={rules}
                sort={sort}
                selectedId={selectedId}
                onSort={sortBy}
                onSelect={select}
              />
            </section>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}

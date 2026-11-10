import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import styles from './App.module.css';
import { AssetDrawer } from './components/AssetDrawer';
import { AssetTable } from './components/AssetTable';
import { Filters } from './components/Filters';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { KpiRow } from './components/KpiRow';
import { SummaryCard } from './components/SummaryCard';
import { UploadBanner } from './components/UploadBanner';
import { UploadDialog } from './components/UploadDialog';
import { buildCsv, downloadBlob, downloadText, exportFileName } from './lib/exportCsv';
import { describeFilters, filterAssets } from './lib/filters';
import { TIER_LABEL } from './lib/tiers';
import type { PortfolioRow } from './lib/validateUpload';
import { usePortfolioStore } from './state/portfolioStore';

// MapLibre and ECharts are the heaviest dependencies: load them after the KPIs and table are on screen.
const RiskMap = lazy(() => import('./components/RiskMap').then((m) => ({ default: m.RiskMap })));
const ChartsPanel = lazy(() => import('./components/ChartsPanel').then((m) => ({ default: m.ChartsPanel })));

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
  const source = usePortfolioStore((s) => s.source);
  const demoAssets = usePortfolioStore((s) => s.demoAssets);
  const showUpload = usePortfolioStore((s) => s.showUpload);
  const backToDemo = usePortfolioStore((s) => s.backToDemo);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  // Start downloading DuckDB-Wasm as soon as the upload dialog opens, so enrichment is ready sooner.
  useEffect(() => {
    if (!uploadOpen) return;
    import('./lib/duck')
      .then((m) => m.warmUp())
      .catch(() => {
        /* surfaced on submit */
      });
  }, [uploadOpen]);

  // One filtered list drives the KPIs, map, charts and table together.
  const visible = useMemo(() => filterAssets(assets, filters), [assets, filters]);
  // Look up the selection in the full list so the drawer stays open if a filter later hides the asset.
  const selectedAsset = useMemo(() => assets.find((a) => a.asset_id === selectedId) ?? null, [assets, selectedId]);

  const laNames = useMemo(() => new Map(demoAssets.map((a) => [a.la_code, a.la_name])), [demoAssets]);

  const sourceLabel = source.kind === 'upload' ? `Uploaded: ${source.fileName}` : 'Demo portfolio';

  const exportCsv = (): void => {
    if (!rules) return;
    downloadText(buildCsv(visible, rules), exportFileName('assets', 'csv'), 'text/csv');
  };

  const exportPdf = async (): Promise<void> => {
    if (!rules) return;
    setExporting(true);
    try {
      const { buildSummaryPdf } = await import('./lib/exportPdf');
      const doc = buildSummaryPdf({
        assets: visible,
        rules,
        sourceLabel,
        filterLabel: describeFilters(filters, laNames, TIER_LABEL),
      });
      downloadBlob(doc.output('blob'), exportFileName('summary', 'pdf'));
    } finally {
      setExporting(false);
    }
  };

  const enrich = async (rows: PortfolioRow[], fileName: string): Promise<void> => {
    if (!rules) throw new Error('Rules are not loaded yet.');
    const { enrichUpload } = await import('./lib/duck');
    const { assets: enriched, summary, ms } = await enrichUpload(rows, rules, laNames);
    showUpload(enriched, { fileName, summary, ms });
    setUploadOpen(false);
  };

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#asset-table">
        Skip to asset table
      </a>
      <Header
        asOf={rules?.as_of ?? null}
        uploaded={source.kind === 'upload'}
        exporting={exporting}
        onExportCsv={exportCsv}
        onExportPdf={() => {
          void exportPdf();
        }}
        onUpload={() => {
          setUploadOpen(true);
        }}
      />
      <main className={styles.main}>
        <div aria-live="polite">
          {load.status === 'error' && <p className={styles.error}>Could not load portfolio data: {load.message}</p>}
          {(load.status === 'idle' || load.status === 'loading') && <p className={styles.meta}>Loading portfolio…</p>}
        </div>
        {load.status === 'ready' && rules && (
          <>
            {source.kind === 'upload' && (
              <UploadBanner fileName={source.fileName} summary={source.summary} ms={source.ms} onBack={backToDemo} />
            )}
            <Filters
              assets={assets}
              filters={filters}
              shown={visible.length}
              onChange={setFilter}
              onReset={resetFilters}
            />
            <KpiRow assets={visible} />
            <SummaryCard assets={visible} rules={rules} />
            <div className={styles.grid}>
              <section className={styles.mapPanel} aria-label="Risk map">
                <Suspense fallback={<p className={styles.placeholder}>Loading map…</p>}>
                  <RiskMap assets={visible} selectedId={selectedId} onSelect={select} />
                </Suspense>
              </section>
              <section className={styles.chartPanel} aria-label="Charts">
                <Suspense fallback={<p className={styles.placeholder}>Loading charts…</p>}>
                  <ChartsPanel assets={visible} rules={rules} />
                </Suspense>
              </section>
            </div>
            <section className={styles.tablePanel} aria-label="Assets" id="asset-table" tabIndex={-1}>
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
      {selectedAsset && rules && (
        <AssetDrawer
          asset={selectedAsset}
          rules={rules}
          onClose={() => {
            select(null);
          }}
        />
      )}
      <UploadDialog
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
        }}
        onSubmit={enrich}
      />
      <Footer />
    </div>
  );
}

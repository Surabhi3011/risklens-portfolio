import Papa from 'papaparse';
import { useEffect, useId, useRef, useState } from 'react';
import { MAX_FILE_BYTES, MAX_ROWS, type PortfolioRow, type ValidationResult, validateUpload } from '../lib/validateUpload';
import styles from './UploadDialog.module.css';

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the valid rows. When absent, the continue button is disabled. */
  onSubmit?: (rows: PortfolioRow[]) => void;
}

const SAMPLE_URL = `${import.meta.env.BASE_URL}data/portfolio_sample.csv`;
const ERRORS_SHOWN = 50;

type State =
  | { kind: 'empty' }
  | { kind: 'parsing'; fileName: string }
  | { kind: 'failed'; fileName: string; message: string }
  | { kind: 'done'; fileName: string; result: ValidationResult };

export function UploadDialog({ open, onClose, onSubmit }: UploadDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, setState] = useState<State>({ kind: 'empty' });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const handleFile = (file: File): void => {
    if (file.size > MAX_FILE_BYTES) {
      setState({ kind: 'failed', fileName: file.name, message: 'The file is larger than 5 MB.' });
      return;
    }
    setState({ kind: 'parsing', fileName: file.name });
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => (h.charCodeAt(0) === 0xfeff ? h.slice(1) : h).trim(), // strip a UTF-8 BOM
      complete: (res) => {
        setState({ kind: 'done', fileName: file.name, result: validateUpload(res.meta.fields ?? [], res.data) });
      },
      error: (e) => {
        setState({ kind: 'failed', fileName: file.name, message: e.message });
      },
    });
  };

  const result = state.kind === 'done' ? state.result : null;
  const canSubmit = result !== null && result.rows.length > 0 && result.errors.length === 0 && onSubmit !== undefined;

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby={titleId} onClose={onClose}>
      <header className={styles.head}>
        <h2 id={titleId} className={styles.title}>
          Upload a portfolio
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close upload dialog">
          ✕
        </button>
      </header>

      <div className={styles.body}>
        <p className={styles.privacy}>
          Your file stays on this device. It is read and enriched in your browser and never sent to a server.
        </p>

        <p className={styles.lead}>
          A CSV with one row per asset. Coverage is limited to the demo areas (York, Great Yarmouth, Westminster,
          Hammersmith and Fulham); other rows are flagged “not covered in demo”.{' '}
          <a className={styles.link} href={SAMPLE_URL} download="risklens_sample_portfolio.csv">
            Download the sample CSV
          </a>{' '}
          <span className={styles.muted}>(180 demo assets)</span>
        </p>

        <label
          className={`${styles.drop} ${dragging ? styles.dragging : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
        >
          <span className={styles.dropText}>Choose a CSV file or drop it here</span>
          <span className={styles.muted}>
            Up to {MAX_ROWS.toLocaleString('en-GB')} rows, 5 MB
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className={styles.file}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = '';
            }}
          />
        </label>

        <div aria-live="polite" className={styles.results}>
          {state.kind === 'parsing' && <p>Reading {state.fileName}…</p>}
          {state.kind === 'failed' && (
            <p className={styles.bad}>
              Could not read {state.fileName}: {state.message}
            </p>
          )}
          {state.kind === 'done' && result && (
            <>
              <p className={result.errors.length === 0 ? styles.good : styles.bad}>
                <strong>{state.fileName}</strong>: {result.totalRows} rows read · {result.rows.length} valid ·{' '}
                {result.errors.length} {result.errors.length === 1 ? 'problem' : 'problems'}
              </p>
              {result.warnings.map((w) => (
                <p key={w.message} className={styles.muted}>
                  {w.message}
                </p>
              ))}
              {result.errors.length > 0 && (
                <>
                  <p className={styles.muted}>Fix these in your file and choose it again.</p>
                  <div className={styles.errorsWrap}>
                    <table className={styles.errors}>
                      <thead>
                        <tr>
                          <th scope="col">Line</th>
                          <th scope="col">Column</th>
                          <th scope="col">Problem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.errors.slice(0, ERRORS_SHOWN).map((e, i) => (
                          <tr key={`${String(e.line)}-${e.column ?? ''}-${String(i)}`}>
                            <td>{e.line === 0 ? 'File' : e.line}</td>
                            <td>{e.column ?? '—'}</td>
                            <td>{e.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.errors.length > ERRORS_SHOWN && (
                    <p className={styles.muted}>…and {result.errors.length - ERRORS_SHOWN} more.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <details className={styles.format}>
          <summary className={styles.summary}>Column format</summary>
            <table className={styles.spec}>
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Required</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>asset_id</td>
                  <td>Yes</td>
                  <td>Your reference, unique per row</td>
                </tr>
                <tr>
                  <td>uprn</td>
                  <td>Preferred</td>
                  <td>Unique Property Reference Number, digits only</td>
                </tr>
                <tr>
                  <td>postcode</td>
                  <td>If no UPRN</td>
                  <td>UK postcode</td>
                </tr>
                <tr>
                  <td>use</td>
                  <td>Yes</td>
                  <td>residential or commercial</td>
                </tr>
                <tr>
                  <td>tenure</td>
                  <td>Yes</td>
                  <td>rented or owner_occupied (EPC rules apply to rented)</td>
                </tr>
                <tr>
                  <td>floor_area_m2</td>
                  <td>No</td>
                  <td>Overrides the EPC floor area</td>
                </tr>
                <tr>
                  <td>value_gbp</td>
                  <td>No</td>
                  <td>Overrides the house price index estimate</td>
                </tr>
              </tbody>
            </table>
        </details>
      </div>

      <footer className={styles.foot}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={!canSubmit}
          onClick={() => {
            if (canSubmit) onSubmit(result.rows);
          }}
        >
          Enrich {result && result.errors.length === 0 ? result.rows.length : ''} assets
        </button>
      </footer>
    </dialog>
  );
}

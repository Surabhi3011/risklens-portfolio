import { useEffect, useId, useRef } from 'react';
import { formatGbp } from '../lib/format';
import {
  deadlineText,
  epcAge,
  LIKELIHOOD_LABEL,
  MATCH_LABEL,
  RULE_STATUS_LABEL,
  ruleDescription,
  STATUS_LABEL,
  ZONE_LABEL,
} from '../lib/labels';
import { TIER_COLOUR, TIER_LABEL } from '../lib/tiers';
import type { PortfolioAsset, Recommendation, Rules } from '../types';
import styles from './AssetDrawer.module.css';

interface AssetDrawerProps {
  asset: PortfolioAsset;
  rules: Rules;
  onClose: () => void;
}

function costRange(r: Recommendation): string {
  if (r.cost_low === null || r.cost_high === null) return 'Cost not published';
  if (r.cost_low === r.cost_high) return formatGbp(r.cost_low);
  return `${formatGbp(r.cost_low)} – ${formatGbp(r.cost_high)}`;
}

export function AssetDrawer({ asset: a, rules, onClose }: AssetDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<Element | null>(null);

  // Move focus into the drawer when it opens or the asset changes; restore it when the drawer closes.
  useEffect(() => {
    returnFocus.current ??= document.activeElement;
    closeRef.current?.focus({ preventScroll: true });
  }, [a.asset_id]);
  useEffect(
    () => () => {
      const el = returnFocus.current;
      if (el instanceof HTMLElement && el.isConnected) el.focus({ preventScroll: true });
    },
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const rule = rules.rules.find((r) => r.id === a.compliance.failing_rule_id) ?? null;
  const age = epcAge(a.epc.lodgement_date, rules.as_of);

  return (
    <aside className={styles.drawer} role="dialog" aria-modal="false" aria-labelledby={titleId}>
      <header className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>
            {a.asset_id}
          </h2>
          <p className={styles.subtitle}>
            {a.la_name} · {a.use === 'residential' ? 'Residential' : 'Commercial'} ·{' '}
            {a.tenure === 'rented' ? 'Rented' : 'Owner-occupied'}
            {a.postcode ? ` · ${a.postcode}` : ''}
          </p>
        </div>
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close asset details">
          ✕
        </button>
      </header>

      <div className={styles.body}>
        <p className={styles.tier}>
          <span className={styles.dot} style={{ background: TIER_COLOUR[a.tier] }} aria-hidden="true" />
          <strong>{TIER_LABEL[a.tier]}</strong>
          <span className={styles.muted}>
            Score {a.scores.total} · compliance {a.scores.compliance} · flood {a.scores.flood} · data quality{' '}
            {a.scores.data_quality}
          </span>
        </p>

        <section className={styles.section} aria-labelledby={`${titleId}-epc`}>
          <h3 id={`${titleId}-epc`} className={styles.h3}>
            EPC
          </h3>
          <div className={styles.bands}>
            <div className={styles.band}>
              <span className={styles.bandLabel}>Current</span>
              <span className={styles.bandValue}>{a.epc.band_current ?? '—'}</span>
              {a.epc.score_current !== null && (
                <span className={styles.muted}>
                  {/* Non-domestic EPCs use an asset rating where lower is better; domestic use a 1-100+ SAP score. */}
                  {a.use === 'commercial' ? 'Asset rating' : 'SAP score'} {a.epc.score_current}
                </span>
              )}
            </div>
            <span className={styles.arrow} aria-hidden="true">
              →
            </span>
            <div className={styles.band}>
              <span className={styles.bandLabel}>Potential</span>
              <span className={styles.bandValue}>{a.epc.band_potential ?? '—'}</span>
              {a.epc.band_potential === null && (
                <span className={styles.muted}>{a.use === 'commercial' ? 'Not published (non-domestic)' : 'Not given'}</span>
              )}
            </div>
          </div>
          <dl className={styles.dl}>
            <dt>Lodged</dt>
            <dd>
              {a.epc.lodgement_date ?? 'No certificate'}
              {age && ` (${age} old)`}
              {a.epc.expired && <span className={styles.flag}>Expired</span>}
            </dd>
            <dt>Floor area</dt>
            <dd>{a.epc.floor_area_m2 === null ? '—' : `${String(Math.round(a.epc.floor_area_m2))} m²`}</dd>
            <dt>Data match</dt>
            <dd>{MATCH_LABEL[a.match_level]}</dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby={`${titleId}-comp`}>
          <h3 id={`${titleId}-comp`} className={styles.h3}>
            Compliance
          </h3>
          <p className={styles.status}>
            <strong>{STATUS_LABEL[a.compliance.status]}</strong> · {deadlineText(a, rules)}
          </p>
          {rule && (
            <p className={styles.rule}>
              {ruleDescription(rule)}
              <span className={styles.muted}>{RULE_STATUS_LABEL[rule.status]}</span>
              {rule.note && <span className={styles.muted}>{rule.note}</span>}
            </p>
          )}
          {a.compliance.status === 'no_epc' && a.tenure === 'rented' && (
            <p className={styles.rule}>A valid EPC is required to let this property.</p>
          )}
        </section>

        <section className={styles.section} aria-labelledby={`${titleId}-flood`}>
          <h3 id={`${titleId}-flood`} className={styles.h3}>
            Flood risk
          </h3>
          <dl className={styles.dl}>
            <dt>Rivers and sea</dt>
            <dd>{LIKELIHOOD_LABEL[a.flood.rofrs]}</dd>
            <dt>Flood zone</dt>
            <dd>{ZONE_LABEL[a.flood.zone]}</dd>
            <dt>Surface water</dt>
            <dd>{LIKELIHOOD_LABEL[a.flood.rofsw]}</dd>
          </dl>
        </section>

        <section className={styles.section} aria-labelledby={`${titleId}-recs`}>
          <h3 id={`${titleId}-recs`} className={styles.h3}>
            Top recommendations
          </h3>
          {a.recommendations.length === 0 ? (
            <p className={styles.muted}>No recommendations on the certificate.</p>
          ) : (
            <ol className={styles.recs}>
              {a.recommendations.map((r, i) => (
                <li key={`${String(i)}-${r.summary}`}>
                  <span>{r.summary}</span>
                  <span className={styles.cost}>{costRange(r)}</span>
                </li>
              ))}
            </ol>
          )}
          <p className={styles.total}>
            Indicative upgrade cost:{' '}
            <strong>{a.upgrade_cost_mid_gbp === null ? 'cost unknown' : formatGbp(a.upgrade_cost_mid_gbp)}</strong>
          </p>
        </section>

        <section className={styles.section} aria-labelledby={`${titleId}-val`}>
          <h3 id={`${titleId}-val`} className={styles.h3}>
            Value
          </h3>
          <p>
            {a.value_gbp === null ? (
              <span className={styles.muted}>Not valued (no open data source for this asset type)</span>
            ) : (
              <>
                {formatGbp(a.value_gbp)}{' '}
                <span className={styles.muted}>
                  {a.value_source === 'hpi' ? 'UK HPI average for the area, not a valuation' : 'Client-supplied'}
                </span>
              </>
            )}
          </p>
        </section>
      </div>
    </aside>
  );
}

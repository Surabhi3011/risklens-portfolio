import styles from './Footer.module.css';

// Text from ARCHITECTURE.md §7. Keep in sync with the PDF export (P3.3).
// TODO(attribution): ONSPD also carries Royal Mail / Gridlink / LPS IPR. Confirm the exact attribution wording
// from the ONSPD Aug 2026 user guide and add it here and in ARCHITECTURE.md §7 (see data/raw/MANIFEST.md).
export function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.disclaimer}>
        <strong>Indicative screening only.</strong> Not a valuation, flood risk assessment or legal advice. Data may be
        out of date for individual properties. Upgrade costs are indicative. The 2031 non-domestic EPC B requirement is
        announced, subject to legislation.
      </p>
      <p className={styles.attribution}>
        Contains public sector information licensed under the{' '}
        <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" rel="noreferrer">
          Open Government Licence v3.0
        </a>
        , including EPC data (MHCLG), Environment Agency flood data, UK House Price Index (HM Land Registry, ONS), ONS
        Postcode Directory and OS Open UPRN (© Crown copyright and database right). Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
          OpenStreetMap contributors
        </a>
        , tiles by{' '}
        <a href="https://openfreemap.org" rel="noreferrer">
          OpenFreeMap
        </a>
        .
      </p>
    </footer>
  );
}

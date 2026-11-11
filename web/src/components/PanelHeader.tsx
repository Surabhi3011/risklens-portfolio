import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import styles from './PanelHeader.module.css';

interface PanelHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Optional content on the right, e.g. a count. */
  aside?: ReactNode;
  id?: string;
}

/** Consistent title row for dashboard panels (icon is decorative; the title carries the meaning). */
export function PanelHeader({ icon: Icon, title, subtitle, aside, id }: PanelHeaderProps) {
  return (
    <div className={styles.head}>
      <span className={styles.icon} aria-hidden="true">
        <Icon size={16} strokeWidth={2} />
      </span>
      <div className={styles.titles}>
        <h2 className={styles.title} id={id}>
          {title}
        </h2>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {aside && <div className={styles.aside}>{aside}</div>}
    </div>
  );
}

import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import { LotStatusTransitionCandidateScreen } from './candidate-screen';

const t = messages.lotStatusTransition;

export const LotStatusTransitionScreen = () => (
  <div className="screen lot-status-transition-screen">
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <div className="lot-status-transition-workspace">
      <div className="lot-status-transition-notice-row">
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.historyNotice}</AlertBanner>
        </div>
        <Link className="lot-status-transition-history-link" to="/quality/lot-status">
          {t.historyLink}
        </Link>
      </div>
      <LotStatusTransitionCandidateScreen />
    </div>
  </div>
);

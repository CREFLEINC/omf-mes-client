import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { LotStatusTransitionCandidateScreen } from './candidate-screen';

const t = messages.lotStatusTransition;

export const LotStatusTransitionScreen = () => (
  <>
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <LotStatusTransitionCandidateScreen />
  </>
);

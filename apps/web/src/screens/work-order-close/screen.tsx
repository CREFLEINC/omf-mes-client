import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { WorkOrderCloseCandidateScreen } from './candidate-screen';

const t = messages.workOrderClose;

export const WorkOrderCloseScreen = () => (
  <>
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <WorkOrderCloseCandidateScreen />
  </>
);

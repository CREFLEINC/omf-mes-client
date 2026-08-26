import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { WorkOrderReleaseCandidateBrowser } from './work-order-release-candidate-browser';
import { WorkOrderReleaseExecution } from './work-order-release-execution';

const t = messages.workOrderRelease;

export const WorkOrderReleaseScreen = () => (
  <>
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <WorkOrderReleaseCandidateBrowser
      renderSelection={({ selectedWorkOrderId, clearSelection }) => (
        <WorkOrderReleaseExecution
          selectedWorkOrderId={selectedWorkOrderId}
          onClearSelection={clearSelection}
        />
      )}
    />
  </>
);

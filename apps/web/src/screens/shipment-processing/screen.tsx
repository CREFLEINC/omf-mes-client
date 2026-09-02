import { Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ShipmentProcessingCandidateScreen } from './candidate-screen';

const t = messages.shipmentProcessing;

/** W-04-04 출하 처리(상차·실물 출고) 진입점. */
export const ShipmentProcessingScreen = () => (
  <>
    <PageHeader
      title={t.title}
      breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
    />
    <ShipmentProcessingCandidateScreen />
  </>
);

import { EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.deviceRegistration;

export const DeviceRegistrationScreen = () => {
  return (
    <div>
      <h1>{t.title}</h1>
      <EmptyState title={t.unregistered.title} description={t.unregistered.description} />
      <p>{t.unregistered.where}</p>
    </div>
  );
};

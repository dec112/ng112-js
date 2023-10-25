import {
  AlertBuilder,
  Category,
  Certainty,
  InfoBuilder,
  MsgType,
  Scope,
  Severity,
  Status,
  Urgency,
} from '@dec112/cap-ts/builder';
import { CONTENT_TYPE } from 'ng112-js';

export const getCapMultipart = () => {
  const info = new InfoBuilder(
    // event
    'Fire in shopping mall',
    Urgency.immediate,
    Severity.extreme,
    Certainty.observed,
    [Category.fire],
  );

  const alert = new AlertBuilder(
    // alert ID
    'ca15f4ac-7ee9-4391-a9da-a75f1c3374dd',
    // sender ID
    'http://shopping.com/sensors/fire/386',
    new Date().toISOString(),
    Status.actual,
    MsgType.alert,
    Scope.restricted,
  );

  // add info to alert
  alert.info_list = [info];

  return {
    headers: [
      { key: CONTENT_TYPE, value: 'application/EmergencyCallData.cap+xml' }
    ],
    body: alert.build().toXML(),
  };
}
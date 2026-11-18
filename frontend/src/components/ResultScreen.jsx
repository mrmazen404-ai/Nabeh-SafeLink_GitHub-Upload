import UrlResultScreen from './UrlResultScreen';
import SmsResultScreen from './SmsResultScreen';

/**
 * ResultScreen Dispatcher
 * Seamlessly routes between UrlResultScreen and SmsResultScreen
 * based on scan kind / input type without impacting any API, service, or state.
 */
export default function ResultScreen(props) {
  const result = props.result;
  const url = result?.input_value || '';
  const inputType = result?.input_type || result?.scan_kind;

  const isTextScan =
    inputType === 'TEXT' ||
    inputType === 'SMS_TEXT' ||
    (url && !url.startsWith('http://') && !url.startsWith('https://') && url.includes(' '));

  if (isTextScan) {
    return <SmsResultScreen {...props} />;
  }

  return <UrlResultScreen {...props} />;
}

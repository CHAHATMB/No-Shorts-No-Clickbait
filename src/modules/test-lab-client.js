export const TEST_COMMAND_TIMEOUT_MS = 5000;
export const TEST_PROTOCOL_VERSION = 1;

export async function getTestTarget(api) {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  let url;
  try {
    url = new URL(tab?.url);
  } catch {
    return { tab, supported: false, youtube: false, hostname: 'No web page selected' };
  }
  const supported = ['http:', 'https:'].includes(url.protocol);
  return {
    tab,
    supported,
    youtube: supported && (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')),
    hostname: url.hostname || url.protocol,
  };
}

export async function sendTestCommand(api, message, tabId) {
  let timer;
  try {
    const request = tabId === undefined ? api.runtime.sendMessage(message) : api.tabs.sendMessage(tabId, message);
    const response = await Promise.race([
      request,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timed out. Check the current state before retrying.')), TEST_COMMAND_TIMEOUT_MS);
      }),
    ]);
    if (typeof response?.ok !== 'boolean') {
      throw new Error('The receiver did not acknowledge this command.');
    }
    const probe = ['testPageStatus', 'testYouTubeStatus'].includes(message.action);
    if (probe ? response.protocolVersion !== TEST_PROTOCOL_VERSION : typeof response.message !== 'string') {
      throw new Error('The page or extension is running an older Test Lab receiver.');
    }
    return response;
  } catch (error) {
    const recovery = tabId === undefined
      ? 'Reload the development extension and reopen this popup.'
      : 'Refresh the target page after loading a development build. Restricted browser pages cannot run previews.';
    throw new Error(`${error.message} ${recovery}`);
  } finally {
    clearTimeout(timer);
  }
}

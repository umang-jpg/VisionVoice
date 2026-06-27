/**
 * Local voice command matching for app navigation.
 * Returns { screen, speech } or null.
 */
export function matchAppNavigationCommand(cleanText) {
  if (!cleanText) return null;

  if (cleanText === 'settings' || cleanText === 'open settings') {
    return { screen: 'Settings', speech: 'Opening settings' };
  }

  if (cleanText === 'camera' || cleanText === 'camera mode' || cleanText === 'open camera') {
    return { screen: 'Camera', speech: 'Opening camera' };
  }

  if (cleanText === 'home' || cleanText === 'assistant' || cleanText === 'open assistant') {
    return { screen: 'Assistant', speech: 'Opening assistant' };
  }

  const navigationPhrases = [
    'navigation',
    'maps',
    'directions',
    'go to navigation',
    'open navigation',
    'open maps',
    'navigation screen',
    'map mode',
    'turn on navigation',
  ];

  if (navigationPhrases.some((phrase) => cleanText === phrase || cleanText.includes(phrase))) {
    return { screen: 'Navigation', speech: 'Opening navigation' };
  }

  const memoryPhrases = [
    'memory',
    'memory mode',
    'memory log',
    'open memory',
  ];

  if (memoryPhrases.some((phrase) => cleanText === phrase || cleanText.includes(phrase))) {
    return { screen: 'Memory', speech: 'Opening memory log' };
  }

  const learnPhrases = [
    'learn',
    'learn mode',
    'learning',
    'open learn',
    'study mode',
  ];

  if (learnPhrases.some((phrase) => cleanText === phrase || cleanText.includes(phrase))) {
    return { screen: 'Learn', speech: 'Opening learn screen' };
  }

  return null;
}

export function matchCameraModeCommand(cleanText) {
  if (!cleanText) return null;
  const describePhrases = ['scene mode', 'describe mode', 'scene', 'describe'];
  const readPhrases = ['text mode', 'read mode', 'text', 'reading mode'];
  const identifyPhrases = ['object mode', 'identify mode', 'object', 'identify'];
  const currencyPhrases = ['money mode', 'currency mode', 'money', 'currency'];

  if (describePhrases.some(p => cleanText === p || cleanText.includes(p))) {
    return { modeKey: 'describe' };
  }
  if (readPhrases.some(p => cleanText === p || cleanText.includes(p))) {
    return { modeKey: 'read' };
  }
  if (identifyPhrases.some(p => cleanText === p || cleanText.includes(p))) {
    return { modeKey: 'identify' };
  }
  if (currencyPhrases.some(p => cleanText === p || cleanText.includes(p))) {
    return { modeKey: 'currency' };
  }
  return null;
}

export function matchCaptureCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = [
    'capture',
    'take picture',
    'take photo',
    'click photo',
    'click picture',
    'click a photo',
    'click a picture',
    'take a photo',
    'take a picture',
    'shoot',
    'shoot photo',
    'snap',
    'snap photo',
    'analyze',
    'scan',
    'read this',
    'describe this',
    'what is this',
    'identify this',
  ];
  return phrases.some(p => cleanText === p || cleanText.includes(p));
}

export function matchClearConversationCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = ['clear conversation', 'clear chat', 'new conversation', 'start over'];
  return phrases.some(p => cleanText === p || cleanText.includes(p));
}

export function matchCancelNavigationCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = ['cancel navigation', 'stop navigation', 'cancel route', 'end navigation'];
  return phrases.some(p => cleanText === p || cleanText.includes(p));
}

export function matchBrailleExportCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = [
    // Original phrases
    'export braille',
    'convert to braille',
    'braille export',
    'save as braille',
    'braille file',
    // New requested variants
    'convert to braille code',
    'convert note to braille code',
    'convert note',
    'braille conversion',
    'send to braille',
  ];
  return phrases.some((p) => cleanText === p || cleanText.includes(p));
}

/**
 * Matches commands to open search/view mode on the Learn screen.
 */
export function matchLearnSearchCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = [
    'search notes',
    'view notes',
    'see notes',
    'read notes',
    'show notes',
    'find notes',
    'look up notes',
    'browse notes',
  ];
  return phrases.some(p => cleanText === p || cleanText.includes(p));
}

/**
 * Matches commands to open record mode on the Learn screen.
 */
export function matchLearnRecordCommand(cleanText) {
  if (!cleanText) return false;
  const phrases = [
    'record a note',
    'record note',
    'new note',
    'make a note',
    'make note',
    'add a note',
    'add note',
    'take a note',
    'take note',
    'start note',
    'create note',
    'voice note',
  ];
  return phrases.some(p => cleanText === p || cleanText.includes(p));
}

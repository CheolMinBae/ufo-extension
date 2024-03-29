import getRelativeSelector, { getFullSelector } from './getSelector';
import { CssSelector, ParroteerId, ElementState, MutationEvent, RecordingState } from '../../types/Events';
import { v4 as uuidv4 } from 'uuid';

let recordingState: RecordingState = 'off';
const elementStates: { [key: ParroteerId ]: ElementState } = {};

/**
 * Stops element monitoring event listeners
 */
export function stopEventListeners() {
  const iframeWrapper: HTMLIFrameElement = document.getElementById('universe_iframe') as HTMLIFrameElement;
  console.log(iframeWrapper);
  if (iframeWrapper && iframeWrapper.contentDocument) {
    (iframeWrapper.contentDocument as Document).removeEventListener('click', clickListener, { capture: true });
    (iframeWrapper.contentDocument as Document).removeEventListener('keydown', keydownListener, { capture: true });
  }
}

/**
 * Starts element monitoring event listeners
 */
export function startEventListeners(state: RecordingState) {
  // Remove old event listeners in case any are already there
  // stopEventListeners();

  recordingState = state;
  console.log('Starting event listeners with recording state:', recordingState);
  const iframeWrapper: HTMLIFrameElement = document.getElementById('universe_iframe') as HTMLIFrameElement;
  console.log(iframeWrapper);
  if (iframeWrapper) {
    // iframeWrapper.contentWindow?.document.addEventListener('click' , clickListener, {capture: true});
    iframeWrapper.contentWindow?.postMessage("init", '*')
    // window.addEventListener('click', clickListener, {capture: true});

    // iframeWrapper.addEventListener('click', clickListener, {capture: true});
    // iframeWrapper.onkeydown = (e) => (keydownListener(e));
  } else {
    console.log('iframeWrapper not found');
  }
}

/**
 * Gets the selector of the target element, then sends a message to the background with the
 * event details and details on any element changes that occurred.
 *
 * If `recordingState` is 'pre-recording', prevents the event from going to any elements
 * or triggering default behavior.
 */
function clickListener(event: MouseEvent) {
  // console.log(event.isTrusted)
  // TODO: Check event.isTrusted or whatever to see if event was created by user
  if (event.isTrusted) {
    console.log('on clickListener');
    console.log(event);
    const target = event.target as HTMLElement;

    if (recordingState === 'pre-recording') {
      // If picking elements and the element already has a parroteer ID, do nothing
      if ('parroteerId' in target.dataset) return;

      event.stopPropagation();
      event.preventDefault();
    }

    const selector = getRelativeSelector(target);
    const displaySelector = getFullSelector(target);
    console.log('Element clicked:', selector);
    console.log('Element state', elementStates);
    const mutations = diffElementStates();

    chrome.runtime.sendMessage({
      type: 'event-triggered',
      payload: {
        event: {
          type: 'input',
          selector,
          displaySelector,
          eventType: event.type,
          timestamp: Date.now(),
          parroteerId: target.dataset.parroteerId
        },
        prevMutations: mutations
      }
    });
  }
}

function keydownListener(event: KeyboardEvent) {
  console.log('keydown event occurred', event);
  const target = event.target as HTMLElement;
  const key = event.key;
  const shift = event.shiftKey;
  const code = event.code;

  const selector = getRelativeSelector(target);
  const displaySelector = getFullSelector(target);
  // OTHER: alt, shift, control keys also pressed?
  // const ctrlKey = event.ctrlKey;
  const mutations = diffElementStates();

  chrome.runtime.sendMessage({
    type: 'event-triggered',
    payload: {
      event: {
        type: 'input',
        key,
        shift,
        code,
        selector,
        displaySelector,
        eventType: event.type,
        timestamp: event.timeStamp,
        parroteerId: target.dataset.parroteerId
      },
      prevMutations: mutations
    }
  });
}


/**
 * Tracks an element based on the provided selector and watches it for changes
 */
export function watchElement(selector: CssSelector) {
  const parroteerId = assignParroteerId(selector);
  elementStates[parroteerId] = getCurrState(parroteerId);
  return {
    state: elementStates[parroteerId],
    parroteerId
  };
}

/**
 * Finds an element in the DOM and assigns it a unique "data-parroteer-id" property
 */
export function assignParroteerId (selector: CssSelector) {
  const element = document.querySelector(selector) as HTMLElement;
  const uuid = uuidv4();
  element.dataset.parroteerId = uuid;
  return uuid;
}

/**
 * Finds an element by parroteerId
 */
function findElementByPId (parroteerId: ParroteerId) {
  const selector = `[data-parroteer-id="${parroteerId}"]`;
  const el: HTMLElement | HTMLInputElement = document.querySelector(selector) as HTMLElement | HTMLInputElement;
  return el;
}

/**
 * Gets the current state of an element by its CSS selector
 */
export function getCurrState(parroteerId: ParroteerId): ElementState {
  const el = findElementByPId(parroteerId);
  return {
    class: el.classList?.value,
    textContent: el.innerText,
    value: 'value' in el ? el.value : undefined
  };
}

/**
 * Determines if/what changes have occurred with any watched elements between
 * their current state and previously tracked state
 */
export function diffElementStates() {
  const changedStates: MutationEvent[] = [];

  for (const parroteerId in elementStates) {
    const prevState = elementStates[parroteerId];
    const currState = {
      ...prevState,
      ...getCurrState(parroteerId)
    };

    // Determine and store element changes
    const elChanges = diffState(prevState, currState);
    if (elChanges) {
      console.log(`Watched element "${parroteerId}" changed state. New properties:`, elChanges);
      const el = findElementByPId(parroteerId);
      changedStates.push({
        type: 'mutation',
        displaySelector: getFullSelector(el),
        selector: getRelativeSelector(el) as string,
        parroteerId,
        ...elChanges
      });
    }

    // TODO? Show whether stuff was added or removed?
    elementStates[parroteerId] = currState;
  }

  return changedStates;
}

/**
 * Determines the difference in state for an element at 2 different points in time
 */
function diffState(prev: ElementState, curr: ElementState): Partial<ElementState> | null {
  let differences: Partial<ElementState> | null = null;
  // For every property in the previous state,
  // check to see if it is different from the same property in the current state
  for (const _key in prev) {
    const key = _key as keyof ElementState;
    if (prev[key] !== curr[key]) {
      if (!differences) differences = {};
      differences[key] = curr[key];
    }
  }
  return differences;
}
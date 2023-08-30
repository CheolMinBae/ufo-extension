console.log('Logging from content script');
// This script has access to the DOM

import * as listeners from "../modules/eventListeners";
import { diffElementStates } from "../modules/eventListeners";
import observer, { targetNode, config } from "../modules/mutationObserver";
import { enableHighlight, disableHighlight } from "../modules/elementPicker";
import { RuntimeMessage } from "../../types/Runtime";
import { ElementState, ParroteerId, RecordingState } from "../../types/Events";

console.log("Running content script (see chrome devtools)");

// Listen for messages from background script
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    switch (message.type) {
      case "add-listeners": {
        // console.log("in add-listeners");
        const { idsToClear, recordingState } = message.payload as {
          idsToClear: string[];
          recordingState: RecordingState;
        };
        listeners.startEventListeners(recordingState);
        // if (recordingState === "pre-recording") enableHighlight();
        // else {
        //   disableHighlight();
        //   if (recordingState === "off") listeners.stopEventListeners();
        // }
        // if (idsToClear) {
        //   idsToClear.forEach((id: ParroteerId) => {
        //     const el = document.querySelector(`[data-parroteer-id="${id}"]`);
        //     if (!(el instanceof HTMLElement)) return;
        //     delete el.dataset.parroteerID;
        //   });
        // }
        break;
      }
      case "get-element-states": {
        // Iterate over all selectures in payload
        // Look up those elements in the DOM and get their state
        const payload = message.payload as string[];
        const elementStates: { [key: ParroteerId]: ElementState } = {};
        for (const parroterId of payload) {
          elementStates[parroterId] = listeners.getCurrState(parroterId);
        }

        // Send those states back to the background
        sendResponse(elementStates);
        break;
      }
      case "watch-element": {
        const selector = message.payload as string;
        const elInfo = listeners.watchElement(selector);
        sendResponse(elInfo);
        break;
      }
      case "final-diff": {
        sendResponse(diffElementStates());
      }
    }
  }
);

const init = () => {    
    const article = document.querySelector('#article > .buttons');
    console.log(article);
    if (article) {
        const button = document.createElement('button');
        button.classList.add('record-button');
        button.textContent="녹화 on";
        button.onclick=() => {
            console.log('begin recording button')
            const devTools: any = chrome.devtools
            console.log(devTools)
            chrome.runtime.sendMessage({ type: "begin-recording" });
        }
        setTimeout(() => {
            article.appendChild(button);
        }, 1000)

        chrome.runtime.sendMessage({ type: "popup-opened" }).then((res) => {
            console.log(res);
        });
        chrome.runtime.onMessage.addListener((message) => {
          console.log(message);
        });

        window.addEventListener('message', event => {
            console.log(event);
        })
    }
}
console.log('contents load');
// window.addEventListener('locationchange', () => {
//     console.log(location.href)
//     console.log('before init')
// });
// window.addEventListener('popstate', function (event) {
// 	// The URL changed...
//   console.log('in popstate')
// });
const observeUrlChange = () => {
  let oldHref = document.location.href;
  const body = document.querySelector("body") as HTMLBodyElement;
  const observer = new MutationObserver(mutations => {
    if (oldHref !== document.location.href) {
      oldHref = document.location.href;
      /* Changed ! your code here */
      console.log('in changed');
      init();
    }
  });
  observer.observe(body, { childList: true, subtree: true });
};

window.addEventListener('load', function(){
  //실행될 코드
  console.log('on load')
  observeUrlChange()
});

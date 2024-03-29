class TestingLibraryTranslator {
    //pass in an options object which can take new languages
    constructor(options) {
        // set default values for the keycodes class
        const defaults = {
            //internal defaults
            replayTestUrl: '',
            replayTestID: 0,
            //need a keycode dictionary
            keyCodeDictionary: new KeyCodeDictionary(),
            //messaging for code
            standardOpeningComment: '\n\tconst container = render(<Component />); \n',
            standardRecordingComment:
                '/*\n' +
                '\t This is Testing Library code generated by Record/Replay from a RECORDING. \n' +
                '\t As such it only contains ACTIONS, not ASSERTIONS.\n' +
                '\t If you want to have code with assertions included, you need to generate a replay of this recording and download the replay code.\n' +
                '*/\n\n',
            standardPackageComment:
                '/*\n' +
                '\t To make Testing Library code compatible with Record/Replay, which uses CSS selectors, define container as rendered component.\n' +
                '\t This code uses @testing-library/user-event to process recorded events, unless there is an open issue on the event in the repo. \n' +
                '*/\n',
            packages:
                '\n' +
                "import { render } from '@testing-library/react';\n" +
                "import userEvent from '@testing-library/user-event;'\n\n",
        };
        // create a new object with the defaults over-ridden by the options passed in
        let opts = Object.assign({}, defaults, options);

        // assign options to instance data (using only property names contained in defaults object to avoid copying properties we don't want)
        Object.keys(defaults).forEach((prop) => {
            this[prop] = opts[prop];
        });
    }

    //FORMATTING
    openTestingLibaryTest = (replayOrRecording) => `describe('${replayOrRecording.recordingTestName}', function () {\n`;

    openTestingLibaryReplay = (replay) => `\n\tit('${replay.replayName}', function () {\n`;

    openTestingLibaryRecording = (recording) => `\n\tit('${recording.recordingName}', function () {\n`;

    renderComponent = (recording) => `\n\t\tconst container = render(<Component />);\n`;

    warnOnIframe = (href) =>
        `\n\t\t// THIS ACTION MUST BE EXECUTED IN CONTEXT OF IFRAME WITH ORIGIN: ${new URL(href).origin}`;

    //Cypress tests have an extra tab for formatting as everything takes place in a describe AND an it function
    tabIndex = (index) => {
        switch (index) {
            //for one extra tab, we use -1
            case -1:
                return '\n\t\t\t';
            //for two extra tabs we use -2
            case -2:
                return '\n\t\t\t\t';
            //for any element above zero, we use normal tabbing
            default:
                return '\n\t\t';
        }
    };

    closeTestingLibaryReplay = () => `\n\t});\n`;

    closeTestingLibaryRecording = () => `\n\t});\n`;

    closeTestingLibaryTest = () => `\n});`;

    //in Testing Library, The modifier(s) remain activated for the duration of the .type() command, and are released when all subsequent characters are typed,
    mapDispatchKeyEventModifer = (modifier) => {
        switch (modifier) {
            case 1:
                return '{alt}';
            case 2:
                return '{ctrl}';
            case 4:
                return '{meta}';
            case 8:
                return '{shift}';
            default:
                return '';
        }
    };

    //IFRAME WARNING
    warnOnIframe = (href) =>
        `\n\t\t// THIS ACTION MUST BE EXECUTED IN CONTEXT OF IFRAME WITH ORIGIN: ${new URL(href).origin}`;

    //SELECTOR HELPER

    getMostValidSelector = (recordingEvent) => {
        //if we have run the replay, we will get a report on the selector that was chosen
        if (recordingEvent.replayChosenSelectorString && recordingEvent.replayChosenSelectorString.length > 0) {
            return `container.querySelector('${recordingEvent.replayChosenSelectorString}')`;
        }
        //if we have run the assertion, we will get a report on the selector that was chosen
        if (recordingEvent.assertionChosenSelectorString && recordingEvent.assertionChosenSelectorString.length > 0) {
            return `container.querySelector('${recordingEvent.assertionChosenSelectorString}')`;
        }
        //otherwise collect all the existing selectors into an array, filter and return the first valid one
        const selected =
            [
                recordingEvent.recordingEventCssSelectorPath,
                recordingEvent.recordingEventCssFinderPath,
                recordingEvent.recordingEventCssDomPath,
            ]
                //when we filter we need to know what the selectors return when they fail
                .filter(Boolean)[0] || '';
        return `container.querySelector('${selected}')`;
    };

    //ACTIONS

    mouseClick = (selector, clicktype) => {
        switch (clicktype) {
            case 'click':
                return `userEvent.click(${selector});`;
            case 'dblclick':
                return `userEvent.dblClick(${selector});`;
            case 'contextmenu':
                return `const rightClick = { button: 2 }; fireEvent.click(${selector}, rightClick);`;
            default:
                return `${this.tabIndex(index)}//No Click Action Available For Action ${clicktype}`;
        }
    };

    recaptcha = (selector) => `userEvent.click(${selector});`;

    //we need a parser for the different kinds of input
    inputParser = (selector, recordingEvent) => {
        //first we need to get the value we need to input
        const value = recordingEvent.recordingEventInputValue;
        //then we need a shorthand for the input type
        const inputType = recordingEvent.recordingEventInputType;
        //then we need to work differently for different kinds of inputs
        switch (true) {
            //if we are talking about a text area element, then we know what we are doing
            case recordingEvent.recordingEventHTMLElement == 'HTMLTextAreaElement':
                //first we have to focus on the element and then we have to type the value
                return `userEvent.type(${selector}, '${value}');`;
            //if we are dealing with an input element, things are a bit more complex
            case recordingEvent.recordingEventHTMLElement == 'HTMLInputElement':
                //then we need to have a detailed method of dealing with the various types of input
                switch (inputType) {
                    //then we need to handle every single input type, starting with those we can handle with a single click
                    case 'checkbox' || 'radio' || 'button' || 'submit' || 'reset':
                        //a simple click will work for the radio buttons and checkboxes
                        return `userEvent.click(${selector});`;
                    //certain types of text input can all be handled in the same way
                    case 'text' || 'password' || 'url' || 'email' || 'number' || 'search' || 'tel':
                        //first we have to focus on the element and then we have to type the value
                        return `userEvent.clear(${selector}).type(${selector}, '${value}');`;
                    //then there are special HTML5 inputs that we need to shortcut
                    default:
                        //The <input type="color"> is used for input fields that should contain a color
                        //The <input type="time"> allows the user to select a time (no time zone).
                        //The <input type="date"> is used for input fields that should contain a date.
                        //The <input type="week"> allows the user to select a week and year.
                        //The <input type="month"> allows the user to select a month and year.
                        //The <input type="range"> defines a control for entering a number whose exact value is not important (like a slider control).
                        //FOR ALL THE ABOVE WE SHORTCUT
                        return `fireEvent.change(${selector}, { target: { value: '${value}' } });`;
                }
            //if we are dealing with an select element, puppeteer offers us a nice handler
            case recordingEvent.recordingEventHTMLElement == 'HTMLSelectElement':
                return `userEvent.selectOptions(${selector}, '${value}')`;
            //if we are dealing with a standard HTMLElement with the contenteditable property, then we need to to something slightly different
            case recordingEvent.recordingEventInputType == 'contentEditable':
                //with the content editable, we can't just type in as we have a final text result on blur, so we need to adjust the text directly
                return `// Testing Library does not currently support input in contenteditable html elements in tests`;
            //then we have a default for when we have no clue
            default:
                return `fireEvent.change(${selector}, { target: { value: '${value}' } });`;
        }
    };

    nonInputTyping = (selector, replayEvent) => {
        //so there is some complexity in handling the different types of non input typing
        //first we need to know if the typing event contains characters or not
        const dictionaryEntry = this.keyCodeDictionary[
            replayEvent.recordingEventDispatchKeyEvent.windowsVirtualKeyCode
        ];
        //then we need to warn that tabbing does not work in Cypress
        if (dictionaryEntry.descriptor == 'Tab') {
            return `userEvent.tab();`;
        }
        //then we need to warn if we do not have a Testing Library descriptor for a null value key
        if (dictionaryEntry.value == null && !dictionaryEntry.hasOwnProperty('testingLibraryDescriptor')) {
            return `// Testing Library does not currently support the use of ${dictionaryEntry.descriptor} key in tests`;
        }

        //then we want to know if there are any modifier keys pressed at the time
        const modifiers = this.mapDispatchKeyEventModifer(replayEvent.recordingEventDispatchKeyEvent.modifiers);
        //then we want know if there is any text attached to the keyboard event
        const text = replayEvent.recordingEventDispatchKeyEvent.text;

        //if the dictionary entry has a value of null, we need to send the Testing Library special character sequences, if it exists, with modifiers
        if (dictionaryEntry.value == null) {
            //how we execute this depends on whether the typing was done on an element or the main document
            if (replayEvent.recordingEventHTMLTag == 'HTML') {
                //Testing library should default to the container if there is no item in focus
                return `userEvent.type(container, '${modifiers}${dictionaryEntry.testingLibraryDescriptor}');`;
            } else {
                //otherwise we use the main selector
                return `userEvent.type(${selector}, '${modifiers}${dictionaryEntry.testingLibraryDescriptor}');`;
            }
        } else {
            //how we execute this depends on whether the typing was done on an element or the main document
            if (replayEvent.recordingEventHTMLTag == 'HTML') {
                //Cypress demands that the main document typing occurs on the body
                return `userEvent.type(container, '${modifiers}${text}');`;
            } else {
                //otherwise we use the main selector
                return `userEvent.type(${selector}, '${modifiers}${text}');`;
            }
        }
    };

    scrollTo = (xPosition, yPosition) => `// PAGE SCROLL event not supported in Testing Library`;

    elementScrollTo = (selector, xPosition, yPosition) => `// ELEMENT SCROLL event not supported in Testing Library`;

    focus = (selector) => `${selector}.focus();`;

    hover = (selector) => `userEvent.hover(${selector})`;

    textSelect = (selector) => `userEvent.type(${selector}, '{selectall}');`;

    //ASSERTIONS HELPERS, we need to have the index of each item in the Rx.js flow so we can have unique assertions

    getElementText = (selector, target) => `getNodeText(${selector});`;

    getVisibleElement = (selector, target) => `await waitFor(() => { expect(${selector}).toBeVisible(); });`;

    querySelector = (selector) => `${selector}`;

    getElementAttribute = (selector, attribute, target) => `${selector}['${attribute}'];`;

    getElementAttributeValue = (selector, attribute, target) => `${selector}.getAttribute('${attribute}');`;

    getElementAttributesAsArray = (selector, target) => `Array.prototype.slice.call(${selector}.attributes);`;

    //ACTION PARSER

    mapActionTypeToFunction = (replayOrRecordingEvent, index) => {
        //then we need to create an array that we can push our strings into then join them at the end
        let outputStringArray = [];
        //then we need to accommodate replay events and assertion events
        const action = replayOrRecordingEvent.assertionEventAction || replayOrRecordingEvent.recordingEventAction;

        //then we need to determine the type of recording event action so we can deliver the right piece of code to the text area
        switch (action) {
            //mouse actions can have many variants so we need a subswitch
            case 'Mouse':
                //here we switch on type of action
                switch (replayOrRecordingEvent.recordingEventActionType) {
                    case 'hover':
                        //in the case of hover, we get the most valid selector and then push the string result of the hover selctor into the array
                        outputStringArray.push(this.hover(this.getMostValidSelector(replayOrRecordingEvent)));
                        break;
                    case 'recaptcha':
                        //recaptcha is different in recording terms as the event we listen to is not the event we replay - click to replay
                        outputStringArray.push(this.recaptcha(this.getMostValidSelector(replayOrRecordingEvent)));
                        break;
                    default:
                        //then we have the default, which handles all the standard clicks, including 'click', 'dblclick' and 'contextmenu'
                        outputStringArray.push(
                            this.mouseClick(
                                this.getMostValidSelector(replayOrRecordingEvent),
                                replayOrRecordingEvent.recordingEventActionType
                            )
                        );
                }
                break;
            case 'Scroll':
                outputStringArray.push(
                    this.scrollTo(
                        replayOrRecordingEvent.recordingEventXPosition,
                        replayOrRecordingEvent.recordingEventYPosition
                    )
                );
                break;
            case 'ElementScroll':
                outputStringArray.push(
                    this.elementScrollTo(
                        this.getMostValidSelector(replayOrRecordingEvent),
                        replayOrRecordingEvent.recordingEventXPosition,
                        replayOrRecordingEvent.recordingEventYPosition
                    )
                );
                break;
            case 'TextSelect':
                outputStringArray.push(this.textSelect(this.getMostValidSelector(replayOrRecordingEvent)));
                break;
            case 'Keyboard':
                outputStringArray.push(
                    this.nonInputTyping(this.getMostValidSelector(replayOrRecordingEvent), replayOrRecordingEvent)
                );
                break;
            case 'Input':
                outputStringArray.push(
                    this.inputParser(this.getMostValidSelector(replayOrRecordingEvent), replayOrRecordingEvent)
                );
                break;
            case 'Page':
                //here we just do a simple return with the standard tabbing
                return `${this.tabIndex(0)}// Page navigated to ${replayOrRecordingEvent.recordingEventLocationHref}`;
            default:
                console.log(`No Mapping for Action Type ${replayOrRecordingEvent.recordingEventAction}`);
                //here we do a simple return with the indented tabbing so it falls in the same place as the action
                return `${this.tabIndex(index)}//No Mapping Type in Testing Library for Action ${
                    replayOrRecordingEvent.recordingEventAction
                }`;
        }

        //then if we reach this point we need to mao the string array, with a tabbing element for formatting
        outputStringArray = outputStringArray.map((string) => `${this.tabIndex(index)}${string}`);
        //then we need to return the string
        return outputStringArray.join('');
    };

    //BUILD OUTPUT STRINGS

    buildRecordingStringFromEvents = (recording) => {
        return new Promise((resolve) => {
            //start with an empty string
            var outputString = '';
            //add the standard opening
            outputString = outputString += this.standardRecordingComment;
            //add the standard package comment
            outputString = outputString += this.standardPackageComment;
            //add the packages
            outputString = outputString += this.packages;
            //add the standard Testing Library opening function
            outputString += this.openTestingLibaryTest(recording);
            //add the standard opening
            outputString += this.openTestingLibaryRecording(recording);
            //make sure we render component
            outputString += this.renderComponent();
            //then loop through events
            const eventsArray = recording.recordingEventArray;
            //then we loop through the array
            for (let event in eventsArray) {
                //then add the iframe warning if required
                eventsArray[event].recordingEventIsIframe
                    ? (outputString += this.warnOnIframe(eventsArray[event].recordingEventLocationHref))
                    : null;
                //then add the string using the action mapped to function
                outputString += `${this.mapActionTypeToFunction(eventsArray[event], event)}\n`;
            }

            //add the close page function
            outputString += this.closeTestingLibaryRecording();
            //add the standard async closing function
            outputString += this.closeTestingLibaryTest();
            //return the string
            resolve(outputString);
        });
    };
}

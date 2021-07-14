
import { 
    debounce,
    FunctionBatch
} from './util.js';

export {
    createOptionsMenu,
    OptionsManager
};

//Render Toggles
// /**
//  * @type {Array<any>}
//  */
// var options;
/**
 * @type {Array<HTMLElement>}
 */
var optionsElements;

//==============
// User Options
//==============
class Option {
    constructor(name, key) {
        this.name = name;
        this.key = key;
    }
}
class OptionsManager {
    /**
     * 
     * @param {string} storageKey 
     * @param {FunctionBatch} globalChangeHandlers 
     */
    constructor(storageKey, globalChangeHandlers=new FunctionBatch()) {
        this.storageKey = storageKey;
        this.storedOptions = this.getStoredOptions();

        this.globalChangeHandlers = globalChangeHandlers;

        this.currentOptions = {};
        this.defaultOptions = {};
        /**
         * An object containing functions that should be executed whenever certain 
         * options are changed, mapped by option key.
         */
        this.optionChangeHandlers = {};
        this.optionsArr = [];

        this.storeDisplayOptions = debounce(
            () => { window.localStorage.setItem(this.storageKey, JSON.stringify(this.currentOptions)); },
            1000
        );
    }

    /**
     * Registers an {@link Option}. Chainable.
     * @param {Option} option the option to register 
     * @returns {OptionsManager} this
     */
    register(key, displayName, defaultValue, changeHandler) {
        if (this.storedOptions[key] !== undefined) {
            this.currentOptions[key] = this.storedOptions[key];
        } else {
            this.currentOptions[key] = defaultValue;
            this.storeDisplayOptions();
        }
         
        this.defaultOptions[key] = defaultValue;
        this.optionChangeHandlers[key] = changeHandler;
        this.optionsArr.push(new Option(displayName, key));
        return this;
    }

    /**
     * Loads the display options from the client's LocalStorage,// falling back to 
     * //DEFAULT_OPTIONS if necessary.
     * 
     * //(Re)Stores all options once loaded.
     * 
     * //Calls all OPTIONS_CHANGED_HANDLES once loaded.  
     */
    getStoredOptions() {
        let storedOpts = JSON.parse(window.localStorage.getItem(this.storageKey));
        if (!storedOpts) {
            storedOpts = {};
        }
        return storedOpts;
    }
    /**
     * Option setter function, to be used when a user changes an options from the
     * options menu.
     * 
     * @param {string} optionKey 
     * @param {} value 
     */
    setOption(optionKey, value) {
        this.currentOptions[optionKey] = value;
        if (this.optionChangeHandlers[optionKey])
            this.optionChangeHandlers[optionKey]();
        this.storeDisplayOptions();
        this.globalChangeHandlers.runAll();

        let input = optionsElements[optionKey].input;
        if (input.type === "checkbox") {
            input.checked = value;
        } else if (input.type === "number") {
            input.value = value;
        }
        return value;
    }
    /**
     * Resets the specified option to its defualt value. Should be used when a 
     * user resets an options from the options menu.
     * 
     * @param {optionKey}
     */
    resetOption(optionKey) {
        this.setOption(optionKey, this.defaultOptions[optionKey]);
    }
    /**
     * Calls {@link resetOption} on every option.
     */
    resetAllOptions() {
        for (const key of Object.keys(this.currentOptions)) {
            this.resetOption(key);
        }
    }
    
}


/**
 * Builds the DOM element for the options menu
 * @param {OptionsManager} optsMgr 
 */
function createOptionsMenu(optsMgr) {
    const createToggleSwitch = (checked, optionKey) => {
        // Create Element
        const toggleContainer = document.createElement('label');
        toggleContainer.classList.add('switch');
        const input = toggleContainer.appendChild(document.createElement('input'));
        input.type = 'checkbox';
        const slider = toggleContainer.appendChild(document.createElement('span'));
        slider.classList.add('slider');
        slider.classList.add('round');

        input.checked = checked;

        // Action / Logic
        input.addEventListener('change', (e)=>{
            // input.checked = !input.checked;
            e.stopPropagation();
            input.checked = optsMgr.setOption(optionKey, !optsMgr.currentOptions[optionKey]);
        });
        return {
            containerElem: toggleContainer,
            inputElem: input
        };
    }
    const createNumInput = (value, optionKey, step=0.05, max=10, min=0.01) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.value = value;
        input.step = step;
        input.max = max;
        input.min = min;

        input.addEventListener('input', (e)=>{
            if (e.target.value) {
                optsMgr.setOption(optionKey, e.target.value);
            }
        });
        return input;
    }
    
    optionsElements = {};

    const optionsList = document.createElement('ul');
    optionsList.id = "options_list";
    // Generate dropdown elements for each option
    for (let opt of optsMgr.optionsArr) {
        const key = opt.key;
        const optionValue = optsMgr.currentOptions[opt.key];
        const lstElement = document.createElement('li');
        const clickableContainer = lstElement.appendChild(document.createElement('label'));
        const optionText = clickableContainer.appendChild(document.createElement('p'));
        optionText.appendChild(document.createTextNode(opt.name));

        let inputElement;
        if (typeof(optionValue) === "boolean") {
            let temp = createToggleSwitch(optionValue, opt.key);
            inputElement = temp.inputElem;
            clickableContainer.appendChild(temp.containerElem);
        } else {
            inputElement = clickableContainer.appendChild(createNumInput(optionValue, opt.key));
        }

        optionsElements[key] = {
            element: lstElement,
            input: inputElement
        };
        optionsList.appendChild(lstElement);
    }

    // Add "Reset All" Button
    let resetAll = optionsList.appendChild(document.createElement('li'));
    let resetButton = resetAll.appendChild(document.createElement('button'));
    resetButton.appendChild(document.createTextNode("Reset All"));
    resetButton.id = 'reset_options_btn';
    resetButton.classList.add('push_button');
    resetButton.classList.add('button');
    resetButton.classList.add('expand');

    resetAll.firstChild.addEventListener('click', () => optsMgr.resetAllOptions());

    return optionsList;
}
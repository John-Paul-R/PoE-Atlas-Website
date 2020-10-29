
import { debounce } from './util.js';

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
class HTMLElement{
    constructor(tag, id="", className="", options="", innerHTML="") {
        this.tag = tag;
        this.id = id;
        this.className = className;
        this.options = options;
        this.innerHTML = innerHTML;
    }
    asString() {
        let tagString = "<"+this.tag;
        if (this.id) {
            tagString += " id="+this.id;
        }
        if (this.className) {
            tagString += " class="+this.className;
        }
        if (this.options) {
            tagString += " "+this.options;
        }
        tagString += ">"+this.innerHTML+"</"+this.tag+">";
        return tagString;
    }
}

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
     * @param {Array<function>} globalChangeHandlers 
     */
    constructor(storageKey, globalChangeHandlers=[]) {
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
        // if (storedOpts) {
        //     options = {};
        //     for (let key in DEFAULT_OPTIONS) {
        //         // If possible options does not exist in stored options, load from default
        //         // if (!(key in stored)) {
        //         if (key in storedOpts) {
        //             options[key] = storedOpts[key];
        //         } else {
        //             options[key] = DEFAULT_OPTIONS[key];
        //         }
    
        //         // }
        //     }
        //     storeDisplayOptions();
        // } else {
        //     options = DEFAULT_OPTIONS;
        //     storeDisplayOptions();
        // }
        // for (let key in options) {
        //     if (OPTIONS_CHANGED_HANDLERS[key])
        //         OPTIONS_CHANGED_HANDLERS[key]();
        // }
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
        for (const func of this.globalChangeHandlers) {
            func();
        }
        //TODO - Take this vvv out of this method.
        // // console.log(optionsElements[optionKey]);
        let input = optionsElements[optionKey].input;
        if (input.type==="checkbox") {
            input.checked = value;
        } else if (input.type==="text") {
            input.value = value;
        }
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
    const toggleOn = 
        '<label class="switch">'
        +'  <input type="checkbox" checked>'
        +'  <span class="slider round"></span>'
        +'</label>';
    const toggleOff = 
        '<label class="switch">'
        +'  <input type="checkbox">'
        +'  <span class="slider round"></span>'
        +'</label>';
    
    optionsElements = {};

    const optionsList = document.createElement('ul');
    optionsList.id = "options_list";
    // Generate dropdown elements for each option
    for (let opt of optsMgr.optionsArr) {
        const key = opt.key;
        const elem = optsMgr.currentOptions[opt.key];
        let div = document.createElement('div');
        let lstElement = new HTMLElement('li');
        lstElement.innerHTML = "<p>"+opt.name+"</p>\n";
        if (typeof(elem)=="boolean") {
            if (elem) {
                lstElement.innerHTML += toggleOn;
            } else {
                lstElement.innerHTML += toggleOff;
            }
        } else {
            lstElement.innerHTML += '<input type="text" value="' + elem + '">';
        }
        div.innerHTML = lstElement.asString();
        
        let domElement = div.firstChild;
        let input = domElement.getElementsByTagName('input')[0];
        if (input.type==="checkbox") {
            domElement.addEventListener('click', (e)=>{
                // input.checked = !input.checked;
                e.stopPropagation();
                if (e.detail > 0){
                    optsMgr.setOption(key, !optsMgr.currentOptions[key]);
                } else { //This somehow fixes a visual bug that caused checkbox display to be inverted when you click the slider. IDK - JP
                    input.checked = !input.checked;
                }
                
            });
        } else if (input.type==='text') {
            domElement.addEventListener('input', (e)=>{
                if (e.target.value) {
                    optsMgr.setOption(key, e.target.value);
                }
            });
        }
        optionsElements[key] = {
            element: domElement,
            input: input
        };
        optionsList.appendChild(domElement);
    }

    // Add "Reset All" Button
    let resetAll = document.createElement('li');
    resetAll.innerHTML = `<div id="reset_options_btn" class="button expand">Reset All</button>`;
    resetAll.firstChild.addEventListener('click', () => { optsMgr.resetAllOptions() });
    optionsList.appendChild(resetAll);

    return optionsList;
}
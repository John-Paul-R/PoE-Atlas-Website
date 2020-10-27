
// Widgets are classes that extend Widget
// in es6 modules that import Widget from './widgets.js' 
export {
    Modular,
    AbstractWidget as Widget,
    SidebarWidget,
    AtlasWidget,
    WidgetSidebar,
    sidebar
};

import {
    app,
    atlasSprite,
    nodeData, atlasRegions,
    nodePixiObjects,
    getNodeRegionTier,
    renderStage, renderStageThrottled,
    onWindowResize,
    NodePixiObject,
} from './pixi_atlas_of_worlds.js';

import { 
    throttle,
    debounce,
    executeIfWhenDOMContentLoaded,
    FunctionBatch
} from './util.js';

import {
    AsyncDataResourceLoader
} from './resource_loader.js';

/**
 *  Any piece of modular code that hooks into PoEAtlas website
 */
class Modular {
    moduleName: string;
    constructor(moduleName: string) {
        this.moduleName = moduleName;
        Modular.nodeData = nodeData;
        Modular.atlasRegions = atlasRegions;
    }

    static nodeData: any[];
    static atlasRegions: any;
    static getNodeRegionTier = getNodeRegionTier;
}

/**
 * Any visible widget - base class
 */
abstract class AbstractWidget extends Modular {
    displayName: string;
    visible: boolean;
    constructor(moduleName: string, displayName: string, default_visibility: boolean=false) {
        super(moduleName)
        this.displayName = displayName;
        this.visible = default_visibility;
    }
}
class HTMLWidget extends AbstractWidget {
    htmlElement: HTMLElement;
    constructor(moduleName: string, displayName: string, htmlElementBuilder: () => HTMLElement, default_visibility: boolean=false) {
        super(moduleName, displayName, default_visibility)
        this.htmlElement = htmlElementBuilder();
        
    }

} 
/**
 * Standard sidebar widget
 */ 
class SidebarWidget extends HTMLWidget {
    constructor(moduleName: string, displayName: string, sidebarElemBuilder: () => HTMLElement, default_visibility: boolean=false) {
        super(moduleName, displayName, sidebarElemBuilder)
    }
}

/**
 * Has access to pixi app and nodePixiObjects
 */
class AtlasWidget extends AbstractWidget {
    static pixiApp = app;
    static atlasSprite = atlasSprite;
    static nodePixiObjects = nodePixiObjects;
    static renderStage = renderStage;
    static renderStageThrottled = renderStageThrottled;
    
    constructor(moduleName: string, displayName: string) {
        super(moduleName, displayName)
    }
} 

class WidgetSidebar extends HTMLWidget {
    htmlElement: HTMLElement;
    listElement: HTMLElement;
    widgets: SidebarWidget[];
    constructor() {
        super('widget_sidebar', "Widget Sidebar", ()=>document.getElementById('widget_sidebar'), true);
        // this.htmlElement = document.getElementById('widget_sidebar');
        this.listElement = document.getElementById('widget_list');
        this.widgets = [];
    }

    /**
     * Adds a widget to the sidebar.
     * @param {SidebarWidget} widget The widget to register.
     */
    registerWidget(widget: SidebarWidget) {
        executeIfWhenDOMContentLoaded(() => {
            this.widgets.push(widget);
            // this.htmlElement.appendChild(widget.htmlElement);
            const listElem = WidgetSidebar._buildWidgetListElem(widget);
    
            this.listElement.appendChild(listElem);
            console.info(`WidgetSidebar: Registered ${widget.displayName} (${widget.moduleName})`);
            // console.info();
    
        })
    }

    getWidget(index: number) {
        return this.widgets[index];
    }

    getWidgetById(widget_id: string) {
        for (const widget of this.widgets) {
            if (widget.moduleName === widget_id) {
                return widget;
            }
        }
        return undefined;
    }


    static _buildWidgetListElem(widget: SidebarWidget) {
        // Main Containers
        const elem = document.createElement('div');
        const c_head = document.createElement('div');
        const c_front = document.createElement('div');
        const c_end = document.createElement('div');

        elem.setAttribute('class', 'widget');
        c_head.setAttribute('class', 'w_head');
        c_front.setAttribute('class', 'w_front');
        c_end.setAttribute('class', 'w_end');

        c_head.appendChild(c_front);
        c_head.appendChild(c_end);
        elem.appendChild(c_head);
        // Front Container
        const name = document.createElement('b');
        name.setAttribute('class', 'w_name');
        c_front.appendChild(name);

        // End Container
        const drop_btn = document.createElement('div');
        drop_btn.setAttribute('class', 'w_drop_btn');
        const drop_btn_icon = document.createElement('i');
        drop_btn_icon.setAttribute('class', 'material-icons');
        drop_btn_icon.textContent = "expand_more";
        drop_btn.appendChild(drop_btn_icon);
        c_end.appendChild(drop_btn);

        // Fill info
        name.textContent = widget.displayName;
        //TODO dropdown action opens actual widget...

        // Finalize
        widget.htmlElement.style.display = 'none';
        elem.appendChild(widget.htmlElement);
        // DEBUG
        widget.htmlElement.style.backgroundColor = '#3233c4';
        c_head.addEventListener('click', (e) => {
            widget.visible = !widget.visible;
            if (widget.visible) {
                widget.htmlElement.style.display = 'block';
            } else {
                widget.htmlElement.style.display = 'none';
            }
        });

        return elem;
    }
    
}

var sidebar: WidgetSidebar;
function init() {
    sidebar = new WidgetSidebar();
    for (let i = 0; i < 15; i++) {
        sidebar.registerWidget(new SidebarWidget(`w_${i}`, `Widget ${i}`, () => {
            const elem = document.createElement('div');

            elem.style.height = '256px';

            return elem;
        }));
    }
    initStaticSidebarInteractables(sidebar);
}
function initStaticSidebarInteractables(sidebar: WidgetSidebar) {
    const widget_sidebar = sidebar.htmlElement;
    const widget_list = sidebar.listElement;
    const w_sidebar_showhide = document.getElementById("w_sidebar_showhide");
    const content_main = document.getElementById("content_main");
    w_sidebar_showhide.addEventListener('click', () => {
        toggleShowHide(sidebar);
        onWindowResize();
        // if (sidebar.visible) {
        //     content_main.style.setProperty('--sidebar-width', '384px');
        // } else {
        //     content_main.style.setProperty('--sidebar-width', '0');
        // }
    })
}
function toggleShowHide(widget: HTMLWidget) {
    widget.visible = !widget.visible;
    if (widget.visible) {
        widget.htmlElement.classList.remove('hidden');
    } else {
        widget.htmlElement.classList.add('hidden');
    }
}
executeIfWhenDOMContentLoaded(init);
// Widgets are classes that extend Widget
// in es6 modules that import Widget from './widgets.js' 
export { Modular, AbstractWidget as Widget, SidebarWidget, AtlasWidget, WidgetSidebar, };
import { app, atlasSprite, nodeData, atlasRegions, nodePixiObjects, getNodeRegionTier, renderStage, renderStageThrottled, onWindowResize, } from './pixi_atlas_of_worlds.js';
import { executeIfWhenDOMContentLoaded, FunctionBatch, executeOrBatch, dcl } from './util.js';
import { AsyncDataResourceLoader } from './resource_loader.js';
/**
 *  Any piece of modular code that hooks into PoEAtlas website
 */
class Modular {
    constructor(moduleName) {
        this.moduleName = moduleName;
        Modular.nodeData = nodeData;
        Modular.atlasRegions = atlasRegions;
    }
}
Modular.getNodeRegionTier = getNodeRegionTier;
/**
 * Any visible widget - base class
 */
class AbstractWidget extends Modular {
    constructor(moduleName, displayName, default_visibility = false) {
        super(moduleName);
        this.displayName = displayName;
        this.visible = default_visibility;
    }
}
class HTMLWidget extends AbstractWidget {
    constructor(moduleName, displayName, htmlElementBuilder, default_visibility = false) {
        super(moduleName, displayName, default_visibility);
        this.htmlElement = htmlElementBuilder();
    }
}
/**
 * Standard sidebar widget
 */
class SidebarWidget extends HTMLWidget {
    constructor(moduleName, displayName, sidebarElemBuilder, default_visibility = false) {
        super(moduleName, displayName, sidebarElemBuilder);
    }
}
/**
 * Has access to pixi app and nodePixiObjects
 */
class AtlasWidget extends AbstractWidget {
    constructor(moduleName, displayName) {
        super(moduleName, displayName);
    }
}
AtlasWidget.pixiApp = app;
AtlasWidget.atlasSprite = atlasSprite;
AtlasWidget.nodePixiObjects = nodePixiObjects;
AtlasWidget.renderStage = renderStage;
AtlasWidget.renderStageThrottled = renderStageThrottled;
class WidgetSidebar extends HTMLWidget {
    constructor() {
        super('widget_sidebar', "Widget Sidebar", () => document.createElement('div'), true);
        this.widgets = [];
        this.initBatch = new FunctionBatch([]);
        executeIfWhenDOMContentLoaded(() => {
            this.htmlElement = document.getElementById('widget_sidebar');
            this.listElement = document.getElementById('widget_list');
            initStaticSidebarInteractables(this);
            this.initBatch.runAll();
        });
    }
    /**
     * Adds a widget to the sidebar.
     * @param {SidebarWidget} widget The widget to register.
     */
    registerWidget(widget) {
        executeOrBatch(() => {
            this.widgets.push(widget);
            // this.htmlElement.appendChild(widget.htmlElement);
            const listElem = WidgetSidebar._buildWidgetListElem(widget);
            this.listElement.appendChild(listElem);
            console.info(`WidgetSidebar: Registered '${widget.displayName}' (${widget.moduleName})`);
            // console.info();
        }, dcl(), this.initBatch);
    }
    getWidget(index) {
        return this.widgets[index];
    }
    getWidgetById(widget_id) {
        for (const widget of this.widgets) {
            if (widget.moduleName === widget_id) {
                return widget;
            }
        }
        return undefined;
    }
    static _buildWidgetListElem(widget) {
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
        // widget.htmlElement.style.backgroundColor = '#3233c4';
        c_head.addEventListener('click', (e) => {
            widget.visible = !widget.visible;
            if (widget.visible) {
                widget.htmlElement.style.display = 'block';
            }
            else {
                widget.htmlElement.style.display = 'none';
            }
        });
        // TODO utilize open() to allow users to pop out widgets if they choose.
        return elem;
    }
}
function initStaticSidebarInteractables(sidebar) {
    const w_sidebar_showhide = document.getElementById("w_sidebar_showhide");
    w_sidebar_showhide.addEventListener('click', () => {
        toggleShowHide(sidebar);
        onWindowResize();
    });
}
function toggleShowHide(widget) {
    widget.visible = !widget.visible;
    if (widget.visible) {
        widget.htmlElement.classList.remove('hidden');
    }
    else {
        widget.htmlElement.classList.add('hidden');
    }
}
// ================
//  Widget Sidebar
// ================
var widgetSidebar = new WidgetSidebar();
var widgetSidebarJson;
new AsyncDataResourceLoader([])
    .addResource('widget/sidebar-all-json', [
    (responseData) => widgetSidebarJson = responseData
]).addCompletionFunc(() => {
    let sortedData = Object.keys(widgetSidebarJson).sort().reduce((obj, key) => {
        obj[key] = widgetSidebarJson[key];
        return obj;
    }, {});
    for (const [key, value] of Object.entries(sortedData)) {
        widgetSidebar.registerWidget(new SidebarWidget(`w_${key}`, value['title'], () => {
            const elem = document.createElement('div');
            elem.innerHTML = value['content'];
            return elem;
        }));
    }
}).fetchResources();

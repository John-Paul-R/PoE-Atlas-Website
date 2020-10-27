
// Imports
import {
    app,
    atlasSprite,
    nodeData,
    nodePixiObjects,
    getNodeRegionTier,
    renderStage, renderStageThrottled,
    NodePixiObject,
    // moduleManager
} from '../js/pixi_atlas_of_worlds.js';

import { 
    throttle,
    debounce,
    executeIfWhenDOMContentLoaded,
    FunctionBatch,
} from '../js/util.js';

import {
    AsyncDataResourceLoader
} from '../js/resource_loader.js';

import {
    SidebarWidget,
    sidebar
} from '../js/widget.js';

// Begin Module

// moduleManager.register(initModule);

// todo moduleManager.addExternalStyle('link-to-stylesheet');
// todo moduleManager.addStyle('stylesheet-content');
function buildSidebarElem(textContent: string) {
    var sidebarElem = document.createElement('div');
    // HTML Building
    sidebarElem.textContent = textContent;
    return sidebarElem;
}

class ACustomizedSideBarWidget extends SidebarWidget {
    instanceData: Object;
    constructor(moduleName: string, displayName: string) {
        super(moduleName, displayName, () => buildSidebarElem(displayName));
        //do things
        this.instanceData = {
            interesting: "data",
        }
    }
    
}

sidebar.registerWidget(new SidebarWidget('MyBasicSidebarWidget', 'A Basic Widget', () => buildSidebarElem('words')))
sidebar.registerWidget(new ACustomizedSideBarWidget('SpecialSidebarWidget', 'A Special Widget'))

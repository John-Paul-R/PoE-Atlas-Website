/*
    *! Copyright (c) 2020 John Paul Rutigliano
    *
    * 
    * This Source Code Form is subject to the terms of the Mozilla Public
    * License, v. 2.0. If a copy of the MPL was not distributed with this
    * file, You can obtain one at http://mozilla.org/MPL/2.0/.
    * 
    * Source: https://github.com/John-Paul-R/PoE-Atlas-Website
*/

//================
// Module Imports / Exports
//================
export {
    app,
    atlasSprite,
    nodeData, atlasRegions,
    nodePixiObjects,
    getNodeRegionTier,
    resourceLoadFuncs,
    getMapScaleFactor,
    renderStage, renderStageThrottled,
    onWindowResize,
    NodePixiObject,
};

import { 
    throttle,
    debounce,
    executeIfWhenDOMContentLoaded,
    FunctionBatch
} from './util.js';

import {
    createOptionsMenu,
    OptionsManager
} from './options.js';

import {
    AsyncDataResourceLoader
} from './resource_loader.js';

// import {
//     Modular,
//     Widget,
//     AtlasWidget,
//     SidebarWidget,
//     WidgetSidebar
// } from './widget.js';

// var sidebarManager;
// import * as PIXI from 'pixi.js';
//===========
//  Globals
//===========

/**
 * Parsed json data file w/ map positions & other node data
 * @type {Array<Object>} an array of node data objects 
 */
var nodeData;
/**
 * Parsed json data file w/ atlas region data
 * @type {Array<Object>} an array of atlas region data objects 
 */
var atlasRegions;
const NUM_REGIONS = 8;

class DynamicSprite extends PIXI.Sprite {
    constructor(scaleFunc, posFunc, texture=null) {
        super(texture);
        this.getScale = scaleFunc;
        this.getPosition = posFunc;
        this.updateScale = () => {
            super.scale = this.getScale();
        }
        this.updatePosition = () => {
            super.position = this.getPosition();
        }
    }
}

//The main sprite for the Atlas. (background image)
var atlasSprite = new DynamicSprite(
    // Scale Func
    //Adjust for Atlas img size being large
    () => new PIXI.Point(pixiAtlasW/maxW, pixiAtlasH/maxH),
    // Pos Func
    () => new PIXI.Point((app.screen.width-pixiAtlasW)/2, (app.screen.height-pixiAtlasH)/2)
);
//Self explanatory.
/**
 * @type {PIXI.Container}
 */
let linesContainer;
/**
 * @type {PIXI.Container}
 */
let nodesContainer;
/**
 * @type {PIXI.Container}
 */
let watchstonesContainer;

//Dimensions of the Atlas image (the largest sprite, which all other sprites are children of)
const maxH = 2304;
const maxW = 4096;
//The calculated dimensions of the pixi screen (updates on resize and on init)
let pixiScreenW = 2304;
let pixiScreenH = 4096;
//The calculated dimensions of the scaled Atlas image (If working as intended...
// this should represent the actual visual size of the Atlas image.) (updates on resize and on init)
let pixiAtlasH = 2304;
let pixiAtlasW = 4096;
/**
 * @type {HTMLElement}
 */
var CONTAINER_ELEMENT;

// Global Display properties
var nodeCenterOffset = 25/4;//If I figure out how to scale the source data correctly, 'nodeCenterOffset' probably becomes 0 (and therefore unneeded)
var nodeRadius = 30/4;
var lineThickness = 2.5/4 * mapScaleFactor;
const lineColor = 0x333333;//ffffff;

/**
 * Watchstones Manager Object
 */
var watchstones = {
    /**
     * @type {Array<PIXI.Graphics>}
     */
    buttons: [],
    masterButton: new PIXI.Graphics(),
    init: () => {
        const WATCHSTONE_TEXT_RESOLUTION = 3;
        const padding = 6;
    
        // watchstones.masterButton = new PIXI.Graphics();
        const mText = new PIXI.Text("Cycle All Region Tiers", {
            fontFamily: 'Fontin-Regular',
            fontSize: 18,
            align: "center",
            fontWeight: "bold",
        });
        mText.resolution = WATCHSTONE_TEXT_RESOLUTION;
        mText.anchor.set(0.5, 0.5);

        let mW = (mText.width + padding),
            mH = (mText.height + padding);
        watchstones.masterButton
            .lineStyle(lineThickness/mapScaleFactor, '0x0', 1, 0.5, false)
            .beginFill('0xffffff',1)
            .drawRect(-mW/2, -mH/2, mW, mH)
            .addChild(mText);
        watchstones.masterButton.filters = [new PIXI.filters.DropShadowFilter()];
        
    
        // watchstones.buttons = [];
        for (let i=0; i < NUM_REGIONS; i++) {
            let button = new PIXI.Graphics();
            let bText = new PIXI.Text("", {
                fontFamily: 'Fontin-Regular',
                fontSize: 18,
                align: "center",
                fontWeight: "bold",
            });
            bText.resolution = WATCHSTONE_TEXT_RESOLUTION;
            // TODO Create 2 text sprites: one for name, and one for region tier. Update only the latter.
            button.textSprite = bText;
            button.addChild(bText);
            bText.anchor.set(0.5);
    
            //init click functions & tier text
            button.interactive = true;
            button.buttonMode = true;    
            button.on("pointertap", () => { cycleAtlasRegionTier(i, button); });
            bText.text = atlasRegions[i].Name+"\nTier "+regionTiers[i];
    
            let bW = (bText.width + padding),
                bH = (bText.height + padding);
            button.lineStyle(lineThickness/mapScaleFactor, '0x0', 1, 0.5, false)
                .beginFill('0x997f87', 0.7)
                .drawRect(-bW/2, -bH/2, bW, bH);
    
            watchstones.buttons.push(button);
            watchstonesContainer.addChild(button);
        }
        
        //init "master" tier button (cycle all nodes) click function
        watchstones.masterButton.interactive = true;
        watchstones.masterButton.buttonMode = true;    
        watchstones.masterButton.on("pointertap", cycleAllAtlasRegionTiers);
        watchstonesContainer.addChild(watchstones.masterButton);
        watchstones.masterButton.position.set(0, 0);
    
        function cycleAtlasRegionTier(regionID, boolDrawRegion=true) {
            if (regionTiers[regionID] < 4) {
                regionTiers[regionID] += 1;
            } else {
                regionTiers[regionID] = 0;
            }
            //Update corresponding button label
            watchstones.buttons[regionID].textSprite.text = atlasRegions[regionID].Name+"\nTier "+regionTiers[regionID];
            //Redraw watchstones region & adjacent regions
            if (boolDrawRegion) {
                drawAtlasRegion(regionID, true);
            }
            //Store the current region tiers on the client
            storeRegionTiers();
        }
    
        function cycleAllAtlasRegionTiers() {
            for(let i=0; i<NUM_REGIONS; i++) {
                cycleAtlasRegionTier(i, false);
            }
            drawAllAtlasRegions();
        }
    
        watchstones.updatePositions();
        watchstones.updateVisibility();
    },
    /**
     * Positions all watchstone buttons (including master) on the Atlas.
     */
    updatePositions: () => {
        const watchstoneLocations = {
            "InsideBottomLeft" : { "x": 434, "y": 463 },
            "InsideBottomRight" : { "x": 627, "y": 500 },
            "OutsideBottomRight" : { "x": 753, "y": 501 },
            "InsideTopRight" : { "x": 647, "y": 299 },
            "OutsideTopRight" : { "x": 823, "y": 231 },
            "InsideTopLeft" : { "x": 255, "y": 206 },
            "OutsideTopLeft" : { "x": 174, "y": 221 },
            "OutsideBottomLeft" : { "x": 154, "y": 316 }
        }
        const posKeys = Object.keys(watchstoneLocations);
        if (watchstones.buttons) {
            const btnScale = 0.6;
            for(let i=0; i<watchstones.buttons.length; i++) {
                for (let key of posKeys) {
                    if (key === atlasRegions[i].Id) {
                        let loc = watchstoneLocations[key];
                        watchstones.buttons[i].position.set(loc.x*mapScaleFactor, loc.y*mapScaleFactor);
                        watchstones.buttons[i].scale.set(btnScale*mapScaleFactor)
                        break;
                    }
                }
            }
            watchstones.masterButton.position.set(pixiAtlasW/2, pixiAtlasH/2);
            watchstones.masterButton.scale.set(btnScale*mapScaleFactor);
        }
    },
    /**
     * Updates the visibility of all watchstones according to current options.
     */
    updateVisibility() {
        if (watchstones.buttons) {
            for(let i=0; i<watchstones.buttons.length; i++) {
                watchstones.buttons[i].visible = optsMgr.currentOptions.Watchstones;
            }
            watchstones.masterButton.visible = optsMgr.currentOptions.MasterWatchstone;
        }
    }
}

var optsMgr = new OptionsManager('displayOptions', [drawAllAtlasRegions]);
optsMgr.register("drawLines", "Show Lines", true, null)
    .register("drawNodes", "Show Nodes", true, updateNodesVisibility)
    .register("drawNames", "Show Names", true, updateNodesVisibility)
    .register("drawTiers", "Show Tiers", true, updateNodesVisibility)
    .register("nodeHover", "Hover Effect", true, () => {
        if (nodePixiObjects) {
            let hoverEnabled = optsMgr.currentOptions.nodeHover;
            for (let i = 0; i < nodePixiObjects.length; i++) {
                nodePixiObjects[i].setupHover(hoverEnabled);
            }
        }
    })
    .register("Watchstones", "Show Watchstones", true, watchstones.updateVisibility)
    .register("MasterWatchstone", "Show 'Cycle' Button", true, watchstones.updateVisibility)
    .register("nodeScaleFactor", "Node Size", 1, updateNodeSize)
    .register("nodeTextScale", "Node Text Size", 1, updateNodesTextScale);

// Add generated HTML elements to DOM
executeIfWhenDOMContentLoaded(() => {
    // Add runtime-generated HTML elements to DOM
    addAllToDOM();
});

function updateNodeSize() {
    NodePixiObject.CONTAINER_SCALE = symPoint(optsMgr.currentOptions.nodeScaleFactor * mapScaleFactor);
}
function updateNodesTextScale() {
    NodePixiObject.NAME_SCALE = symPoint(2/3 * optsMgr.currentOptions.nodeTextScale);
    NodePixiObject.TIER_SCALE = symPoint(0.15 * optsMgr.currentOptions.nodeTextScale);
    if (nodePixiObjects) {
        for (const obj of nodePixiObjects) {
            obj.nameContainer.scale = NodePixiObject.NAME_SCALE;
            obj.tierSprite.scale = NodePixiObject.TIER_SCALE;
        }
        updateAllNodeGraphics();
    }
}

//Create the Pixi Application
/**
 * @type {PIXI.Application}
 */
var app;
/**
 * @type {PIXI.Container}
 */
var stage;
/**
 * @type {PIXI.Loader}
 */
var loader;
console.log("Creating PIXI Atlas app.");
try {
    app = new PIXI.Application({
        width: pixiAtlasW,
        height: pixiAtlasH,
        autoStart: false,
        antialias: true,
        sharedLoader: true,
        sharedTicker: false,
        resolution: devicePixelRatio,
        // init width and height to 0 in order to prevent issue where page load (onLoad, DCL0) were being blocked for a long time
        width: 0,
        height:0
    });
} catch (e) {
    // If PIXI App init fails, display message to user, telling them to enable WebGL
    executeIfWhenDOMContentLoaded(() => {
        let msgElement = document.createElement('p');
        msgElement.innerHTML = 
            `<span class="bold">Page not loading? </span>
            Make sure you have WebGL enabled.
            The site depends on it to function.
            <ul>
            <li><a href="https://www.interplaylearning.com/help/how-to-enable-webgl-in-chrome">Enable WebGL on Chrome</a></li>
            <li><a href="https://www.interplaylearning.com/help/how-to-enable-webgl-in-firefox">Enable WebGL on Firefox</a></li>
            </ul>`;
        document.getElementById("atlas_of_worlds").appendChild(msgElement);
    });
}
app.ticker.stop();
PIXI.Ticker.shared.autoStart = false;
PIXI.Ticker.shared.stop();
app.stage = new PIXI.display.Stage();
stage = app.stage;
// Add Atlas sprite to stage
stage.addChildAt(atlasSprite, 0);

var resourceLoadFuncs = new FunctionBatch();
//Load Pixi resources
loader = PIXI.Loader.shared;
// When 1st batch of resources are loaded...
// ...Add the canvas (that Pixi created) to the HTML document (createPixiView)
// TODO Perhaps do this on DOM content load instead? Why are we waiting?
loader.onComplete.once(() => {
    console.timeLog("load");
    CONTAINER_ELEMENT = document.getElementById("atlas_of_worlds")
    CONTAINER_ELEMENT.appendChild(app.view);
    CONTAINER_ELEMENT.lastChild.className = "pixi_atlas_of_worlds";
});

let timers = [];
console.time("load");
loader.onStart.add((resource)=>{
    console.timeLog("load");
    for (let value of Object.values(resource.resources)) {
        if (value.name) {
            timers.push(value.name);
            console.time(value.name);
        }
    }
})
loader.onLoad.add((resource)=>{
    for (let value of Object.values(resource.resources)) {
        let index = timers.indexOf(value.name);
        if (index >= 0) {
            timers.pop(index);
            console.timeEnd(value.name);
        }
    }
})
loader
    .add("img/Atlas47kb.webp")
    .load(setup);

// Load Atlas Data (Request, parse, and store file data)
new AsyncDataResourceLoader()
    .addResource("data/AtlasDataCombined_Itemized-1602838451.json", [
        (resJson) => {
            let combinedData = resJson;
            nodeData = combinedData["AtlasNode+WorldAreas"];
            atlasRegions = combinedData["AtlasRegions.dat"];

            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)
            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                regionNodes[entry.AtlasRegionsKey].push(i);
                entry.internalName = toPoEDBName(entry.Name, entry.IsUniqueMapArea).replace(/ /g,"_");
            }
        },
        watchstones.init,
        preloadStaticGraphics,
        //Draw Atlas Nodes & Lines
        drawAllAtlasRegions,
    ])
    .fetchResources();

// Create all main pixi containers and layers
initPixiContainers();

// Create all atlas region containers
for (let regionID = 0; regionID < NUM_REGIONS; regionID++) {
    linesContainer.addChildAt(new PIXI.Graphics(), regionID);
    nodesContainer.addChildAt(new PIXI.Container(), regionID);
}

//===========
// Functions
//===========
function setup(loader, resources) {
    loader.reset();
    console.timeLog("load");

    //==================
    //  Initialization
    //==================
    // Load main atlas sprite's initial texture
    atlasSprite.texture = resources["img/Atlas47kb.webp"].texture;

    //Queue next pixi resources for loading
    loader.add("img/spritesheets/atlas-maps-heist-2.1_Itemized-1602836784.json")
        .load(()=>{
            console.timeLog("load");
            sheet = loader.resources["img/spritesheets/atlas-maps-heist-2.1_Itemized-1602836784.json"];
            //TODO make sure this waits for nodeData to exist...
            drawAllAtlasRegions();
            loader.reset();
            loader.add("img/Atlas80.webp").load(()=>{
                atlasSprite.texture = loader.resources["img/Atlas80.webp"].texture;
                //DEBUG
                console.timeEnd("load");
                renderStage();
            });
        });
    
    resourceLoadFuncs.runAll();

    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish

    app.renderer.render(stage);
    onWindowResize();
    window.addEventListener('resize', () => window.requestAnimationFrame(onWindowResize) );
    
    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}

/**
 * The Spritesheet containing all map Node images.
 * @type {PIXI.Spritesheet}
 */
var sheet;

/**
 * @type {PIXI.display.Group}
 */
var unfocusedNodesContainer;
/**
 * @type {PIXI.display.Group}
 */
var focusedNodesContainer;
function initPixiContainers() {
    //Create main containers for Lines, Nodes, and Watchstones
    linesContainer = new PIXI.Container();
    watchstonesContainer = new PIXI.Container()
    nodesContainer = new PIXI.Container();
    unfocusedNodesContainer = new PIXI.display.Group(0, false);
    focusedNodesContainer = new PIXI.display.Group(1, false);

    // nodesContainer.group.enableSort = true;

    //Add Lines, Nodes, and Watchstones containers to stage. (Lines 1st, so that they are in back.)
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(watchstonesContainer);
    atlasSprite.addChild(nodesContainer);
    atlasSprite.addChild(new PIXI.display.Layer(unfocusedNodesContainer));
    atlasSprite.addChild(new PIXI.display.Layer(focusedNodesContainer));
}

/**
 * @returns {number} Factor by which to multiply node positions from the data file when drawing
 */
function getMapScaleFactor() {
    return mapScaleFactor;
}
var mapScaleFactor;// = pixiAtlasW/maxW*4;//4.05;
/**
 * Tiers of each region (array index = regionID)
 * @type {Array<number>}
 */
var regionTiers = [];
var REGION_TIER_STORAGE_KEY = 'regionTiers';
/**
 * Stores the regionTiers of the current Atlas state in localStorage.
 * @type {Function}
 */
var storeRegionTiers = debounce(
    () => { window.localStorage.setItem(REGION_TIER_STORAGE_KEY, JSON.stringify(regionTiers)); },
    1000
);
/**
 * Loads the region tiers from LocalStorage. If no stored values are found, 
 * defaults to all 0s and stores that to LocalStorage.
 */
function loadRegionTiers() {
    let stored = JSON.parse(window.localStorage.getItem(REGION_TIER_STORAGE_KEY));
    if (stored) {
        regionTiers = stored;
    } else {
        regionTiers = [0,0,0,0,0,0,0,0];
        storeRegionTiers();
    }
}

loadRegionTiers();
/**
 * Array of lists of nodes(IDs) in each region
 * @type {Array<Array<number>>}
 */
var regionNodes = [[], [], [], [], [], [], [], []];
// var regions = [{}, {}, {}, {}, {}, {}, {}, {}]
// class Region {
//     constructor(tier=0, nodes=[], name="") {
//         this.nodes = nodes;
//         this.tier = tier;
//         this.name = name;
//     }
// }
// for (let i=0; i < NUM_REGIONS; i++) {
//     regions.push(new Region())
// }

/**
 * @type {Array<PIXI.RenderTexture>}
 */
var nodeTierTextures;
/**
 * @type {Array<NodePixiObject>}
 */
var nodePixiObjects;
var nodeInfoSidebar;
document.addEventListener('DOMContentLoaded', () => nodeInfoSidebar = {
    container: document.getElementById("node_info"),
    name: document.getElementById("node_name"),
    poedb: document.getElementById("node_poedb"),
    poewiki: document.getElementById("node_poewiki"),
    region: document.getElementById("node_region"),
    icon: document.getElementById("node_image"),
    tiers: document.getElementById("node_tiers_list"),
    connections: document.getElementById("node_connections_list"),
    pantheon: document.getElementById("node_pantheon_desc"),
});

// TODO - Implement or remove
/**
 * @param {NodePixiObject} nodeThe node for which to build the graphics object.
 * @param {Number} [detail=0]  The version (ordered by detail level) of hover graphics that should be built.
 * 
 * @return {PIXI.Graphics} The constructed hover graphics object.
*/
function buildNodeHoverGraphics(node, detail=0) {

    return
}

class NodePixiObject {
    /**
     * Create a NodePixiObject
     * @param {PIXI.Text} nameSprite  
     * @param {Object} data a node data object
     */
    constructor(nameSprite, data, initialTexture) {
        this.container = new PIXI.Container();
        this.container.parentGroup = unfocusedNodesContainer;

        this.backgroundContainer = new PIXI.Container();
        this.container.addChild(this.backgroundContainer);

        //Placeholder img sprite
        this.imgSprite = new PIXI.Sprite(initialTexture);
        this.imgSprite.anchor.set(0.5);
        
        this.imgSprite.interactive = true;
        this.imgSprite.buttonMode = true;

        this.setupHover(optsMgr.currentOptions.nodeHover);

        this.imgSprite.pointertap = ()=>this.onSelect();
        
        this.container.addChild(this.imgSprite);

        this.nameContainer = new PIXI.Container();
        
        this.nameSprite = nameSprite;
        nameSprite.anchor.set(0.5, 1);
        this.nameContainer.addChild(this.nameSprite);
        this.container.addChild(this.nameContainer);

        //Preload Node Tier Sprites
        this.tierSprite = new PIXI.Sprite.from(
            nodeTierTextures[data.TieredData[0].Tier]
        );
        this.container.addChild(this.tierSprite);
        this.tierSprite.anchor.set(0.5,0);

        // init from static values
        this.nameContainer.y = this.constructor.NAME_Y;
        this.nameContainer.scale = this.constructor.NAME_SCALE;
        this.tierSprite.scale = this.constructor.TIER_SCALE;
        this.tierSprite.y = this.constructor.TIER_Y;
        this.imgSprite.scale = data.IsUniqueMapArea ? this.constructor.IMG_SCALE_UNIQUE : this.constructor.IMG_SCALE;
        this.backgroundContainer.scale = this.constructor.BACKGROUND_SCALE;

        this.data = data;

        this.isSearchMatch = false;;
        this.isHovered = false;
        this.isSelected = false;
    }

    // TODO - Implement or remove.
    /**
     * Called on each NodePixiObject during each search. Updates node graphics based on whether node is a match.
     * 
     * @param {boolean} isSearchMatch Whether or not the node matched the search query.
     */
    onSearch(isSearchMatch) {
        if (this.isSearchMatch === isSearchMatch) {
            // No change. Exit.
            return;
        } else if (isSearchMatch) {
            // Is a new match. Modify graphics to highlight.

        } else {
            // Was a match, but isn't one anymore. Revert graphics to normal.

        }
        this.isSearchMatch = isSearchMatch;
    }
    
    /**
     * Updates Node Graphics based on the state of the node.
     * (isSearchMatch, isHovered, isSelected)
     * 
     * When these values are updated via their respective functions,
     * updateNodeGraphics is called if there was indeed a state change.
     * "Sums" the effects of all conditions on the node.
     */
    updateNodeGraphics() {
        let lightFocused =  optsMgr.currentOptions.nodeHover && this.isHovered
                            || this.isSearchMatch
                            || this.isSelected;
        // Actual logic shown here. Is made more effecient in actual code.
        // let nameVisible = options.drawNames || lightFocused;
        // let tierVisible = options.drawTiers || lightFocused;
        // let zIndex = (this.isSelected ? 2 : (lightFocused ? 1 : 0));
        // let drawNameBg = lightFocused;
        // let shadowEnabled = lightFocused;
        
        // Draw shadow
        if (optsMgr.currentOptions.nodeHover) {
            if (this.isHovered && this.container.filters.length == 0)
                this.container.filters.push(new PIXI.filters.DropShadowFilter());
            // Remove shadow
            else if (this.container.filters.length > 0)
                this.container.filters.pop(0);
        }

        // Set scale 
        const scale = this.constructor.CONTAINER_SCALE.x
        //this.constructor.hoverScaleMult
            * (this.isHovered ? 1.25 : 1)
            * (this.isSearchMatch ? 1.25 : 1)
            * (this.isSelected ? 1.25 : 1)
        this.container.scale.x = scale;
        this.container.scale.y = scale;

        this.container.zIndex = (this.isHovered ? 3 : (this.isSelected ? 2 : (lightFocused ? 1 : 0)));
        if (lightFocused) {
            // Bring to front?
            this.container.parentGroup = focusedNodesContainer;

            // Make name and tier visisble
            this.nameContainer.visible = true;
            this.tierSprite.visible = true;

            // Draw name background
            if (this.nameContainer.children.length < 2)
                this.nameContainer.addChildAt(this.nameBg(), 0);

        } else {
            this.nameContainer.visible = optsMgr.currentOptions.drawNames;
            this.tierSprite.visible = optsMgr.currentOptions.drawTiers;

            // Send to normal layer
            this.container.parentGroup = unfocusedNodesContainer;
            this.container.zIndex = 0;

            // Remove name bg
            if (this.nameContainer.children.length > 1)
                this.nameContainer.removeChildAt(0).destroy();
        }
    }

    nameBg(texture=PIXI.Texture.WHITE) {
        let nameBG = new PIXI.Sprite(texture);
        nameBG.width = this.nameSprite.width + 3; // Horizontal padding = 3
        nameBG.height = this.nameSprite.height;
        nameBG.anchor.set(0.5,1); // Center sprite on text
        nameBG.alpha = 0.8;
        return nameBG;
    }

    static hoverScaleMult = 1.325;
    /**
     * Enable/Disable node hover effects.
     * @param {boolean} boolEnabled 
     */
    setupHover(boolEnabled) {
        if (boolEnabled) {
            
            this.imgSprite.pointerover = (pointerData)=>{
                this.isHovered = true;
                this.gainLightFocus();
                app.renderer.render(stage);
            };

            this.imgSprite.pointerout = (pointerData)=>{
                this.isHovered = false;
                this.loseLightFocus();
                app.renderer.render(stage);
            };

            this.container.filters = [];
        } else {
            this.imgSprite.pointerover = null;
            this.imgSprite.pointerout = null;
            this.container.filters = null;
        } 
    }

    gainLightFocus(hoverGraphic) {
        // this.container.scale.x *=scaleMult;
        // this.container.scale.y *=scaleMult;

        this.updateNodeGraphics();

        if (hoverGraphic) {
            this.backgroundContainer.addChild(hoverGraphic);
        }
    }

    /**
     * 
     */
    loseLightFocus(forceBaseScale) {
        // this.container.scale.x /= scaleMult;
        // this.container.scale.y /= scaleMult;

        this.updateNodeGraphics();
    }

    /**
     * @type {NodePixiObject}
     */
    static prevSelected = null;
    /**
     * A function that removes the 'click' MouseEvent handler associated with
     * the previously selected NodePixiObject from the 'node_exit' button.
     * 
     * @type {function}
     */
    static removePrevCloseHandler = null;
    /**
     * Select this node, remove selection of the previously selected node,
     * then render the stage (throttled)
     */
    onSelect() {
        // Un-select previous node. Select this node.
        if (this.constructor.prevSelected) {
            this.constructor.prevSelected.isSelected = false;
            this.constructor.prevSelected.updateNodeGraphics();
            this.constructor.removePrevCloseHandler();
        }
        this.constructor.prevSelected = this;
        this.isSelected = true;
        this.backgroundContainer.addChild(NodePixiObject.SPRITE_SELECTED);
        
        //=====================
        // Update Info sidebar
        //=====================
        const sidebar = nodeInfoSidebar;

        // Info sidebar close button
        const sidebarCloseButton = document.getElementById("node_exit");
        const sidebarCloseClickHandler = (e) => {
            if (!sidebar.container.className.includes("hidden")) {
                sidebar.container.className = sidebar.container.className +" hidden";
                
                this.constructor.prevSelected = null;
                this.isSelected = false;
                this.backgroundContainer.removeChild(NodePixiObject.SPRITE_SELECTED);
                this.updateNodeGraphics();
                renderStage();

                sidebarCloseButton.removeEventListener("click", sidebarCloseClickHandler);
            }
        }
        sidebarCloseButton.addEventListener('click', sidebarCloseClickHandler);
        this.constructor.removePrevCloseHandler = () => sidebarCloseButton.removeEventListener("click", sidebarCloseClickHandler);
        
        // Update Node Info Sidebar Content
        // Update Header (Node Name)
        sidebar.name.innerText = this.data.Name;
        
        // External Links (PoEDB and Wiki)
        let nodeExternalLinks = getNodeExternalLinks(this.data);
        sidebar.poedb.href = nodeExternalLinks.poeDBLink;
        sidebar.poewiki.href = nodeExternalLinks.poeWikiLink;
        
        // Region Name
        sidebar.region.innerText = "Region: " + atlasRegions[this.data.AtlasRegionsKey].Name;

        // Sidebar Icon
        try {
            sidebar.icon.src = this.getImgBase64(getTieredNodeData(this.data).tier);//buildCDNNodeImageLink(this.data, 0, 8, getTieredNodeData(this.data).tier);
        } catch (e) {
            sidebar.icon.src = app.renderer.extract.base64(this.imgSprite.texture, 'image/png', 1);
        }

        // Tiers Table
        const tds = sidebar.tiers.getElementsByTagName('td');
        for (let i=0; i < tds.length; i++) {
            let tier = this.data.TieredData[i].Tier;
            tds[i].innerText = tier <= 0 ? "-" : tier;
        }

        // Connections List
        let connectionsData = this.data.TieredData[4].AtlasNodeKeys;
        let connectionsText = "";
        for (let i=0; i < connectionsData.length; i++) {
            connectionsText += getNodeByID(connectionsData[i]).Name;
            if (i < connectionsData.length-1) {
                connectionsText += ", ";
            }
        }
        sidebar.connections.innerText = connectionsText;

        // Show info sidebar if it is hidden
        sidebar.container.className = sidebar.container.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );

        this.updateNodeGraphics();
        renderStageThrottled();
    }
    /**
     * Get the texture of this node at the specified tier.
     * @param {number} [tier=0]
     * @param {boolean} [includeBg=false] Whether to combine the map-specific image with the base map bg img.
     * @returns {PIXI.Texture}
     */
    getSpriteImg(tier=0, includeBg=false) {
        let outTexture;

        let nodeTextureKey = this.data.Name;
        let nodeTexture = sheet.textures[nodeTextureKey];

        if (this.data.IsUniqueMapArea) {
            outTexture = nodeTexture;
        } else {
            const map_tint = {
                red: 0xF72514,
                yellow: 0xFFCF46,
                white:0xFDFDFD
            }
            let tint;
            if (tier < 6) {
                tint = map_tint.white;
            } else if (tier < 11) {
                tint = map_tint.yellow;
            } else {
                tint = map_tint.red;
            }
            
            if (includeBg) {
                let baseTexture = sheet.textures['Art/2DItems/Maps/Atlas2Maps/New/Base9.dds'];
                let outSprite = new PIXI.Sprite(baseTexture);
                let nodeSprite = new PIXI.Sprite(nodeTexture);
                outSprite.addChild(nodeSprite);
                
                nodeSprite.tint = tint;

                const texSize = 78;
                // outSprite.position = symPoint(texSize/2);
                outTexture = PIXI.RenderTexture.create({width: texSize, height: texSize, resolution: 2});
                app.renderer.render(outSprite, outTexture);
            } else {
                outTexture = nodeTexture;
            }
        }

        return outTexture;
    }
    /**
     * Get the base64 image string for this node at the specified tier.
     * @param {number} tier 
     */
    getImgBase64(tier=0) {
        return app.renderer.extract.base64(
            PIXI.Sprite.from(this.getSpriteImg(tier, true)),
            'image/png',
            1
        );
    }

    static CONTAINER_SCALE = new PIXI.Point(1,1);
    static NAME_SCALE = symPoint(1);//2/3 * options.nodeTextScale);
    static IMG_SCALE = symPoint(1/4);
    // 78 is l/w of standard node img 47 is l/w of unique node img
    static IMG_SCALE_UNIQUE = NodePixiObject.IMG_SCALE//symPoint(1/4 * (78/47));
    static TIER_SCALE = symPoint(1);//0.15 * options.nodeTextScale);
    static BACKGROUND_SCALE = symPoint(0.4);
    static NAME_Y = 0 - (nodeRadius + nodeCenterOffset/4);
    static TIER_Y = nodeRadius + nodeCenterOffset/4;

    // NodePixiObject.NAME_SCALE = symPoint(2/3 * options.nodeTextScale),
    // NodePixiObject.IMG_SCALE = symPoint(1/4),
    // // 78 is l/w of standard node img 47 is l/w of unique node img
    // NodePixiObject.IMG_SCALE_UNIQUE = symPoint(1/4 * (78/47)),
    // NodePixiObject.TIER_SCALE = symPoint(0.15 * options.nodeTextScale),
    // NodePixiObject.BACKGROUND_SCALE = symPoint(0.4),
    // NodePixiObject.NAME_Y = 0 - (nodeRadius + nodeCenterOffset/4),
    // NodePixiObject.TIER_Y = nodeRadius + nodeCenterOffset/4;

    /**
     * The Sprite that shows when a Node is selected. (Max 1)
     * @type {PIXI.Sprite}
     */
    static SPRITE_SELECTED;
}
(function() {
    const textureSize = 128
    const lineThickness = 4;
    const texSelected = PIXI.RenderTexture.create({
        width: textureSize,
        height: textureSize,
        resolution: 6
    });
    texSelected.defaultAnchor = new PIXI.Point(0.5, 0.5);

    let graphSelected = new PIXI.Graphics()
        .lineStyle(lineThickness, '0x77dddd', 1, 0.5, false)
        .beginFill('0x555555',0)
        .drawCircle(0, 0, 36)
    graphSelected.position.set(textureSize/2, textureSize/2);

    app.renderer.render(graphSelected, texSelected);
    
    // TODO - Choose outline color based on Theme accent color.
    graphSelected = new PIXI.Graphics()
        .lineStyle(6, 0x55bbbb, 1, 0.5, false)
        .beginFill(0x302a30, 1)
        .drawCircle(0, 0, 48)
        .endFill();

    graphSelected.position.set(textureSize/2, textureSize/2);
    app.renderer.render(graphSelected, texSelected);

    const spriteSelected = new PIXI.Sprite(texSelected);//PIXI.Texture.WHITE);
    spriteSelected.alpha = 0.9;
    // spriteSelected.width = 100;
    // spriteSelected.height = 100;
    spriteSelected.anchor.set(0.5, 0.5);
    // spriteSelected.tint = 0x302a30;
    NodePixiObject.SPRITE_SELECTED = spriteSelected;
})();

/**
 * Generates a symmetrical (x == y) PIXI.Point from the provided number.
 * @param {number} num 
 * @returns {PIXI.Point}
 */
function symPoint(num) {
    return new PIXI.Point(num, num);
};
// NodePixiObject.searchMatchTexture = testTexture;

/**
 * 
 * @param {Object} node a Node Data object
 */
function getNodeExternalLinks(node) {
    // const regionCode = 'us'
    let poeDBLink, poeWikiLink;
    if (node.IsUniqueMapArea) {//${regionCode}
        poeDBLink = `http://www.poedb.tw/unique.php?n=${encodeURI(node.internalName.replace(/_/g,"+"))}`;
        poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(node.internalName)}`;
    } else {
        poeDBLink = `http://www.poedb.tw/${node.internalName}`;
        poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(node.internalName)}_Map`; 
    }
    
    return { poeDBLink, poeWikiLink };
}

/**
 * Convert an exact Map Node display name (without "map") (with spaces) to a
 * PoEDB link node-name token
 * 
 * @param {string} strName 
 * @param {boolean} isUnique 
 * 
 * @returns {string} a PoEDB link node-name token
 */
function toPoEDBName(strName, isUnique=false) {
    if (isUnique) {
        strName = (strName === "The Hall of Grandmasters") ? "Hall of Grandmasters" : strName;
        strName = (strName === "Perandus Manor") ? "The Perandus Manor" : strName;
    } else {
        // strName = `${strName} Map`;
    }
    return strName;
}
/**
 * Preload static graphics and create all nodePixiObjects.
 */
function preloadStaticGraphics() {
    //Init main container object
    nodePixiObjects = [];
    //Set text display options
    const fontSize = 18;
    // TODO: Use the font that PoE Uses
    const fontFamily = 'Fontin-Regular';
    const tierFontStyle = 'bold';
    const nameFontStyle = 'bold';
    const textResolution = 3;
    const nameTextStyleBlack = {
        fontFamily : fontFamily,
        fontSize: fontSize-4,
        fontStyle: nameFontStyle,
        fill : 0x000000,
    };

    // Static generic nodeCirleGraphics (In case images cannot be loaded)
    let nodeCircleTex = preloadNodeCircleTextures();

    // Preload Tier Textures
    preloadTierTextures(fontSize, fontFamily, tierFontStyle, textResolution);
    // Init NodePixiObjects and Generate nameSprites for each node
    for (let i=0; i<nodeData.length; i++) {
        let cNodeData = nodeData[i];

        //Load Name Sprites
        let nameSprite = new PIXI.Text(cNodeData.Name, nameTextStyleBlack);
        nameSprite.resolution = textResolution;

        // Placeholder node texture
        let tempTex = cNodeData.IsUniqueMapArea ? nodeCircleTex.unique : nodeCircleTex.normal;

        //Add the constructed Node object to the global list.
        nodePixiObjects.push(new NodePixiObject(nameSprite, cNodeData, tempTex));        
    }
    updateNodeSize();
    updateNodesTextScale();
    //===========
    // FUNCTIONS
    //===========
    function preloadNodeCircleTextures() {
        const lineStyle = {
            width: 4,
            color: 0x222222,
            alpha: 1,
            native: false
        }
        const nodeImgRad = 78/2;
        let nodeGraph = new PIXI.Graphics();
        nodeGraph.lineStyle(lineStyle)
            .beginFill('0x555555', 1)
            .drawCircle(0, 0, nodeImgRad);
        const uniqueNodeImageRad = 47/2;
        let uniqueNodeGraph = new PIXI.Graphics();
        uniqueNodeGraph.lineStyle(lineStyle)
            .beginFill('0x554411', 1)
            .drawCircle(0, 0, uniqueNodeImageRad);
    
        const texSizeNormal = nodeImgRad * 2 + lineStyle.width;
        const texSizeUnique = uniqueNodeImageRad * 2 + lineStyle.width;
        const res = 2;
        
        let normalTex = PIXI.RenderTexture.create({ width: texSizeNormal, height: texSizeNormal, resolution: res});
        normalTex.defaultAnchor = new PIXI.Point(0.5, 0.5);
        nodeGraph.position.set(texSizeNormal/2, texSizeNormal/2);

        let uniqueTex = PIXI.RenderTexture.create({ width: texSizeUnique, height: texSizeUnique, resolution: res});
        uniqueTex.defaultAnchor = new PIXI.Point(0.5, 0.5);
        uniqueNodeGraph.position.set(texSizeUnique/2, texSizeUnique/2);

        app.renderer.render(nodeGraph, normalTex);
        app.renderer.render(uniqueNodeGraph, uniqueTex);
        
        return {
            normal: normalTex,//nodeGraph,//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res),
            unique: uniqueTex//uniqueNodeGraph//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res)
        };
    }

    function preloadTierTextures(fontSize, fontFamily, fontStyle, textResolution) {
        const textStyleRed = {
            fontFamily: fontFamily,
            fontSize: fontSize*textResolution,
            fontStyle: fontStyle,
            // fill : 0xcc1010,
            fill : 0xee0000,
        };
        const textStyleYellow = {
            fontFamily: fontFamily,
            fontSize: fontSize*textResolution,
            fontStyle: fontStyle,
            fill: 0xdddd00,
        };
        const textStyleWhite = {
            fontFamily: fontFamily,
            fontSize: fontSize*textResolution,
            fontStyle: fontStyle,
            fill: 0xffffff,
        };
    
        nodeTierTextures = [];
        const textureSize = 64;
        for (let i=1; i<=16; i++) {
            let tierSprite = new PIXI.Text(i);
            tierSprite.resolution = 1//textResolution;
            if (i > 10) {
                tierSprite.style = textStyleRed;
            } else if (i > 5) {
                tierSprite.style = textStyleYellow;
            } else {
                tierSprite.style = textStyleWhite;
            }
            tierSprite.anchor.set(0.5,0.5);
            tierSprite.position.set(textureSize/2, textureSize/2);
            let renderTexture = PIXI.RenderTexture.create({width:textureSize, height:textureSize});
            // renderTexture.resolution = 1//textResolution;
            app.renderer.render(tierSprite, renderTexture);
    
            nodeTierTextures.push(renderTexture);
        }
        return nodeTierTextures;
    }
    updateNodesVisibility();
}

var TIMERS_PRINT_ENABLED = false;
class Timer {
    constructor(name) {
        this.count = 0;
        this.avg = 0;
        this.lastTime = 0;
        this.name = name;

        this.startTime = 0;
    }

    start() {
        this.startTime = window.performance.now();
    }
    end() {
        this.addTime(window.performance.now() - this.startTime);
    }
    addTime(time) {
        this.count += 1;
        this.avg = (this.avg*(this.count-1) + time)/ this.count;    
        this.lastTime = time;
        if (TIMERS_PRINT_ENABLED) {
            this.printInstance();
            this.printAverage();
        }
    }

    printInstance() {
        console.log(`[Timer][I] ${this.name}: ${this.lastTime.toFixed(2)} ms`);
    }
    printAverage() {
        console.log(`[Timer][A] ${this.name}: ${this.avg.toFixed(2)} ms`);
    }
}
var perfTimers = {
    allRegionsUpdate: new Timer("Update All AtlasRegions"),
    regionsRender: new Timer("Render AtlasRegions")
}
/**
 * Calls drawAtlasRegion on all regions.
 * @see {drawAtlasRegion} for more information.
 */
function drawAllAtlasRegions() {
    perfTimers.allRegionsUpdate.start();
    for(let i=0; i<NUM_REGIONS; i++) {
        drawAtlasRegion(i, false, false);
    }
    perfTimers.allRegionsUpdate.end();

    perfTimers.regionsRender.start();
    app.renderer.render(app.stage);
    perfTimers.regionsRender.end();
}

/**
 * Builds the graphics for the specified atlas region based that region's 
 * current tier (watchstone level).
 * 
 * Manages lines between the nodes and some elements of the nodes themselves 
 * 
 * Will redraw adjacent regions in order to update the connecting lines 
 * if necessary (unless disabled). 
 * 
 * @param {number} regionID 
 * @param {boolean} redrawAdjacent 
 * @param {boolean} renderOnComplete 
 */
function drawAtlasRegion(regionID, redrawAdjacent=false, renderOnComplete=true) {
    //Remove previous nodes and lines for this region.
    // Clear the lines graphics
    let regionLinesGraph = linesContainer.getChildAt(regionID).clear();
    regionLinesGraph.lineStyle(lineThickness, lineColor);
    // The nodesContainer can be cached...
    let regionNodesContainer = nodesContainer.getChildAt(regionID);
    regionNodesContainer.removeChildren();

    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];

    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    // TODO Make these constants user-configurable (Perhaps an "advanced options" pane, same w/ nodeHover)

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let nodeID = region[i];
        let cNode = getNodeByID(nodeID);
        //Node location and neighbor IDs
        let tieredNodeData = getTieredNodeData(cNode);

        //if node exists at this tier
        if (tieredNodeData.tier > 0) {
            //Draw Connecting Lines between nodes (PIXI.Graphics)
            if (optsMgr.currentOptions.drawLines) {
                for (let i=0; i<tieredNodeData.atlasNodeKeys.length; i++) {
                    let adjNodeID = tieredNodeData.atlasNodeKeys[i];
                    let adjNodeData = getNodeByID(adjNodeID);
                    let adjTieredNodeData = getTieredNodeData(adjNodeData);

                    //Draw Lines
                    let startX = tieredNodeData.x,
                        startY = tieredNodeData.y,
                        endX = adjTieredNodeData.x,
                        endY = adjTieredNodeData.y;

                    regionLinesGraph.moveTo(startX, startY)
                        .lineTo(endX, endY);

                    //Redraw adjacent region if not already done.
                    if (redrawAdjacent) {
                        let adjNodeRegionKey = adjNodeData.AtlasRegionsKey;
                        if (regionsRedrawn[adjNodeRegionKey] === false) {
                            regionsRedrawn[adjNodeRegionKey] = true;
                            drawAtlasRegion(adjNodeRegionKey, false, false);
                        }
                    }
                }
            }

            //Draw Nodes on 'regionNodesGraph'
            let nodePixiObj = nodePixiObjects[nodeID];
            if (optsMgr.currentOptions.drawNodes && nodePixiObj) {
                let nodeContainer = nodePixiObj.container;
                nodeContainer.position.set(tieredNodeData.x, tieredNodeData.y)
                nodeContainer.scale = NodePixiObject.CONTAINER_SCALE;

                if (sheet && sheet.textures) {
                    nodePixiObj.imgSprite.texture = nodePixiObj.getSpriteImg(tieredNodeData.tier, true);
                }

                //Add node tier text sprites to 'nodeContainer'
                if (optsMgr.currentOptions.drawTiers || optsMgr.currentOptions.nodeHover) {
                    let tierSprite = nodePixiObj.tierSprite;
                    tierSprite.texture = nodeTierTextures[tieredNodeData.tier-1];
                }
                
                // nodePixiObj.backgroundContainer.scale = NodePixiObject.BACKGROUND_SCALE;

                regionNodesContainer.addChild(nodeContainer);
            }
        }
        
    }

    //Force immediate stage render
    if (renderOnComplete)
        app.renderer.render(stage);
}

// Returns an array of length 3 based on the supplied region tier.
// Format: [node_x_pos, node_y_pos, [list_of_neighbor_node_ids]]
/**
 * Gets the node data object associated with the specified nodeID
 * @param {number} nodeID 
 * @returns {object} a node data object
 */
function getNodeByID(nodeID) {
    return nodeData[nodeID];
}
/**
 * Gets the current tier (watchstone level) of the region to which 
 * the specfied node belongs.
 * @param {object} nodeObject a node data object 
 * @returns {number} a region tier
 */
function getNodeRegionTier(nodeObject) {
    return regionTiers[nodeObject.AtlasRegionsKey];
}
class TieredNodeData {
    constructor(tier, atlasNodeKeys, x, y) {
        this.tier = tier;
        this.atlasNodeKeys = atlasNodeKeys;
        this.x = x;
        this.y = y;
    }
}

/**
 * Gets the tier-dependent data of the specified node, with the
 * tier of the node determined by current watchstone level of the
 * region to which the node belongs. (Gets correct tier for current
 * Atlas state)
 * 
 * @param {object} node a node data object
 * @returns {TieredNodeData}
 */
function getTieredNodeData(node) {
    let tData = node.TieredData[regionTiers[node.AtlasRegionsKey]];
    return new TieredNodeData(
        tData.Tier,
        tData.AtlasNodeKeys,
        tData.X*mapScaleFactor+nodeCenterOffset,
        tData.Y*mapScaleFactor+nodeCenterOffset
    );
}

/**
 * A debounced function (50ms) that calls updateNodeGraphics on
 * all nodePixiObjects, and then renders the stage (throttled)
 * 
 * @type {function}
 */
var updateAllNodeGraphics = debounce(() => {
    if (nodePixiObjects) {
        for (const obj of nodePixiObjects) {
            obj.updateNodeGraphics();
        }
        renderStageThrottled();
    }
}, 50)
function updateNodesVisibility() {
    //lines, nodes, hover, names, tiers, scaleFactor
    console.time("updateNodesVisibility");
    if (nodePixiObjects) {
        for (let i = 0; i < nodePixiObjects.length; i++) {
            let nodePixiObj = nodePixiObjects[i];
            nodePixiObj.container.visible = optsMgr.currentOptions.drawNodes;
            nodePixiObj.tierSprite.visible = optsMgr.currentOptions.drawTiers;
            nodePixiObj.nameContainer.visible = optsMgr.currentOptions.drawNames;
        }
    }    
    console.timeEnd("updateNodesVisibility");
}

//Stores the position of the center of the PIXI canvas, not the window.
/**
 * Updates values that are dependent on the window size.
 */
function onWindowResize() {
    let innerHeight = CONTAINER_ELEMENT.clientHeight;
    let innerWidth = CONTAINER_ELEMENT.clientWidth;
    let nonAtlasContentHeightSum = document.getElementsByTagName("header")[0].offsetHeight
        + document.getElementsByTagName("footer")[0].offsetHeight;
    let nonAtlasContentWidthSum = 0;
    pixiScreenH = innerHeight;//window.innerHeight-nonAtlasContentHeightSum;
    pixiScreenW = innerWidth;//window.innerWidth-nonAtlasContentWidthSum;

    if (pixiScreenH > pixiScreenW) {
        pixiAtlasW = pixiScreenW;
        pixiAtlasH = pixiScreenW*(maxH/maxW);
    } else {
        pixiAtlasH = pixiScreenH;
        pixiAtlasW = pixiScreenH*(maxW/maxH);
    }
    
    app.renderer.resize(pixiScreenW, pixiScreenH);

    mapScaleFactor = (pixiAtlasW + pixiAtlasH)/(maxH+maxW)*4;
    
    nodeCenterOffset = 25/4 * mapScaleFactor;
    lineThickness = 2.5/4 * mapScaleFactor;

    // resizePixiDisplayObjects
    atlasSprite.updateScale();
    atlasSprite.updatePosition();

    let containerScale = new PIXI.Point(maxW/pixiAtlasW, maxH/pixiAtlasH);
    linesContainer.scale.copyFrom(containerScale);
    nodesContainer.scale.copyFrom(containerScale);
    watchstonesContainer.scale.copyFrom(containerScale);

    // Update NodePixiObjs
    NodePixiObject.CONTAINER_SCALE = symPoint(optsMgr.currentOptions.nodeScaleFactor * mapScaleFactor),

    watchstones.updatePositions();
    drawAllAtlasRegions();
    updateAllNodeGraphics();
}



/**
 * Add the constructed menu to the DOM.
 */
function addDropdownToDOM(button, container, content) {
    if (content) {
        container.appendChild(content);
    }
    
    button.addEventListener('click', (e) => {
        if (container.className.includes("hidden"))
            container.className = container.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );
        else
            container.className = container.className +" hidden";
    });
    document.addEventListener('click', (e) => {
        if (!(container.contains(e.target) || button.contains(e.target))) {
            if (!container.className.includes("hidden"))
                container.className = container.className +" hidden";
        }
    });
}
/**
 * Adds all generated HTML to DOM
 */
function addAllToDOM() {
    addDropdownToDOM(
        document.getElementById("help_button"),
        document.getElementById("help_content"),
        null
    );
    addDropdownToDOM(
        document.getElementById("options_button"),
        document.getElementById("options_content"),
        createOptionsMenu(optsMgr)
    );
}

//=========
// Utility
//=========
function renderStage() { app.renderer.render(stage) };
var renderStageThrottled = () => requestAnimationFrame(renderStage);
// throttle(
//     () => app.renderer.render(stage),
//     MIN_FRAME_TIME
// );

// Bind search results interactables
executeIfWhenDOMContentLoaded(() => {
    const search_results = document.getElementById("search_results");
    const show_btn = document.getElementById("show_results_btn");
    const exit_btn = document.getElementById("search_exit");

    const showHide = () => {
        if (search_results.className.includes("hidden")) {
            search_results.className = search_results.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );
            show_btn.innerText = "Hide Results";
        } else {
            search_results.className = search_results.className +" hidden";
            show_btn.innerText = "Show Results"
        }
    };
    show_btn.addEventListener('click', showHide);

    exit_btn.addEventListener('click', showHide);
});
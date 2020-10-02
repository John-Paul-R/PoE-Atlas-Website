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
// Module Imports
//================
import { initSearch } from './atlas_search.js';
import { initZoomPanInput, bindZoomPanInput } from './graphics_zoom_pan.js';
// import { logger } from './logger.js';
import { throttle, debounce } from './util.js';

//===========
//  Globals
//===========
//Render Toggles
var options;
var optionsElements;

//The minimum allowable time between stage renders. (Calls made while the function is on cooldown are ignored.)
const MIN_FRAME_TIME = 1000/60;//(60fps)

//Parsed json data file w/ map positions & other node data
export var nodeData;
var atlasRegions;
//The main sprite for the Atlas. (background image)
let atlasSprite;
//Self explanatory.
let linesContainer;
let nodesContainer;
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
var CONTAINER;
//The center position of the PIXI canvas. Updates automatically when resized.
let midx = 0;
let midy = 0;
// Center position for pixi objects that are children of atlasSprite (has x & y)
const atlasScreenMid = {}

window.addEventListener('DOMContentLoaded', ()=>{
    //// Load Pixi App
    //Load User Options
    loadDisplayOptions();
    // Add runtime-generated HTML elements to DOM
    addAllToDOM();
});
//Create the Pixi Application
var app, stage, loader;
console.log("Creating PIXI Atlas app.");
setTimeout(()=> {
    app = new PIXI.Application({
        width: pixiAtlasW,
        height: pixiAtlasH,
        autoStart: false,
        antialias: true,
        sharedLoader: true,
        sharedTicker: false,
        resolution: devicePixelRatio 
    });
    app.stage = new PIXI.display.Stage();
    stage = app.stage;
});

//Load Pixi resources
loader = PIXI.Loader.shared;
loader.onComplete.once(createPixiView);
let timers = []
loader.onStart.add((resource)=>{
    console.timeLog("load");
    for (let value of Object.values(resource.resources)) {
        if (value.name) {
            timers.push(value.name);
            console.time(value.name)
        }
    }
})
loader.onLoad.add((resource)=>{
    for (let value of Object.values(resource.resources)) {
        let index = timers.indexOf(value.name);
        if (index >= 0) {
            timers.pop(index)
            console.timeEnd(value.name);
        }
    }
})
loader
    .add("img/Atlas47kb.webp")
    .load(setup);
//===========
// Functions
//===========
function setup(loader, resources) {
    loader.reset();
    console.timeLog("load");
    app.ticker.stop();
    PIXI.Ticker.shared.autoStart = false;
    PIXI.Ticker.shared.stop();

    //==================
    //  Initialization
    //==================
    initPixiDisplayObjects(resources);

    //Queue next resources for loading
    loader.add("pixi/node_spritesheet-heist-1.json")
        .load(()=>{
            console.timeLog("load");
            //TODO make sure this waits for nodeData to exist...
            sheet = loader.resources["pixi/node_spritesheet-heist-1.json"];
            spritesheetLoaded = true;
            drawAllAtlasRegions();
            loader.reset();
            loader.add("img/Atlas80.webp").load(()=>{
                atlasSprite.texture = loader.resources["img/Atlas80.webp"].texture;
                //DEBUG
                console.timeEnd("load");
                renderStage();
            });
        });
    loadMapsData();

    //Bind input to Atlas
    bindZoomPanInput(atlasSprite, getAtlasSpriteScale, getAtlasSpritePosition);
    initZoomPanInput(app, renderStageThrottled);

    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish
    // setTimeout(()=>atlasSprite.texture = app.loader.resources["img/Atlas.jpg"].texture, 0);
    app.renderer.render(stage);
    onWindowResize();
    // createPixiView();
    window.addEventListener('resize', onWindowResizeDebounced);
    // initAtlasTierButtons();
    
    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}
function createPixiView() {
    console.time("load");
    //Add the canvas that Pixi automatically created for you to the HTML document
    CONTAINER = document.getElementById("atlas_of_worlds")
    CONTAINER.appendChild(app.view);
    CONTAINER.lastChild.className = "pixi_atlas_of_worlds";
}

function resizePixiDisplayObjects() {
    atlasSprite.scale.copyFrom(getAtlasSpriteScale());
    atlasSprite.position.copyFrom(getAtlasSpritePosition());

    let containerScale = getAtlasContainersScale();
    linesContainer.scale.copyFrom(containerScale);
    nodesContainer.scale.copyFrom(containerScale);

    let containerPos = getAtlasContainersPosition();
    linesContainer.position.copyFrom(containerPos);
    nodesContainer.position.copyFrom(containerPos);

    watchstonesContainer.scale.copyFrom(containerScale);
    watchstonesContainer.position.copyFrom(containerPos);
}

function getAtlasContainersScale() {
    return {
        x: maxW/pixiAtlasW,
        y: maxH/pixiAtlasH
    };
}
function getAtlasContainersPosition() {
    return {
        x: 0,
        y: 0
    };
}
function getAtlasSpriteScale() {
    return {//Adjust for Atlas img size being large
        x: pixiAtlasW/maxW,
        y: pixiAtlasH/maxH
    };
}
function getAtlasSpritePosition() {
    return {
        x: (app.screen.width-pixiAtlasW)/2,
        y: (app.screen.height-pixiAtlasH)/2
    };
}

var spritesheetLoaded = false
var sheet;
function initPixiDisplayObjects(resources) {
    //Create main Atlas sprite
    atlasSprite = new PIXI.Sprite(resources["img/Atlas47kb.webp"].texture);

    // atlasSprite = new PIXI.Sprite();
    //Add Atlas sprite to stage
    stage.addChildAt(atlasSprite, 0);

    initPixiContainers();
    // Init all atlas regions
    for (let i = 0; i < NUM_REGIONS; i++) {
        initAtlasRegion(i);
    }
}
var unfocusedNodesContainer;
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
const NUM_REGIONS = 8;

var watchstoneButtons;
var masterButton;
function initWatchstones() {
    const WATCHSTONE_TEXT_RESOLUTION = 3;
    const padding = 6;

    masterButton = new PIXI.Graphics();
    const mText = new PIXI.Text("Cycle All Region Tiers", {
        fontSize: 18,
        align: "center",
        fontWeight: "bold",
        
    });
    mText.resolution = WATCHSTONE_TEXT_RESOLUTION;
    masterButton.lineStyle(lineThickness/mapScaleFactor, '0x0', 1, 0.5, false)
    mText.anchor.set(0.5, 0.5);
    masterButton.addChild(mText);
    let mW = (mText.width + padding),
        mH = (mText.height + padding);
    masterButton.beginFill('0xffffff',1)
        .drawRect(-mW/2, -mH/2, mW, mH);

    watchstoneButtons = []
    for (let i=0; i < NUM_REGIONS; i++) {
        let button = new PIXI.Graphics();
        let bText = new PIXI.Text("", {
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

        watchstoneButtons.push(button);
        watchstonesContainer.addChild(button);
    }
    
    //init "master" tier button (cycle all nodes) click function
    masterButton.interactive = true;
    masterButton.buttonMode = true;    
    masterButton.on("pointertap", cycleAllAtlasRegionTiers);
    watchstonesContainer.addChild(masterButton);
    masterButton.position.set(0, 0);

    function cycleAtlasRegionTier(regionID, boolDrawRegion=true) {
        if (regionTiers[regionID] < 4) {
            regionTiers[regionID] += 1;
        } else {
            regionTiers[regionID] = 0;
        }
        //Update corresponding button label
        watchstoneButtons[regionID].textSprite.text = atlasRegions[regionID].Name+"\nTier "+regionTiers[regionID];
        //Redraw this region & adjacent regions
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

    positionWatchstones();
    updateWatchstoneVisibility();
}

function positionWatchstones() {
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
    if (watchstoneButtons) {
        const btnScale = 0.6;
        for(let i=0; i<watchstoneButtons.length; i++) {
            for (let key of posKeys) {
                if (key === atlasRegions[i].Id) {
                    let loc = watchstoneLocations[key];
                    watchstoneButtons[i].position.set(loc.x*mapScaleFactor, loc.y*mapScaleFactor);
                    watchstoneButtons[i].scale.set(btnScale*mapScaleFactor)
                    break;
                }
            }
        }
        masterButton.position.set(pixiAtlasW/2, pixiAtlasH/2);
        masterButton.scale.set(btnScale*mapScaleFactor);
    }
}
function updateWatchstoneVisibility() {
    for(let i=0; i<watchstoneButtons.length; i++) {
        watchstoneButtons[i].visible = options.Watchstones;
    }
    masterButton.visible = options.MasterWatchstone;
}
//Factor by which to multiply node positions from the data file when drawing
export function getMapScaleFactor() {
    return mapScaleFactor;
}
var mapScaleFactor;// = pixiAtlasW/maxW*4;//4.05;
window.addEventListener('DOMContentLoaded', loadRegionTiers);
var regionTiers = []; //Tiers of each region (array index = regionID)
var regionNodes = [[], [], [], [], [], [], [], []]; //lists of nodes(IDs) in each region
var regions = [{}, {}, {}, {}, {}, {}, {}, {}]
class Region {
    constructor(tier=0, nodes=[], name="") {
        this.nodes = nodes;
        this.tier = tier;
        this.name = name;
    }
}
for (let i=0; i < NUM_REGIONS; i++) {
    regions.push(new Region())
}

var nodeTierTextures;
export var nodePixiObjects;
var nodeInfoSidebar;
document.addEventListener('DOMContentLoaded', ()=>nodeInfoSidebar={
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
class NodePixiObject {
    constructor(nameSprite, data) {
        this.container = new PIXI.Container();
        this.container.parentGroup = unfocusedNodesContainer;
        //Placeholder img sprite
        this.imgSprite = new PIXI.Sprite();
        this.imgSprite.anchor.set(0.5);

        // Temp, until I figure out how to load placeholder circleSprite from graphics effieciently via RenderTexture
        this.circleSprite = this.imgSprite;
        
        if (options.nodeHover) {
            this.circleSprite.interactive = true;
            this.circleSprite.buttonMode = true;
            const scaleMult = 1.325;
            this.circleSprite.pointerover = ()=>{
                this.gainLightFocus(scaleMult);
                app.renderer.render(stage);
            };
            this.circleSprite.pointerout = (mouseData)=>{
                this.loseLightFocus(scaleMult);
                app.renderer.render(stage);
            };
        }

        this.circleSprite.pointertap = ()=>this.onSelect();
        // this.circleSprite = circleSprite;
        
        this.container.addChild(this.circleSprite);

        this.nameContainer = new PIXI.Container();
        
        this.nameSprite = nameSprite;
        this.nameContainer.addChild(this.nameSprite);
        this.container.addChild(this.nameContainer);

        //Preload Node Tier Sprites
        this.tierSprite = new PIXI.Sprite.from(
            nodeTierTextures[data.TieredData[0].Tier]
        );
        this.container.addChild(this.tierSprite);
        this.tierSprite.anchor.set(0.5,0);

        this.data = data;
        this.additionalGraphics = new PIXI.Container();
        this.container.addChild(this.additionalGraphics);
    }

    gainLightFocus(scaleMult, hoverGraphic) {
        this.container.scale.x *=scaleMult;
        this.container.scale.y *=scaleMult;
        this.container.zIndex = 1;
        this.nameContainer.visible = true;
        let nameBG = new PIXI.Sprite(PIXI.Texture.WHITE);
        nameBG.width = this.nameSprite.width, nameBG.height = this.nameSprite.height;
        nameBG.anchor.set(0.5,1);
        this.nameContainer.addChildAt(nameBG, 0);
        this.tierSprite.visible = true;
        this.container.parentGroup = focusedNodesContainer;
        if (hoverGraphic) {
            this.additionalGraphics.addChild(hoverGraphic);
        }
    }

    loseLightFocus(scaleMult, clearHoverGraphic, forceBaseScale) {
        this.container.scale.x /= scaleMult;
        this.container.scale.y /= scaleMult;
        this.container.zIndex = 0;
        this.nameContainer.visible = options.drawNames;
        if (this.nameContainer.children.length > 1)
            this.nameContainer.removeChildAt(0);
        this.tierSprite.visible = options.drawTiers;
        this.container.parentGroup = unfocusedNodesContainer;
        if (clearHoverGraphic) {
            this.additionalGraphics.children.forEach((el)=>el.destroy());
        }
        if (forceBaseScale) {
            this.container.scale.set(options.nodeScaleFactor, options.nodeScaleFactor);
        }
    }

    onSelect() {
        // Info sidebar
        const sidebar = nodeInfoSidebar;
        // Info sidebar close button
        document.getElementById("node_exit").addEventListener('click', (e)=>{
            if (!sidebar.container.className.includes("hidden"))
                sidebar.container.className = sidebar.container.className +" hidden";
        });

        // console.log(this.data);
        // console.log(this.data.poeDBLink);
        // Show info sidebar if it is hidden
        sidebar.container.className = sidebar.container.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );
        
        sidebar.name.innerText = this.data.Name;
        let nodeExternalLinks = getNodeExternalLinks(this.data);
        sidebar.poedb.href = nodeExternalLinks.poeDBLink;
        sidebar.poewiki.href = nodeExternalLinks.poeWikiLink;
        sidebar.region.innerText = "Region: " + atlasRegions[this.data.AtlasRegionsKey].Name;
        sidebar.icon.src = this.getImgBase64(getTieredNodeData(this.data).tier);//buildCDNNodeImageLink(this.data, 0, 8, getTieredNodeData(this.data).tier);
        const tds = sidebar.tiers.getElementsByTagName('td');
        for (let i=0; i < tds.length; i++) {
            let tier = this.data.TieredData[i].Tier;
            tds[i].innerText = tier <= 0 ? "-" : tier;
        }
        let connectionsData = this.data.TieredData[4].AtlasNodeKeys;
        let connectionsText = "";
        for (let i=0; i < connectionsData.length; i++) {
            connectionsText += getNodeByID(connectionsData[i]).Name;
            if (i < connectionsData.length-1) {
                connectionsText += ", ";
            }
        }
        sidebar.connections.innerText = connectionsText;

    }
    getSpriteImg(tier=0) {
        let strTier;
        if (this.data.IsUniqueMapArea) {
            strTier = "";
        } else {
            if (tier < 6)
                strTier = "-t0";
            else if (tier < 11)
                strTier = "-t1";
            else
                strTier = "-t2";
        }
        
        let out = this.data.interalName+strTier+".png"
        // console.log(out);
        return sheet.textures[out];
    }
    getImgBase64(tier=0) {
        return app.renderer.extract.base64(
            PIXI.Sprite.from(this.getSpriteImg(tier)),
            'image/png',
            1
        );
    }
}

class PoECDN {

    constructor (defaultScale, defaultLeague, defaultTier) {
        this.defaultScale = defaultScale;
        this.defaultLeague = defaultLeague;
        this.defaultTier = defaultTier;
        this.baseNormalLink = "https://web.poecdn.com/image/Art/2DItems/Maps/Atlas2Maps/New/"
        this.baseUniqueLink = "https://web.poecdn.com/gen/image/"
    
    }

    buildNodeImageLink(nodeData, scale=0, league=0, tier=0) {
        const cdnScale = "scale=";
        const cdnLeague = "mn="
        const cdnTier = "mt="
        let out;
        if (nodeData.IsUniqueMapArea) {
            out =   this.baseUniqueLink + nodeData.cdnKey
                    +'?'+cdnScale + scale;
        } else {
            // Handle Vaal Temple
            if (nodeData.RowID === 8) {
                tier=0;
            }
            out =   this.baseNormalLink + nodeData.cdnKey
                    +'?'+cdnScale + scale
                    +'&'+cdnLeague + league
                    +'&'+cdnTier + tier;
        }
        return out;
    }

    keyFromLink(link) {
        let out = link.includes(this.baseNormalLink) ? link.replace(this.baseNormalLink, '') : link.replace(this.baseUniqueLink, '');
        return out.replace(/\?scale.*/g, "");
    }
}

var poecdnHelper = new PoECDN(0, 0, 0);

function toPoEDBName(strName, isUnique=false) {
    if (isUnique) {
        strName = (strName === "The Hall of Grandmasters") ? "Hall of Grandmasters" : strName;
        strName = (strName === "Perandus Manor") ? "The Perandus Manor" : strName;
    } else {
        strName = `${strName} Map`;
    }
    return strName;
}
function getNodeExternalLinks(node) {
    // const regionCode = 'us'
    let poeDBLink, poeWikiLink;
    if (node.IsUniqueMapArea) {//${regionCode}
        poeDBLink = `http://www.poedb.tw/unique.php?n=${encodeURI(node.interalName.replace(/_/g,"+"))}`;
        poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(node.interalName)}`;
    } else {
        poeDBLink = `http://www.poedb.tw/${node.interalName}`;
        poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(node.interalName)}`; 
    }
    
    return { poeDBLink, poeWikiLink };
}
//Request map data, parse it, and draw all Atlas regions for the 1st time.
function loadMapsData(loader, resources, atlasSprite) {
    let nodeImagesDict;
    let nodeImagesDictResponseReceived = false;
    let nodeDataResponseReceived = false;
    const allResponsesReceivedOps = (nodeImagesDict) => {
        // for (const [key, elem] of Object.entries(nodeImages)) {
        //     resetOption(key);
        // }
        if (nodeImagesDictResponseReceived && nodeDataResponseReceived) {
            console.log(nodeImagesDict);
            let erroredNames = []
            console.groupCollapsed("CDN Key Error Log");
            
            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                try {
                    entry.cdnKey = poecdnHelper.keyFromLink(nodeImagesDict[toPoEDBName(entry.Name, entry.IsUniqueMapArea)].Icon);
                    // console.log(`${entry.Name}: ${entry.cdnKey}`);
    
                } catch (error) {
                    erroredNames.push(entry.Name)
                    console.log(`Error finding matching icon for ${entry.Name}.`)
                    console.error(error);
                }
            }
            console.groupEnd();
            if (erroredNames.length > 0) {
                console.warn(`Failed to load ${erroredNames.length} node names/cdnKeys.`)
            } else {
                console.info("All node names & cndKeys loaded successfully! (in theory)")
            }    
        }
    }

    let nodeDataRequest = new XMLHttpRequest();
    nodeDataRequest.open("GET", "data/AtlasDataCombined_Itemized-1600754911.json", true);
    nodeDataRequest.send(null);
    nodeDataRequest.onreadystatechange = function() {
        if ( nodeDataRequest.readyState === 4 && nodeDataRequest.status === 200 ) {
            nodeDataResponseReceived = true;
            //Parse response contents
            let combinedData = JSON.parse(nodeDataRequest.responseText);
            nodeData = combinedData["AtlasNode+WorldAreas"];
            atlasRegions = combinedData["AtlasRegions.dat"];
            initSearch(nodeData);
            initWatchstones();
            preloadStaticGraphics();
            //Draw Atlas Nodes & Lines
            drawAllAtlasRegions();
            //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
            //  http request is async. The resources wouldn't necessarily be loaded when the...
            //  drawAllAtlasRegions function is called.)

            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)

            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
                entry.interalName = toPoEDBName(entry.Name, entry.IsUniqueMapArea).replace(/ /g,"_");
                
            }

            allResponsesReceivedOps(nodeImagesDict);
        }
    }
    //send next request
    //TODO make sure this waits for the other request, OR combine with base data file in backend
    let nodeImagesDictRequest = new XMLHttpRequest();
    nodeImagesDictRequest.open("GET", "data/Maps155-DICT-heist-1.json", true);
    nodeImagesDictRequest.send(null);
    nodeImagesDictRequest.onreadystatechange = function() {
        if ( nodeImagesDictRequest.readyState === 4 && nodeImagesDictRequest.status === 200 ) {
            nodeImagesDictResponseReceived = true;
            nodeImagesDict = JSON.parse(nodeImagesDictRequest.responseText);
            allResponsesReceivedOps(nodeImagesDict);
        }
    }
}

function preloadStaticGraphics() {
    //Init main container object
    nodePixiObjects = [];
    //Set text display options
    const fontSize = 18;//*mapScaleFactor/4
    // TODO: Use the font that PoE Uses
    const fontFamily = 'Arial';
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
    //let nodeCircleGraphs = preloadNodeCircleGraphics();

    // Preload Tier Textures
    preloadTierTextures(fontSize, fontFamily, tierFontStyle, textResolution);
    // Init NodePixiObjects and Generate nameSprites for each node
    for (let i=0; i<nodeData.length; i++) {
        let cNodeData = nodeData[i];
        let nameSprite, data;
        data = cNodeData;

        // //Load Node Circle Sprites
        // let circleSprite;
        // // let nodeNameU = cNodeData.Name.replace(/ /g,"_");
        // if (cNodeData.IsUniqueMapArea) {
        //     circleSprite = nodeCircleGraphs.unique.clone();
        // } else {
        //     circleSprite = nodeCircleGraphs.normal.clone();
        // }

        //Load Name Sprites
        nameSprite = new PIXI.Text(cNodeData.Name, nameTextStyleBlack);
        nameSprite.resolution = textResolution;
        nameSprite.anchor.set(0.5,1);

        //Add the constructed Node object to the global list.
        nodePixiObjects.push(new NodePixiObject(nameSprite, data));
    }
    
    //===========
    // FUNCTIONS
    //===========
    function preloadNodeCircleGraphics() {
        let nodeGraph = new PIXI.Graphics();
        nodeGraph.lineStyle(lineThickness, '0x0', 1, 0.5, false)
            .beginFill('0x555555',1)
            .drawCircle(0, 0, 10);
    
        let uniqueNodeGraph = new PIXI.Graphics();
        uniqueNodeGraph.lineStyle(lineThickness, '0x0', 1, 0.5, false)
            .beginFill('0x554411',1)
            .drawCircle(0, 0, 10);
    
        // const renderSize = 128;
        // const scaleMode = PIXI.SCALE_MODES.LINEAR;
        // const res = 1;
        let nodeCircleGraphics = {
            normal: nodeGraph,//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res),
            unique: uniqueNodeGraph//PIXI.RenderTexture.create(renderSize, renderSize, scaleMode, res)
        };
        // app.renderer.render(nodeGraph, nodeCircleTexture.normal);
        // app.renderer.render(uniqueNodeGraph, nodeCircleTexture.unique);
    
        return nodeCircleGraphics;
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

class Timer {
    constructor() {
        this.count = 0;
        this.avg = 0;
    }

    addTime(time) {
        this.count += 1;
        this.avg = (this.avg*(this.count-1) + time)/ this.count;    
    }
}
var perfTimers = {
    allRegionsUpdate: new Timer(),
    renderAllAtlasRegions: new Timer()
}
function drawAllAtlasRegions() {
    var start = window.performance.now();

    for(let i=0; i<NUM_REGIONS; i++) {
        drawAtlasRegion(i, false, false);
    }
    var end = window.performance.now();
    var time = end-start;
    console.log(`[TIMER][I] ALL AtlasRegions: ${time} ms`);
    perfTimers.allRegionsUpdate.addTime(time);
    console.log(`[TIMER][A] Average ALL AtlasRegions: ${perfTimers.allRegionsUpdate.avg} ms`);

    var start = window.performance.now()
    // console.time("Render (drawAllAtlasRegions)");
    app.renderer.render(app.stage);
    // console.timeEnd("Render (drawAllAtlasRegions)");
    var end = window.performance.now();
    var time = end-start;
    console.log(`[TIMER][I] Render AtlasRegions: ${time} ms`);
    perfTimers.renderAllAtlasRegions.addTime(time);
    console.log(`[TIMER][A] Average Render AtlasRegions: ${perfTimers.renderAllAtlasRegions.avg} ms`);
}

// Globals (Display properties)
var nodeCenterOffset;//If I figure out how to scale the source data correctly, 'nodeCenterOffset' probably becomes 0 (and therefore unneeded)
var nodeRadius;
var lineThickness;
const lineColor = 0x333333;//ffffff;
function initAtlasRegion(regionID) {
    
    // //init region lines Graphics object (Lines)
    // regionLinesGraph = new PIXI.Graphics();
    // //init region nodes Graphics object (Nodes)
    // regionNodesContainer = new PIXI.Container();
    // //Enable 'sortableChildren' so we can bring focused nodes to front.
    // regionNodesContainer.sortableChildren = true;
    //Add Nodes and Lines to their respective containers and renderedRegion list
    linesContainer.addChildAt(new PIXI.Graphics(), regionID);
    nodesContainer.addChildAt(new PIXI.Container(), regionID);
    
}
function drawAtlasRegion(regionID, boolRedrawAdjacent=false, renderOnComplete=true) {
    //Remove previous nodes and lines for this region.
    // Clear the lines graphics
    let regionLinesGraph = linesContainer.getChildAt(regionID).clear();//destroy(true, false, false);
    // The nodesContainer can be cached...
    let regionNodesContainer = nodesContainer.getChildAt(regionID);
    regionNodesContainer.removeChildren();//.destroy(true, false, false);

    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];

    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    // TODO Make these constants user-configurable (Perhaps an "advanced options" pane, same w/ nodeHover)
    const
        NAME_SCALE = new PIXI.Point(2/3 * mapScaleFactor, 2/3 * mapScaleFactor),
        IMG_SCALE = new PIXI.Point(1/4 * mapScaleFactor, 1/4 * mapScaleFactor),
        TIER_SCALE = new PIXI.Point(0.15 * mapScaleFactor, 0.15 * mapScaleFactor),
        NAME_Y = 0 - (nodeRadius+nodeCenterOffset/4),
        TIER_Y = nodeRadius + nodeCenterOffset/4;

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let nodeID = region[i];
        let cNode = getNodeByID(nodeID);
        //Node location and neighbor IDs
        let tieredNodeData = getTieredNodeData(cNode);

        //if node exists at this tier
        if (tieredNodeData.tier > 0) {
            //Draw Connecting Lines between nodes (PIXI.Graphics)
            if (options.drawLines) {
                for (let i=0; i<tieredNodeData.atlasNodeKeys.length; i++) {
                    let adjNodeID = tieredNodeData.atlasNodeKeys[i];
                    let adjTieredNodeData = getTieredNodeData(getNodeByID(adjNodeID));

                    //Draw Lines
                    let startX = tieredNodeData.x+nodeCenterOffset,
                        startY = tieredNodeData.y+nodeCenterOffset,
                        endX = adjTieredNodeData.x+nodeCenterOffset,
                        endY = adjTieredNodeData.y+nodeCenterOffset;

                    regionLinesGraph.lineStyle(lineThickness, lineColor)
                        .moveTo(startX, startY)
                        .lineTo(endX, endY);

                    //Redraw adjacent region if not already done.
                    let adjNodeRegionKey = getNodeByID(adjNodeID).AtlasRegionsKey;
                    if (boolRedrawAdjacent && regionsRedrawn[adjNodeRegionKey] === false) {
                        regionsRedrawn[adjNodeRegionKey] = true;
                        drawAtlasRegion(adjNodeRegionKey, false, false);
                    }
                }
            }

            //Draw Nodes on 'regionNodesGraph'
            let nodePixiObj = nodePixiObjects[nodeID];
            if (options.drawNodes) {
                let nodeContainer = nodePixiObj.container;
                nodeContainer.position.set(tieredNodeData.x+nodeCenterOffset, tieredNodeData.y+nodeCenterOffset)
                nodeContainer.scale.set(options.nodeScaleFactor, options.nodeScaleFactor);
                // Circle Sprite
                // nodePixiObj.circleSprite.scale.set(mapScaleFactor, mapScaleFactor);
                //Add node label text sprites to 'nodeContainer' 
                if (options.drawNames || options.nodeHover) {
                    nodePixiObj.nameContainer.y = NAME_Y;
                    nodePixiObj.nameContainer.scale = NAME_SCALE;
                }

                if (true && spritesheetLoaded) {
                    nodePixiObj.imgSprite.texture = nodePixiObj.getSpriteImg(tieredNodeData.tier);
                    nodePixiObj.imgSprite.scale = IMG_SCALE;
                }

                //Add node tier text sprites to 'nodeContainer'
                if (options.drawTiers || options.nodeHover) {
                    let tierSprite = nodePixiObj.tierSprite;
                    tierSprite.texture = nodeTierTextures[tieredNodeData.tier-1];
                    tierSprite.scale = TIER_SCALE;
                    tierSprite.y = TIER_Y;
                }
                
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
function getNodeByID(nodeID) {
    return nodeData[nodeID];
}
export function getNodeRegionTier(nodeObject) {
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
function getTieredNodeData(node) {
    let tData = node.TieredData[regionTiers[node.AtlasRegionsKey]];
    return new TieredNodeData(
        tData.Tier,
        tData.AtlasNodeKeys,
        tData.X*mapScaleFactor,
        tData.Y*mapScaleFactor
    );
}

//Stores the position of the center of the PIXI canvas, not the window.
function onWindowResize() {
    // let innerHeight = CONTAINER.clientHeight;
    // let innerWidth = CONTAINER.clientWidth;
    let nonAtlasContentHeightSum = document.getElementsByTagName("header")[0].offsetHeight
        + document.getElementsByTagName("footer")[0].offsetHeight;
    let nonAtlasContentWidthSum = 0;
    pixiScreenH = window.innerHeight-nonAtlasContentHeightSum;
    pixiScreenW = window.innerWidth-nonAtlasContentWidthSum;

    if (pixiScreenH > pixiScreenW) {
        pixiAtlasW = pixiScreenW;
        pixiAtlasH = pixiScreenW*(maxH/maxW);
    } else {
        pixiAtlasH = pixiScreenH;
        pixiAtlasW = pixiScreenH*(maxW/maxH);
    }
    
    app.renderer.resize(pixiScreenW, pixiScreenH);

    midx = pixiScreenW/2+app.screen.x;
    midy = pixiScreenH/2+app.screen.y;

    let containerScale = getAtlasContainersScale();
    atlasScreenMid.x = pixiAtlasW/2*containerScale.x;
    atlasScreenMid.y = pixiAtlasH/2*containerScale.y;

    mapScaleFactor = (pixiAtlasW + pixiAtlasH)/(maxH+maxW)*4;

    nodeCenterOffset =  25*mapScaleFactor/4;
    nodeRadius = 30*mapScaleFactor/4;
    lineThickness = 2.5*mapScaleFactor/4;
    
    // placeAtlasTierButtonsCircle();
    resizePixiDisplayObjects();
    positionWatchstones();
    drawAllAtlasRegions();
}
var onWindowResizeDebounced = debounce(onWindowResize, MIN_FRAME_TIME);

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
const DISPLAY_OPTIONS_STORAGE_KEY = 'displayOptions';
function storeDisplayOptions() { debounce(
    () => { window.localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(options)); }
    , 1500
)};
class Option {
    constructor(name, key) {
        this.name = name;
        this.key = key;
    }
}

const DEFAULT_OPTIONS = {
    drawLines: true,
    drawNodes: true,
    nodeHover: true,
    drawNames: true,
    drawTiers: true,
    Watchstones: true,
    MasterWatchstone: true,
    nodeScaleFactor: 1
};
const DEFAULT_OPTIONS_LIST = [
    new Option("Show Lines", "drawLines"),
    new Option("Show Nodes", "drawNodes"),
    new Option("Show Names", "drawNames"),
    new Option("Show Tiers", "drawTiers"),
    new Option("Hover Effect", "nodeHover"),
    new Option("Show Watchstones", "Watchstones"),
    new Option("Show 'Cycle' Button", "MasterWatchstone"),
    new Option("Node Size", "nodeScaleFactor")
];

function updateNodesVisibility() {
    //lines, nodes, hover, names, tiers, scaleFactor
    console.time("updateNodesVisibility");
    for (let i = 0; i < nodePixiObjects.length; i++) {
        let nodePixiObj = nodePixiObjects[i];
        nodePixiObj.container.visible = options.drawNodes;
        nodePixiObj.tierSprite.visible = options.drawTiers;
        nodePixiObj.nameContainer.visible = options.drawNames;
    }
    console.timeEnd("updateNodesVisibility");
}
const OPTIONS_CHANGED_HANDLERS = {
    // drawLines: updateNodesVisibility,
    drawNodes: updateNodesVisibility,
    nodeHover: updateNodesVisibility,
    drawNames: updateNodesVisibility,
    drawTiers: updateNodesVisibility,
    Watchstones: updateWatchstoneVisibility,
    MasterWatchstone: updateWatchstoneVisibility,
}

function setOption(optionKey, value) {
    options[optionKey] = value;
    if (OPTIONS_CHANGED_HANDLERS[optionKey])
        OPTIONS_CHANGED_HANDLERS[optionKey]();
    storeDisplayOptions();
    drawAllAtlasRegions();
    // console.log(optionsElements[optionKey]);
    let input = optionsElements[optionKey].input;
    if (input.type==="checkbox") {
        input.checked = value;
    } else if (input.type==="text") {
        input.value = value;
    }
}

function resetOption(optionKey) {
    setOption(optionKey, DEFAULT_OPTIONS[optionKey]);
}
function resetAllOptions() {
    for (const key of Object.keys(options)) {
        resetOption(key);
    }
}

function loadDisplayOptions() {
    //TODO IMPORTANT: The current version of this does allow adding of options if a client has already visited the site. They will have only the OLD options.
    let stored = JSON.parse(window.localStorage.getItem(DISPLAY_OPTIONS_STORAGE_KEY));
    if (stored) {
        options = stored;
        for (let option in DEFAULT_OPTIONS) {
            // If possible options does not exist in stored options, load from default
            if (!(option in options)) {
                options[option] = DEFAULT_OPTIONS[option];
            }
        }
        storeDisplayOptions();
    } else {
        options = DEFAULT_OPTIONS;
        storeDisplayOptions();
    }
}

function createOptionsMenu() {
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
    for (let opt of DEFAULT_OPTIONS_LIST) {
        const key = opt.key;
        const elem = options[opt.key];
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
                    setOption(key, !options[key]);
                } else { //This somehow fixes a visual bug that caused checkbox display to be inverted when you click the slider. IDK - JP
                    input.checked = !input.checked;
                }
                
            });
        } else if (input.type==='text') {
            domElement.addEventListener('input', (e)=>{
                if (e.target.value) {
                    setOption(key, e.target.value);
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
    resetAll.firstChild.addEventListener('click', resetAllOptions);
    optionsList.appendChild(resetAll);

    return optionsList;
}

// Add the constructed menu to the DOM.
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
function addAllToDOM() {
    addDropdownToDOM(
        document.getElementById("help_button"),
        document.getElementById("help_content"),
        null
    );
    addDropdownToDOM(
        document.getElementById("options_button"),
        document.getElementById("options_content"),
        createOptionsMenu()
    );
}

//=========
// Utility
//=========
export function renderStage() { app.renderer.render(stage) };
export var renderStageThrottled = throttle(
    () => app.renderer.render(stage),
    MIN_FRAME_TIME
);

const REGION_TIER_STORAGE_KEY = 'regionTiers';
const storeRegionTiers = debounce(
    () => { window.localStorage.setItem(REGION_TIER_STORAGE_KEY, JSON.stringify(regionTiers)); },
    1500
);

function loadRegionTiers() {
    let stored = JSON.parse(window.localStorage.getItem(REGION_TIER_STORAGE_KEY));
    if (stored) {
        regionTiers = stored;
    } else {
        regionTiers = [0,0,0,0,0,0,0,0];
        storeRegionTiers();
    }
}

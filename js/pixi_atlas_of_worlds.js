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
    createOptionsMenu();
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
    stage = app.stage;
});

//Load Pixi resources
// let loadGraphics = new PIXI.Graphics();
// app.ticker.add(()=>{
//     loadGraphics.lineStyle(4, 0xffff55);
//     loadGraphics.drawCircle(app.screen.width/2, app.screen.height/2, 60);
// });
// stage.addChild(loadGraphics);
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
    // .add("img/line.png")
    // .add("img/line_backgroundfill.png")
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

    //Queue next resources for loading
    loader.add("pixi/node_spritesheet-4qLL2.json")
        .load(()=>{
            console.timeLog("load");
            //TODO make sure this waits for nodeData to exist...
            sheet = loader.resources["pixi/node_spritesheet-4qLL2.json"];
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

    //==================
    //  Initialization
    //==================
    initPixiDisplayObjects(resources);
    // stage.removeChild(loadGraphics);

    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish
    // setTimeout(()=>atlasSprite.texture = app.loader.resources["img/Atlas.jpg"].texture, 0);
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

    watchstonesContainer.position.set(atlasScreenMid.x, atlasScreenMid.y);
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
var DEBUG_CIRCLE;
function initPixiDisplayObjects(resources) {

    //Create main Atlas sprite
    atlasSprite = new PIXI.Sprite(resources["img/Atlas47kb.webp"].texture);

    // atlasSprite = new PIXI.Sprite();
    //Add Atlas sprite to stage
    stage.addChildAt(atlasSprite, 0);

    //Bind input to Atlas
    bindZoomPanInput(atlasSprite, getAtlasSpriteScale, getAtlasSpritePosition);
    initZoomPanInput(app, renderStageThrottled);

    initPixiContainers();
    initWatchstones();
}
function initPixiContainers() {
    //Create main containers for Lines, Nodes, and Watchstones
    linesContainer = new PIXI.Container();
    nodesContainer = new PIXI.Container();
    watchstonesContainer = new PIXI.Container()

    //Add Lines, Nodes, and Watchstones containers to stage. (Lines 1st, so that they are in back.)
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(nodesContainer);
    atlasSprite.addChild(watchstonesContainer);  
}
const NUM_REGIONS = 8;

function initWatchstones() {
    const baseButton = new PIXI.Graphics();
    baseButton.lineStyle(lineThickness, '0x0', 1, 0.5, false)
        .beginFill('0x6699cc',1)
        .drawCircle(0, 0, 20);

    const masterButton = new PIXI.Graphics();
    masterButton.lineStyle(lineThickness, '0x0', 1, 0.5, false)
        .beginFill('0xffffff',1)
        .drawCircle(0, 0, 20);
    let watchstoneButtons = []
    for (let i=0; i < NUM_REGIONS; i++) {
        let button = baseButton.clone();
        button.textSprite = new PIXI.Text("test");
        button.addChild(button.textSprite);
        button.textSprite.anchor.set(0.5);
    
        //init click functions & tier text
        button.interactive = true;
        button.buttonMode = true;    
        button.on("click", ()=>{cycleAtlasRegionTier(i, button);} );
        button.textSprite.text = "Tier "+regionTiers[i];

        watchstoneButtons.push(button);
        watchstonesContainer.addChild(button);
    }
    
    //init "master" tier button (cycle all nodes) click function
    masterButton.interactive = true;
    masterButton.buttonMode = true;    
    masterButton.on("click", cycleAllAtlasRegionTiers);
    watchstonesContainer.addChild(masterButton);
    masterButton.position.set(0, 0);

    function cycleAtlasRegionTier(regionID, boolDrawRegion=true) {
        if (regionTiers[regionID] < 4) {
            regionTiers[regionID] += 1;
        } else {
            regionTiers[regionID] = 0;
        }
        //Update corresponding button label
        watchstoneButtons[regionID].textSprite.text = "Tier "+regionTiers[regionID];
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

    // Position
    const radius = 75*2;//TODO Multiply by mapScaleFactor elsewhere? Or can we jut scale the container... I think thats it, ye;
    const anglePerItem = Math.PI/4
    for(let i=0; i<watchstoneButtons.length; i++){
        watchstoneButtons[i].position.set(
            Math.cos(anglePerItem*i)*radius,//-btnWidth/2,
            Math.sin(anglePerItem*i)*radius//-btnHeight/2
        );
    }
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
// class NodeData {
//     constructor(ID, name, regionID, isUnique, tieredData) {
//         this.ID = ID;
//         this.name = name;
//         this.regionID = regionID;
//         this.isUnique = isUnique;
//         this.tieredData = tieredData;
//     }
// }
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
    constructor(nodeContainer, circleSprite, imgSprite, nameSprite, tierSprite, data) {
        this.container = nodeContainer;
        this.circleSprite = circleSprite;
        this.imgSprite = imgSprite;
        this.nameSprite = nameSprite;
        this.tierSprite = tierSprite;
        this.data = data;
        this.additionalGraphics = new PIXI.Container();
        this.container.addChild(this.additionalGraphics);
    }

    gainLightFocus(scaleMult, hoverGraphic) {
        this.container.scale.x *=scaleMult;
        this.container.scale.y *=scaleMult;
        this.container.zIndex = 1;
        this.nameSprite.visible = true;
        this.tierSprite.visible = true;
        if (hoverGraphic) {
            this.additionalGraphics.addChild(hoverGraphic);
        }
    }

    loseLightFocus(scaleMult, clearHoverGraphic, forceBaseScale) {
        this.container.scale.x /=scaleMult;
        this.container.scale.y /=scaleMult;
        this.container.zIndex = 0;
        this.nameSprite.visible = options.drawNames;
        this.tierSprite.visible = options.drawTiers;
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
        sidebar.poedb.href = this.data.poeDBLink;
        sidebar.poewiki.href = this.data.poeWikiLink;
        sidebar.region.innerText = this.data.AtlasRegionsKey;
        sidebar.icon.src = buildCDNNodeImageLink(this.data, 0, 8, getTieredNodeData(this.data).tier);
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
}

const cdnBaseNormalLink = "https://web.poecdn.com/image/Art/2DItems/Maps/Atlas2Maps/New/"
const cdnBaseUniqueLink = "https://web.poecdn.com/gen/image/"
function buildCDNNodeImageLink(nodeData, scale=0, league=0, tier=0) {
    const cdnScale = "scale=";
    const cdnLeague = "mn="
    const cdnTier = "mt="
    let out;
    if (nodeData.IsUniqueMapArea) {
        out =   cdnBaseUniqueLink + nodeData.cdnKey
                +'?'+cdnScale + scale;
    } else {
        // Handle Vaal Temple
        if (nodeData.RowID === 8) {
            tier=0;
        }
        out =   cdnBaseNormalLink + nodeData.cdnKey
                +'?'+cdnScale + scale
                +'&'+cdnLeague + league
                +'&'+cdnTier + tier;
    }
    return out;
}
function getCDNKeyFromLink(link) {
    let out = link.includes(cdnBaseNormalLink) ? link.replace(cdnBaseNormalLink, '') : link.replace(cdnBaseUniqueLink, '');
    return out.replace(/\?scale.*/g, "");
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
            console.groupCollapsed("CDN Key Loading Log");
            
            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                try {
                    entry.cdnKey = getCDNKeyFromLink(nodeImagesDict[toPoEDBName(entry.Name, entry.IsUniqueMapArea)].Icon);
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

    function toPoEDBName(strName, isUnique=false) {
        if (isUnique) {
            strName = (strName === "The Hall of Grandmasters") ? "Hall of Grandmasters" : strName;
            strName = (strName === "Perandus Manor") ? "The Perandus Manor" : strName;
        } else {
            strName = `${strName} Map`;
        }
        return strName;
    }

    let nodeDataRequest = new XMLHttpRequest();
    nodeDataRequest.open("GET", "data/AtlasNode+WorldAreas_Itemized-1599021672.json", true);
    nodeDataRequest.send(null);
    nodeDataRequest.onreadystatechange = function() {
        if ( nodeDataRequest.readyState === 4 && nodeDataRequest.status === 200 ) {
            nodeDataResponseReceived = true;
            //Parse response contents
            nodeData = JSON.parse(nodeDataRequest.responseText);
            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)

            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
                
                const regionCode = 'us'
                let nodeNameU = toPoEDBName(entry.Name, entry.IsUniqueMapArea).replace(/ /g,"_");
                entry.interalName = nodeNameU;
                if (entry.IsUniqueMapArea) {
                    entry.poeDBLink = `http://www.poedb.tw/${regionCode}/unique.php?n=${encodeURI(nodeNameU.replace(/_/g,"+"))}`;
                    entry.poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(nodeNameU)}`;
                } else {
                    entry.poeDBLink = `http://www.poedb.tw/${regionCode}/${nodeNameU}`;
                    entry.poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(nodeNameU)}`; 
                }
            }
            initSearch(nodeData);
            preloadStaticGraphics();
            //Draw Atlas Nodes & Lines
            drawAllAtlasRegions();
            //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
            //  http request is async. The resources wouldn't necessarily be loaded when the...
            //  drawAllAtlasRegions function is called.)
            
            function toBaseName(strName, isUnique=false) {
                return strName.replace(/\sMap/g, '');
            }
            allResponsesReceivedOps(nodeImagesDict);
        }
    }
    //send next request
    //TODO make sure this waits for the other request, OR combine with base data file in backend
    let nodeImagesDictRequest = new XMLHttpRequest();
    nodeImagesDictRequest.open("GET", "data/Maps155-DICT-.json", true);
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

    let nodeCircleGraphs = preloadNodeCircleGraphics();
    DEBUG_CIRCLE = nodeCircleGraphs.unique.clone();
    DEBUG_CIRCLE.interactive = true;
    DEBUG_CIRCLE.buttonMode = true;
    let posTextSprite = new PIXI.Text("test", nameTextStyleBlack);
    posTextSprite.anchor.set(0.5);
    DEBUG_CIRCLE.addChild(posTextSprite);
    DEBUG_CIRCLE
        .on('pointerdown', onDragStart)
        .on('pointerup', onDragEnd)
        .on('pointerupoutside', onDragEnd)
        .on('pointermove', onDragMove);
        function onDragStart(event) {
            // store a reference to the data
            // the reason for this is because of multitouch
            // we want to track the movement of this particular touch
            this.data = event.data;
            // this.alpha = 0.5;
            this.dragging = true;
        }
        
        function onDragEnd() {
            this.alpha = 1;
            this.dragging = false;
            // set the interaction data to null
            this.data = null;
        }
        
        function onDragMove() {
            if (this.dragging) {
                const newPosition = this.data.getLocalPosition(this.parent);
                this.x = newPosition.x;
                this.y = newPosition.y;
            }
            let x = ~~(DEBUG_CIRCLE.position.x/mapScaleFactor);
            let y = ~~(DEBUG_CIRCLE.position.y/mapScaleFactor);
            DEBUG_CIRCLE.children[0].text = `(${x}, ${y})`; 

        }

    let tierTextures = preloadTierTextures(fontSize, fontFamily, tierFontStyle, textResolution);
    for (let i=0; i<nodeData.length; i++) {
        let cNodeData = nodeData[i];
        let container = new PIXI.Container();
        let nodePixiObj = new NodePixiObject(container);
        nodePixiObj.data = cNodeData;

        //Placeholder img sprites
        nodePixiObj.imgSprite = new PIXI.Sprite();
        nodePixiObj.imgSprite.anchor.set(0.5);
        // container.addChild(nodePixiObj.imgSprite);


        //Load Node Circle Sprites
        let circleSprite;
        // let nodeNameU = cNodeData.Name.replace(/ /g,"_");
        if (cNodeData.IsUniqueMapArea) {
            circleSprite = nodeCircleGraphs.unique.clone();
        } else {
            circleSprite = nodeCircleGraphs.normal.clone();
        }
        circleSprite = nodePixiObj.imgSprite;
        if (options.nodeHover) {
            circleSprite.interactive = true;
            circleSprite.buttonMode = true;
            const scaleMult = 1.325;
            circleSprite.mouseover = ()=>{
                nodePixiObj.gainLightFocus(scaleMult);
                app.renderer.render(stage);
            };
            circleSprite.mouseout = (mouseData)=>{
                nodePixiObj.loseLightFocus(scaleMult);
                app.renderer.render(stage);
            };
        }
        

        circleSprite.click = ()=>nodePixiObj.onSelect();
        nodePixiObj.circleSprite = circleSprite;
        
        container.addChild(nodePixiObj.circleSprite);

        
        //Load Name Sprites
        let nameSprite = new PIXI.Text(cNodeData.Name, nameTextStyleBlack);
        nameSprite.resolution = textResolution;
        nameSprite.anchor.set(0.5,1);
        nodePixiObj.nameSprite = nameSprite;
        container.addChild(nameSprite);

        //Preload Node Tier Sprites
        nodePixiObj.tierSprite = new PIXI.Sprite.from(
            tierTextures[cNodeData.TieredData[0].Tier]
        );
        container.addChild(nodePixiObj.tierSprite);

        //Add the constructed Node object to the global list.
        nodePixiObjects.push(nodePixiObj);
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
}


function drawAllAtlasRegions() {
    for(let i=0; i<NUM_REGIONS; i++) {
        drawAtlasRegion(i, false);
    }
}

// Globals (Display properties)
var nodeCenterOffset;//If I figure out how to scale the source data correctly, 'nodeCenterOffset' probably becomes 0 (and therefore unneeded)
var nodeRadius;
var lineThickness;
const lineColor = 0x333333;//ffffff;
function drawAtlasRegion(regionID, boolRedrawAdjacent=false) {
    let regionLinesGraph;
    let regionNodesContainer;
    //Remove previous nodes and lines for this region.
    if (nodesContainer.children.length > regionID) {
        // Clear the lines graphics
        regionLinesGraph = linesContainer.getChildAt(regionID).clear();//destroy(true, false, false);
        // The nodesContainer can be cached...
        regionNodesContainer = nodesContainer.getChildAt(regionID);
        regionNodesContainer.removeChildren();//.destroy(true, false, false);
    } else {
        //init region lines Graphics object (Lines)
        regionLinesGraph = new PIXI.Graphics();
        //init region nodes Graphics object (Nodes)
        regionNodesContainer = new PIXI.Container();
        //Enable 'sortableChildren' so we can bring focused nodes to front.
        regionNodesContainer.sortableChildren = true;
        //Add Nodes and Lines to their respective containers and renderedRegion list
        linesContainer.addChildAt(regionLinesGraph, regionID);
        nodesContainer.addChildAt(regionNodesContainer, regionID);
    }
    if (DEBUG_CIRCLE) {
        regionNodesContainer.addChild(DEBUG_CIRCLE);
        DEBUG_CIRCLE.position.set(100,100);
        DEBUG_CIRCLE.zIndex = 100;
        console.info("DEBUG_CIRCLE loaded.")
    } else {
        console.warn("DEBUG_CIRCLE not yet loaded...")
    }
    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];

    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let entryID = region[i];

        //Node location and neighbor IDs
        let cNode = getNodeByID(entryID);
        let tieredEntryData = getTieredNodeData(cNode);

        //if node exists at this tier
        if (tieredEntryData.tier>0) {
            //Draw Connecting Lines between nodes (PIXI.Graphics)
            if (options.drawLines) {
                for (let i=0; i<tieredEntryData.atlasNodeKeys.length; i++) {
                    let adjNodeKey = tieredEntryData.atlasNodeKeys[i];
                    let adjNodeData = getTieredNodeData(getNodeByID(adjNodeKey));

                    //Draw Lines
                    let startX = tieredEntryData.x+nodeCenterOffset,
                        startY = tieredEntryData.y+nodeCenterOffset,
                        endX = adjNodeData.x+nodeCenterOffset,
                        endY = adjNodeData.y+nodeCenterOffset;
                    // let dX = endX-startX,
                    //     dY = endY-startY;
                    // let angle = Math.atan2(dY, dX);

                    // let lineTexStyle = {
                    //     width: lineThickness*0.8,
                    //     texture: app.loader.resources["img/line.png"].texture,
                    //     alignment: 1,
                    //     matrix: new PIXI.Matrix(.5,0, 0,.5, 0,0).rotate(angle),//.translate(dX/4,dY/4)
                    // }

                    // regionLinesGraph.lineTextureStyle(lineTexStyle)
                    regionLinesGraph.lineStyle(lineThickness, lineColor)
                        .moveTo(startX, startY)
                        .lineTo(endX, endY);

                    //Redraw adjacent region if not already done.
                    let adjNodeRegionKey = getNodeByID(adjNodeKey).AtlasRegionsKey;
                    if (boolRedrawAdjacent && regionsRedrawn[adjNodeRegionKey] === false) {
                        regionsRedrawn[adjNodeRegionKey] = true;
                        drawAtlasRegion(adjNodeRegionKey);
                    }
                }
            }

            //Draw Nodes on 'regionNodesGraph'
            let nodePixiObj = nodePixiObjects[entryID];
            nodePixiObj.container.visible = options.drawNodes;
            if (options.drawNodes) {
                let nodeContainer = nodePixiObj.container;
                nodeContainer.position.set(tieredEntryData.x+nodeCenterOffset, tieredEntryData.y+nodeCenterOffset)
                nodeContainer.scale.set(options.nodeScaleFactor, options.nodeScaleFactor);
                // Circle Sprite
                // nodePixiObj.circleSprite.scale.set(mapScaleFactor, mapScaleFactor);
                //Add node label text sprites to 'nodeContainer' 
                nodePixiObj.nameSprite.visible = options.drawNames;
                if (options.drawNames || options.nodeHover) {
                    nodePixiObj.nameSprite.y = 0-(nodeRadius+nodeCenterOffset/4);
                    const scaleFac = 2/3;
                    nodePixiObj.nameSprite.scale.set(mapScaleFactor*scaleFac, mapScaleFactor*scaleFac);
                }

                if (true && spritesheetLoaded) {
                    let spriteImg = nodePixiObj.getSpriteImg(tieredEntryData.tier);
                    nodePixiObj.imgSprite.texture = spriteImg;
                    const scaleFac = 1/4;
                    nodePixiObj.imgSprite.scale.set(mapScaleFactor*scaleFac, mapScaleFactor*scaleFac);//.set(0.5,0.5);
                }

                //Add node tier text sprites to 'nodeContainer'
                nodePixiObj.tierSprite.visible = options.drawTiers;
                if (options.drawTiers || options.nodeHover) {
                    let tierSprite = nodePixiObj.tierSprite;
                    tierSprite.texture = nodeTierTextures[tieredEntryData.tier-1];
                    const scaleFac = 0.15;
                    tierSprite.scale.set(mapScaleFactor*scaleFac, mapScaleFactor*scaleFac);
                    tierSprite.anchor.set(0.5,0)
                    tierSprite.position.set(0, nodeRadius+4);
                    nodeContainer.addChild(tierSprite);
                }
                
                regionNodesContainer.addChild(nodeContainer);
            }
        }
        
    }
    
    //Force immediate stage render
    //TODO see if something like this helps at ALL, or if its actually a hindrance.
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
const onWindowResize = ()=>{
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
    drawAllAtlasRegions();
}
const onWindowResizeDebounced = debounce(onWindowResize, MIN_FRAME_TIME);

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
var storeDisplayOptions = debounce(
    () => {window.localStorage.setItem(DISPLAY_OPTIONS_STORAGE_KEY, JSON.stringify(options));}
    , 1500
);

const DEFAULT_OPTIONS = {
    drawLines: true,
    drawNodes: true,
    nodeHover: true,
    drawNames: true,
    drawTiers: true,
    nodeScaleFactor: 1
};
function setOption(optionKey, value) {
    options[optionKey] = value;
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
    for (const [key, elem] of Object.entries(options)) {
        resetOption(key);
    }
}

function loadDisplayOptions() {
    let stored = JSON.parse(window.localStorage.getItem(DISPLAY_OPTIONS_STORAGE_KEY));
    if (stored) {
        options = stored;
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
    for (const [key, elem] of Object.entries(options)) {
        let div = document.createElement('div');
        let lstElement = new HTMLElement('li');
        lstElement.innerHTML = "<p>"+key+"</p>\n";
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
                if (e.detail>0){
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
    let resetAll = document.createElement('li');
    resetAll.innerHTML = `<div id="reset_options_btn" class="button expand">Reset All</button>`;
    resetAll.firstChild.addEventListener('click', resetAllOptions);
    optionsList.appendChild(resetAll);

    function addContentToDOM() {
        document.getElementById("options_container").appendChild(optionsList);
        const options_dropdown_container = document.getElementById("options_dropdown_container");
        const div = document.getElementById("options_container");
        document.getElementById("options_button").addEventListener('click', (e)=>{
            if (div.className.includes("hidden"))
                div.className = div.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );
            else
                div.className = div.className +" hidden";
        });
        document.addEventListener('click', (e)=>{
            if (!options_dropdown_container.contains(e.target)) {
                if (!div.className.includes("hidden"))
                    div.className = div.className +" hidden";
            }
        });
    }
    if (document.readyState==='interactive' || document.readyState==='complete'){
        addContentToDOM();
    } else {
        document.addEventListener("DOMContentLoaded", addContentToDOM);
    }
}


//=========
// Utility
//=========
export var renderStageThrottled = throttle(() => app.renderer.render(stage), MIN_FRAME_TIME);
export var renderStage = ()=>app.renderer.render(stage);

const REGION_TIER_STORAGE_KEY = 'regionTiers';
var storeRegionTiers = debounce(
    () => {window.localStorage.setItem(REGION_TIER_STORAGE_KEY, JSON.stringify(regionTiers));}
    , 1500
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

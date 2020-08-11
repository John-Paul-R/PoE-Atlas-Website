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

window.addEventListener('DOMContentLoaded', ()=>{
    //// Load Pixi App
    
    //Load User Options
    loadDisplayOptions();
    createOptionsMenu();
});
//Create the Pixi Application
var app, stage, loader;
console.log("Creating PIXI Atlas app.");
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

//Load Pixi resources
// let loadGraphics = new PIXI.Graphics();
// app.ticker.add(()=>{
//     loadGraphics.lineStyle(4, 0xffff55);
//     loadGraphics.drawCircle(app.screen.width/2, app.screen.height/2, 60);
// });
// stage.addChild(loadGraphics);
loader = PIXI.Loader.shared;
loader.onProgress.add(loadProgressHandler);
loader.onComplete.add(createPixiView);
loader
    .add("img/Atlas47kb.webp")
    // .add("img/line.png")
    // .add("img/line_backgroundfill.png")
    .load(setup);
//===========
// Functions
//===========
function loadProgressHandler() {

}
function setup(loader, resources) {
    //==================
    //  Initialization
    //==================
    app.ticker.stop();
    PIXI.Ticker.shared.autoStart = false;
    PIXI.Ticker.shared.stop();
    // stage.removeChild(loadGraphics);

    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish
    // setTimeout(()=>atlasSprite.texture = app.loader.resources["img/Atlas.jpg"].texture, 0);
    initPixiDisplayObjects();
    onWindowResize();
    createPixiView();
    window.addEventListener('resize', onWindowResizeDebounced);
    loadMapsData();
    initAtlasTierButtons();
    
    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}
function createPixiView() {
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
function initPixiDisplayObjects() {
    //Create main Atlas sprite
    atlasSprite = new PIXI.Sprite(app.loader.resources["img/Atlas47kb.webp"].texture);
    app.loader.add("img/Atlas90.webp").load(()=>{
        atlasSprite.texture = app.loader.resources["img/Atlas90.webp"].texture;
        renderStage();
        app.loader.add("pixi/node_spritesheet-2.json").load(()=>{
            //TODO make sure this waits for nodeData to exist...
            sheet = app.loader.resources["pixi/node_spritesheet-2.json"];
            spritesheetLoaded = true;
            drawAllAtlasRegions();
        });
    });
    
    // atlasSprite = new PIXI.Sprite();
    //Add Atlas sprite to stage
    stage.addChildAt(atlasSprite, 0);

    //Bind input to Atlas
    bindZoomPanInput(atlasSprite, getAtlasSpriteScale, getAtlasSpritePosition);
    initZoomPanInput(app, renderStageThrottled);

    initPixiContainers();
}
function initPixiContainers() {
    //Create main containers for Lines and Nodes
    linesContainer = new PIXI.Container();
    nodesContainer = new PIXI.Container();

    //Add Lines and Nodes containers to stage. (Lines 1st, so that they are in back.)
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(nodesContainer);
}

//Factor by which to multiply node positions from the data file when drawing
var mapScaleFactor;// = pixiAtlasW/maxW*4;//4.05;
const NUM_REGIONS = 8;
window.addEventListener('DOMContentLoaded', loadRegionTiers);
var regionTiers = []; //Tiers of each region (array index = regionID)
var regionNodes = [[], [], [], [], [], [], [], []]; //lists of nodes(IDs) in each region
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
class NodePixiObject {
    constructor(nodeContainer, circleSprite, imgSprite, nameSprite, tierSprite, data) {
        this.container = nodeContainer;
        this.circleSprite = circleSprite;
        this.imgSprite = imgSprite;
        this.nameSprite = nameSprite;
        this.tierSprite = tierSprite;
        this.data = data;
    }

    gainLightFocus(scaleMult, hoverGraphic) {
        this.container.scale.x *=scaleMult;
        this.container.scale.y *=scaleMult;
        this.container.zIndex = 1;
        if (hoverGraphic) {
            this.circleSprite.addChild(hoverGraphic);
        }
    }

    loseLightFocus(scaleMult, clearHoverGraphic, forceBaseScale) {
        this.container.scale.x /=scaleMult;
        this.container.scale.y /=scaleMult;
        this.container.zIndex = 0;
        if (clearHoverGraphic) {
            this.circleSprite.children.forEach((el)=>el.destroy());
        }
        if (forceBaseScale) {
            this.container.scale.set(options.nodeScaleFactor, options.nodeScaleFactor);
        }
    }

    onSelect() {
        const infoNameElem = document.getElementById("node_name");
        const poeDBValueElem = document.getElementById("node_poedb");
        const poeWikiValueElem = document.getElementById("node_poewiki");
        const nodeImageElem = document.getElementById("node_image");
        const infoContainer = document.getElementById("node_info");
        // Info sidebar close button
        document.getElementById("node_exit").addEventListener('click', (e)=>{
            if (!infoContainer.className.includes("hidden"))
                infoContainer.className = infoContainer.className +" hidden";
        });

        console.log(this.data);
        console.log(this.data.poeDBLink);
        // Show info sidebar if it is hidden
        infoContainer.className = infoContainer.className.replace( /(?:^|\s)hidden(?!\S)/g , '' );
        
        infoNameElem.innerText = this.data.Name;
        poeDBValueElem.href = this.data.poeDBLink;
        poeWikiValueElem.href = this.data.poeWikiLink;
        nodeImageElem.src = buildCDNNodeImageLink(this.data, 0, 8, getTieredNodeData(this.data).tier);
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
        console.log(out);
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
    
    let nodeDataRequest = new XMLHttpRequest();
    nodeDataRequest.open("GET", "data/AtlasNode+WorldAreas_Itemized-1594755436.json", true);
    nodeDataRequest.send(null);
    nodeDataRequest.onreadystatechange = function() {
        if ( nodeDataRequest.readyState === 4 && nodeDataRequest.status === 200 ) {
            nodeData = JSON.parse(nodeDataRequest.responseText);
            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)

            for (let i=0; i<nodeData.length; i++) {
                let entry = nodeData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
                
                const regionCode = 'us'
                let nodeNameU = entry.Name.replace(/ /g,"_");
                nodeNameU = (nodeNameU === "The_Hall_of_Grandmasters") ? "Hall_of_Grandmasters" : nodeNameU;
                
                if (entry.IsUniqueMapArea) {
                    entry.poeDBLink = `http://www.poedb.tw/${regionCode}/unique.php?n=${encodeURI(nodeNameU.replace(/_/g,"+"))}`;
                    entry.poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(nodeNameU)}`;
                    entry.interalName = nodeNameU;
                } else {
                    entry.poeDBLink = `http://www.poedb.tw/${regionCode}/${nodeNameU}_Map`;
                    entry.poeWikiLink = `http://www.pathofexile.gamepedia.com/${encodeURI(nodeNameU)}_Map`;
                    entry.interalName = nodeNameU+"_Map";
                }
            }
            initSearch(nodeData);
            preloadStaticGraphics();
            //Draw Atlas Nodes & Lines
            drawAllAtlasRegions();
            //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
            //  http request is async. The resources wouldn't necessarily be loaded when the...
            //  drawAllAtlasRegions function is called.)
            
            function toPoEDBName(strName, isUnique=false) {
                return isUnique ? `${strName}` : `${strName} Map`;
            }
            function toBaseName(strName, isUnique=false) {
                return strName.replace(/\sMap/g, '');
            }
            //TODO make sure this waits for the other request, OR combine with base data file in backend
            let nodeImagesRequest = new XMLHttpRequest();
            nodeImagesRequest.open("GET", "data/Maps155-DICT-.json", true);
            nodeImagesRequest.send(null);
            nodeImagesRequest.onreadystatechange = function() {
                if ( nodeImagesRequest.readyState === 4 && nodeImagesRequest.status === 200 ) {
                    let nodeImages = JSON.parse(nodeImagesRequest.responseText);
        
                    // for (const [key, elem] of Object.entries(nodeImages)) {
                    //     resetOption(key);
                    // }
                    console.log(nodeImages);
                    for (let i=0; i<nodeData.length; i++) {
                        let entry = nodeData[i];
                        try {
                            entry.cdnKey = getCDNKeyFromLink(nodeImages[toPoEDBName(entry.Name, entry.IsUniqueMapArea)].Icon);
                            console.log(`${entry.Name}: ${entry.cdnKey}`);

                        } catch (error) {
                            console.log(`Error finding matching icon for ${entry.Name}.`)
                        }
                    }
                }
                

            }
        }
    }
    

    // nodeData = NODE_DATA_OBJ;
    // for (let i=0; i<nodeData.length; i++) {
    //     let entry = nodeData[i];
    //     regionNodes[entry.AtlasRegionsKey].push(entry.RowID);                
    // }
    // initSearch(nodeData);
    // preloadStaticGraphics();
    // drawAllAtlasRegions();
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
    let tierTextures = preloadTierTextures(fontSize, fontFamily, tierFontStyle, textResolution);
    for (let i=0; i<nodeData.length; i++) {
        let cNodeData = nodeData[i];
        let nodePixiObj = new NodePixiObject();
        let container = new PIXI.Container();
        nodePixiObj.container = container;
        nodePixiObj.data = cNodeData;

        //Placeholder img sprites
        nodePixiObj.imgSprite = new PIXI.Sprite();
        nodePixiObj.imgSprite.anchor.set(0.5);
        // container.addChild(nodePixiObj.imgSprite);


        //Load Node Circle Sprites
        let circleSprite;
        let nodeNameU = cNodeData.Name.replace(/ /g,"_");
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
            if (i > 9) {
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
const lineColor = 0xffffff;
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
                nodePixiObj.circleSprite.scale.set(mapScaleFactor.avg, mapScaleFactor.avg);

                //Add node label text sprites to 'nodeContainer' 
                nodePixiObj.nameSprite.visible = options.drawNames;
                if (options.drawNames) {
                    nodePixiObj.nameSprite.y = 0-(nodeRadius+nodeCenterOffset/4);
                    const scaleFac = 2/3;
                    nodePixiObj.nameSprite.scale.set(mapScaleFactor.x*scaleFac, mapScaleFactor.y*scaleFac);
                }

                if (true && spritesheetLoaded) {
                    let spriteImg = nodePixiObj.getSpriteImg(tieredEntryData.tier);
                    nodePixiObj.imgSprite.texture = spriteImg;
                    nodePixiObj.imgSprite.scale.set(0.5,0.5);
                }

                //Add node tier text sprites to 'nodeContainer'
                nodePixiObj.tierSprite.visible = options.drawTiers;
                if (options.drawTiers) {
                    let tierSprite = nodePixiObj.tierSprite;
                    tierSprite.texture = nodeTierTextures[tieredEntryData.tier-1];
                    const scaleFac = 0.15;
                    tierSprite.scale.set(mapScaleFactor.x*scaleFac, mapScaleFactor.y*scaleFac);
                    tierSprite.anchor.set(0.5,0.5)
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
        tData.X*mapScaleFactor.x,
        tData.Y*mapScaleFactor.y
    );
}

function cycleAllAtlasRegionTiers() {
    for(let i=0; i<NUM_REGIONS; i++) {
        cycleAtlasRegionTier(i, false);
    }
    drawAllAtlasRegions();
}

function cycleAtlasRegionTier(regionID, boolDrawRegion=true) {
    if (regionTiers[regionID] < 4) {
        regionTiers[regionID] += 1;
    } else {
        regionTiers[regionID] = 0;
    }
    //Update corresponding button label
    document.getElementsByClassName("watchstone "+regionID)[0].innerHTML
        = "Tier "+regionTiers[regionID];
    
    //Redraw this region & adjacent regions
    if (boolDrawRegion) {
        drawAtlasRegion(regionID, true);
    }

    //Store the current region tiers on the client
    storeRegionTiers();
}

//Place Atlas tier buttons, set their click function, and...
// automatically reposition them if window is resized 
function initAtlasTierButtons() {
    
    //init "master" tier button (cycle all nodes) click function
    document.getElementsByClassName("watchstone master")[0]
        .addEventListener("click", cycleAllAtlasRegionTiers);

    //init region ("watchstone") tier buttons click functions
    let watchstoneButtons = document.getElementsByClassName("watchstone");
    for(let i=1; i<watchstoneButtons.length; i++){
        watchstoneButtons[i].addEventListener("click", function() {cycleAtlasRegionTier(i-1);} );
        watchstoneButtons[i].textContent = "Tier "+regionTiers[i-1];
    }
    placeAtlasTierButtonsCircle();
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

    mapScaleFactor = {
        x: pixiAtlasW/maxW*4,
        y: pixiAtlasH/maxH*4,
        avg: (pixiAtlasW + pixiAtlasH)/(maxH+maxW)*4
    }

    nodeCenterOffset =  25*mapScaleFactor.avg/4;
    nodeRadius = 30*mapScaleFactor.avg/4;
    lineThickness = 2.5*mapScaleFactor.avg/4;
    
    placeAtlasTierButtonsCircle();
    resizePixiDisplayObjects();
    drawAllAtlasRegions();
}
const onWindowResizeDebounced = debounce(onWindowResize, MIN_FRAME_TIME);

//Place atlas tier buttons in center, stacked vertically
function placeAtlasTierButtons() {
    let elements = document.getElementsByClassName("watchstone");
    let btnHeight = elements[0].offsetHeight;
    // let y0 = (elements.length*btnHeight)/2;

    // for(let i=0; i<elements.length; i++){
    //     placeElement(elements[i], midx, midy-y0+i*btnHeight);
    // }
    let buttonsBox = document.getElementById("watchstone_btn_container");
    //buttonsBox.style.width = '100px';
    buttonsBox.style.height = elements.length*btnHeight+'px';
    placeElement(buttonsBox, midx, midy);
}
function placeAtlasTierButtonsCircle() {
    const radius = 75;
    const anglePerItem = Math.PI/4
    let buttonsBox = document.getElementById("watchstone_btn_container");
    //buttonsBox.style.width = '100px';
    buttonsBox.style.height = '100%';
    buttonsBox.style.width = '100%';

    let elements = document.getElementsByClassName("watchstone");
    let btnHeight = elements[1].offsetHeight;
    let btnWidth = elements[1].offsetWidth;

    // let y0 = (elements.length*btnHeight)/2;
    for(let i=1; i<elements.length; i++){
        placeElement(
            elements[i],
            midx+Math.cos(anglePerItem*i)*radius-btnWidth/2,
            midy+Math.sin(anglePerItem*i)*radius-btnHeight/2
        );
    }
    placeElement(
        elements[0],
        midx-elements[0].offsetWidth/2,
        midy-elements[0].offsetHeight/2
    );
}

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
function removeElementsByClass(className){
    let elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}
function placeElementByID(elementID, x_pos, y_pos) {
    placeElement(document.getElementById(elementID), x_pos, y_pos);
}

function placeElement(element, x_pos, y_pos) {
    element.style.position = "absolute";
    element.style.left = x_pos+'px';
    element.style.top = y_pos+'px';
}
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

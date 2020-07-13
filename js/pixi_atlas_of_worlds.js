//===========
//  Globals
//===========
//Parsed json data file w/ map positions & other node data
// let mapData;
//The main sprite for the Atlas. (background image)
let atlasSprite;
//Self explanatory.
let linesContainer;
let nodesContainer;
//Render Toggles
let boolDrawLines = true;
let boolDrawNodes = true;
let boolNodeHover = true;
let boolDrawNames = true;
let boolDrawTiers = true;


//Create the Pixi Application
let maxH = 2304;
let maxW = 4096;
let pixiH = 2304;
let pixiW = 4096;

var app =  new PIXI.Application({
    width: pixiW,
    height: pixiH,
    autoStart: true,
    autoResize:true,
    antialias: true,
    sharedLoader: true,
    sharedTicker: true,
    resizeTo: window
});
let stage = app.stage;

//Load Pixi resources
const loader = PIXI.Loader.shared;
loader.onProgress.add(loadProgressHandler);
loader.onComplete.add(createPixiView);
loader
    .add("img/Atlas.jpg")
    .add("img/line.png")
    .add("img/line_backgroundfill.png")
    .load(setup);

//The center position of the PIXI canvas. Updates automatically when resized.
let midx = 0;
let midy = 0;

//===========
// Functions
//===========
function loadProgressHandler() {

}
function setup(loader, resources) {
    //==================
    //  Initialization
    //==================
    createPixiView();
    initPixiDisplayObjects(loader, resources);
    //TODO break this ^^^ up again and put "initialization" outside of "setup," and into the main thread.
    //TODO make it so that loadMapsData doesn't need to wait for Atlas.jpg to load. (a part of the above)
    //TODO have a "initWindowSizeDependants" and an "onWindowSize", the former not affecting "atlasSprite", so it can run in main thread, not having to wait for "setup" to finish
    onWindowResize();
    window.addEventListener('resize', onWindowResize);
    loadMapsData();
    initAtlasTierButtons();
    
    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}
function createPixiView() {
    //Add the canvas that Pixi automatically created for you to the HTML document
    domTarget = document.getElementById("atlas_of_worlds");
    domTarget.appendChild(app.view);
    domTarget.lastChild.className = "pixi_atlas_of_worlds";
    
}

function resizePixiView() {
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
        x: maxW/pixiW,
        y: maxH/pixiH
    };
}
function getAtlasContainersPosition() {
    return {
        x: 0,
        y: 0
    };
}
function getAtlasSpriteScale() {
    return {
        x: pixiW/maxW,
        y: pixiH/maxH
    };
}
function getAtlasSpritePosition() {
    return {
        x: (app.screen.width-pixiW)/2,
        y: (app.screen.height-pixiH)/2
    };
}

function initPixiDisplayObjects(loader, resources) {
    //Create main Atlas sprite
    atlasSprite = new PIXI.Sprite(resources["img/Atlas.jpg"].texture);
    
    //Add Atlas sprite to stage
    stage.addChildAt(atlasSprite, 0);

    //Bind input to Atlas
    bindZoomPanInput(atlasSprite, getAtlasSpriteScale, getAtlasSpritePosition);
    initZoomPanInput(app);

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
var mapScaleFactor = pixiW/maxW*4;//4.05;
const NUM_REGIONS = 8;
const NUM_TIERS = 5;
var regionTiers = [0,0,0,0,0,0,0,0]; //Tiers of each region (array index = regionID)
var regionNodes = [[], [], [], [], [], [], [], []]; //lists of nodes(IDs) in each region
var nodeData = [];
class NodeData {
    constructor(ID, name, regionID, isUnique, tieredData) {
        this.ID = ID;
        this.name = name;
        this.regionID = regionID;
        this.isUnique = isUnique;
        this.tieredData = tieredData;
    }
}
//Request map data, parse it, and draw all Atlas regions for the 1st time.
function loadMapsData(loader, resources, atlasSprite) {
    
    let request = new XMLHttpRequest();
    request.open("GET", "data/AtlasNode+WorldAreas_Itemized-1594337404.json", true);
    request.send(null);
    request.onreadystatechange = function() {
        if ( request.readyState === 4 && request.status === 200 ) {
            let mapData = JSON.parse(request.responseText);
            // console.log(mapData);
            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)
            for (let i=0; i<mapData.length; i++) {
                let entry = mapData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
                nodeData.push(new NodeData(
                    entry.RowID,
                    entry.Name,
                    entry.AtlasRegionsKey,
                    entry.IsUniqueMapArea, [
                    [entry.X0, entry.Y0, entry.AtlasNodeKeys0, entry.Tier0],
                    [entry.X1, entry.Y1, entry.AtlasNodeKeys1, entry.Tier1],
                    [entry.X2, entry.Y2, entry.AtlasNodeKeys2, entry.Tier2],
                    [entry.X3, entry.Y3, entry.AtlasNodeKeys3, entry.Tier3],
                    [entry.X4, entry.Y4, entry.AtlasNodeKeys4, entry.Tier4]
                ]));
                
            }
            //Draw Atlas Nodes & Lines
            drawAllAtlasRegions();
            //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
            //  http request is async. The resources wouldn't necessarily be loaded when the...
            //  drawAllAtlasRegions function is called.)
        }
    }
}

function drawAllAtlasRegions() {
    for(let i=0; i<NUM_REGIONS; i++) {
        drawAtlasRegion(i, false);
    }
}

function drawAtlasRegion(regionID, boolRedrawAdjacent=false) {
    
    let regionLinesGraph;
    let lineThickness = 3*mapScaleFactor/4;
    let lineColor = 0xffffff;
    //Remove previous nodes and lines for this region.
    if (nodesContainer.children.length > regionID) {
        // linesContainer.removeChildAt(regionID);
        // nodesContainer.removeChildAt(regionID);
        //This removes all references to the container AND child DisplayObjects, allowing...
        //  the garbage collector to remove them from memory. Simply doing...
        //  container.removeChildAt does not do this
        regionLinesGraph = linesContainer.getChildAt(regionID).clear();//destroy(true, false, false);
        //The nodesContainer can be cached
        nodesContainer.getChildAt(regionID).destroy(true, false, false);
    } else {
        //init region lines Graphics object (Lines)
        regionLinesGraph = new PIXI.Graphics();
        
    }

    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //init region nodes Graphics object (Nodes)
    let regionNodesContainer = new PIXI.Container();// new PIXI.Graphics();
    regionNodesContainer.sortableChildren = true;
    //regionNodesGraph.interactive = true;
    //regionNodesGraph.buttonMode = true;
    const nodeCenterOffset = 25*mapScaleFactor/4;
    const nodeRadius = 30*mapScaleFactor/4;
    const tierFontSize = 24*mapScaleFactor/4;
    const tierFontFamily = 'Arial';
    const tierFontStyle = '';
    const nameFontStyle = 'bold';
    const textResolution = 3;
    //Set text display options
    let tierTextStyleRed = {
        fontFamily : tierFontFamily,
        fontSize: tierFontSize,
        fontStyle: tierFontStyle,
        // fill : 0xcc1010,
        fill : 0xee0000,
    };
    let tierTextStyleYellow = {
        fontFamily : tierFontFamily,
        fontSize: tierFontSize,
        fontStyle: tierFontStyle,
        fill : 0xdddd00,
    };
    let tierTextStyleWhite = {
        fontFamily : tierFontFamily,
        fontSize: tierFontSize,
        fontStyle: tierFontStyle,
        fill : 0xffffff,
    };

    let nameTextStyleBlack = {
        fontFamily : tierFontFamily,
        fontSize: tierFontSize,
        fontStyle: nameFontStyle,
        fill : 0x000000,
    };

    //Add Nodes and Lines to their respective containers and renderedRegion list
    linesContainer.addChildAt(regionLinesGraph, regionID);
    nodesContainer.addChildAt(regionNodesContainer, regionID);

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];

    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let entryID = region[i];

        //Node location and neighbor IDs
        let entryData = getTieredNodeDataByID(entryID);
        let entryX = entryData[0];
        let entryY = entryData[1];
        let entryAtlasNodeKeys = entryData[2];
        let existsAtThisTier = entryData[3]>0;
        if (existsAtThisTier) {
            //Draw Connecting Lines between nodes (PIXI.Graphics)
            if (boolDrawLines) {
                for (let i=0; i<entryAtlasNodeKeys.length; i++) {
                    let adjNodeKey = entryAtlasNodeKeys[i];
                    let adjNodeData = getTieredNodeDataByID(adjNodeKey);

                    //Draw Lines
                    let startX =entryX+nodeCenterOffset,
                    startY = entryY+nodeCenterOffset
                    endX = adjNodeData[0]+nodeCenterOffset,
                    endY = adjNodeData[1]+nodeCenterOffset;
                    let dX = endX-startX;
                    let dY = endY-startY;
                    let angle = Math.atan2(dY, dX);


                    const lineTexStyle = {
                        width: lineThickness*0.8,
                        texture: app.loader.resources["img/line.png"].texture,
                        alignment: 1,
                        matrix: new PIXI.Matrix(.5,0, 0,.5, 0,0).rotate(angle),//.translate(dX/4,dY/4)
                    }
                    // regionLinesGraph.lineTextureStyle(lineTexStyle)
                    regionLinesGraph.lineStyle(lineThickness, lineColor)
                        .moveTo(startX, startY)
                        .lineTo(endX, endY);

                    //Redraw adjacent region if not already done.
                    let adjNodeRegionKey = nodeData[adjNodeKey].regionID;
                    if (boolRedrawAdjacent && regionsRedrawn[adjNodeRegionKey] === false) {
                        regionsRedrawn[adjNodeRegionKey] = true;
                        drawAtlasRegion(adjNodeRegionKey);
                    }
                }
            }

            //Draw Nodes on 'regionNodesGraph'
            if (boolDrawNodes) {
                let nodeContainer = new PIXI.Container();
                nodeContainer.position.set(entryX+nodeCenterOffset, entryY+nodeCenterOffset)
                
                let nodeGraph = new PIXI.Graphics();
                nodeGraph.lineStyle(lineThickness, '0x0', 1, 0.5, false);
                if (nodeData[entryID].isUnique) {
                    nodeGraph.beginFill('0x554411',1);
                } else {
                    nodeGraph.beginFill('0x555555',1);
                }
                nodeGraph.drawCircle(0, 0, nodeRadius);
                if (boolNodeHover) {
                    nodeGraph.interactive = true;
                    nodeGraph.buttonMode = true;
                    const scaleMult = 1.3;
                    nodeGraph.mouseover = function() {
                        // nodeGraph.lineStyle(2, '0xccc', 2, 0.5, false);
                        // nodeGraph.beginFill(0,0);
                        // nodeGraph.drawCircle(
                        //     entryX+nodeCenterOffset,
                        //     entryY+nodeCenterOffset,
                        //     nodeRadius*1.15);
                        
                        nodeContainer.scale.x *=scaleMult;
                        nodeContainer.scale.y *=scaleMult;
                        nodeContainer.zIndex = 1;
                    };
                    nodeGraph.mouseout = function(mouseData) {
                        nodeContainer.scale.x /=scaleMult;
                        nodeContainer.scale.y /=scaleMult;
                        nodeContainer.zIndex = 0;
                    }
                }
                nodeContainer.addChild(nodeGraph);

                //Add node label text sprites to 'nodeContainer' 
                if (boolDrawNames) {
                    let nameSprite = new PIXI.Text(nodeData[entryID].name, nameTextStyleBlack);
                    nameSprite.resolution = textResolution;
                    nameSprite.y -= nodeRadius+nodeCenterOffset/4;
                    nameSprite.anchor.set(0.5,1)
                    nodeContainer.addChild(nameSprite);
                }

                //Add node tier text sprites to 'nodeContainer' 
                if (boolDrawTiers) {
                    let tierSprite = new PIXI.Text(entryData[3]);
                    tierSprite.resolution = textResolution;
                    if (entryData[3] > 9) {
                        tierSprite.style = tierTextStyleRed;
                    } else if (entryData[3] > 5) {
                        tierSprite.style = tierTextStyleYellow;
                    } else {
                        tierSprite.style = tierTextStyleWhite;
                    }
                    // tierSprite.x = entryX+nodeCenterOffset;
                    // tierSprite.y = entryY+nodeCenterOffset;
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
function getTieredNodeDataByID(nodeID) {
    let node = nodeData[nodeID];
    let res = node.tieredData[regionTiers[node.regionID]];
    let out = [0,0,res[2], res[3]];
    out[0] = res[0]*mapScaleFactor;
    out[1] = res[1]*mapScaleFactor;
    return out;
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
}

//Place Atlas tier buttons, set their click function, and...
// automatically reposition them if window is resized 
function initAtlasTierButtons() {
    
    //init "master" tier button (cycle all nodes) click function
    document.getElementById("master_tier_button")
        .addEventListener("click", cycleAllAtlasRegionTiers);

    //init region ("watchstone") tier buttons click functions
    let watchstoneButtons = document.getElementsByClassName("watchstone");
    for(let i=1; i<watchstoneButtons.length; i++){
        watchstoneButtons[i].addEventListener("click", function() {cycleAtlasRegionTier(i-1);} );
    }
    placeAtlasTierButtons();
}

//Stores the position of the center of the PIXI canvas, not the window.
function onWindowResize() {
    let innerHeight = window.innerHeight;
    let innerWidth = window.innerWidth;
    if (innerHeight > innerWidth) {
        pixiW = innerWidth;
        pixiH = innerWidth*(maxH/maxW);
    } else {
        pixiH = innerHeight;
        pixiW = innerHeight*(maxW/maxH);
    }

    midx = app.screen.width/2;
    midy = app.screen.height/2;
    mapScaleFactor = pixiW/maxW*4;

    placeAtlasTierButtons();
    resizePixiView();
    drawAllAtlasRegions();
}

function removeElementsByClass(className){
    let elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}

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

function placeElementByID(elementID, x_pos, y_pos) {
    placeElement(document.getElementById(elementID), x_pos, y_pos);
}

function placeElement(element, x_pos, y_pos) {
    element.style.position = "absolute";
    element.style.left = x_pos+'px';
    element.style.top = y_pos+'px';
}


// ===============================
// Notes and currently unused
// ===============================
// function clearPixiViews() {
//     removeElementsByClass("pixi_atlas_of_worlds");
// }

let directionMult = 1;
function animationLoop(delta) {
    
    // let lib = stage.getChildAt(1);
    
    // if (lib.y < 0 || lib.y > 100) {
    //     directionMult *= -1;
    // }
    
    // lib.y += 1*directionMult;

}

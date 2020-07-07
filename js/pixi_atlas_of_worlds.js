//===========
//  Globals
//===========
//Parsed json data file w/ map positions & other node data
var mapData;
//The main sprite for the Atlas. (background image)
var atlasSprite;
//Self explanatory.
var linesContainer;
var nodesContainer;

//Create the Pixi Application
let pixiH = 2304;
let pixiW = 4096;
let app =  new PIXI.Application({width: pixiW, height: pixiH});


//The center position of the PIXI canvas. Updates automatically when resized.
let midx = 0;
let midy = 0;

initAtlasTierButtons();

//Load Pixi resources
const loader = PIXI.Loader.shared;
loader.onProgress.add(loadProgressHandler);
loader.onComplete.add(createPixiView);
loader
    .add("img/Atlas.jpg")
    .load(setup);


//===========
// Functions
//===========

function loadProgressHandler() {

}
function setup(loader, resources) {
    initSprites(loader, resources);

    //60fps (more?) Animation Ticker (is this fps capped?)
    // app.ticker.add(delta => animationLoop(delta));
}
function createPixiView() {
    //Add the canvas that Pixi automatically created for you to the HTML document
    domTarget = document.getElementById("atlas_of_worlds");
    domTarget.appendChild(app.view);
    domTarget.lastChild.className = "pixi_atlas_of_worlds";

    //Make Fullscreen
    // app.renderer.view.style.position = "absolute";
    // app.renderer.view.style.display = "block";
    // app.renderer.autoResize = true;
    // app.renderer.resize(window.innerWidth, window.innerHeight);
}

function initSprites(loader, resources) {
    //Create main Atlas sprite & containers for Lines and Nodes
    atlasSprite = new PIXI.Sprite(resources["img/Atlas.jpg"].texture);
    linesContainer = new PIXI.Container();
    nodesContainer = new PIXI.Container();
    
    //Add Atlas sprite to stage
    app.stage.addChild(atlasSprite);

    //Add Lines and Nodes containers to Atlas sprite. (Lines 1st, so that they are in back.)
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(nodesContainer);

    //Request map data, parse it, and draw all Atlas regions for the 1st time.
    loadMapsData(loader, resources, atlasSprite);

}

//Factor by which to multiply node positions from the data file when drawing
const mapScalingFactor = 4.05; //TODO: Make sure that pixi's text rendering is not the cause of misalignments.
var regionTiers = [0,0,0,0,0,0,0,0]; //Tiers of each region (array index = regionID)
var regionNodes = [[], [], [], [], [], [], [], []]; //lists of nodes(IDs) in each region
function loadMapsData(loader, resources, atlasSprite) {
    
    let request = new XMLHttpRequest();
    request.open("GET", "data/AtlasNodeItemized.json", true);
    request.send(null);
    request.onreadystatechange = function() {
        if ( request.readyState === 4 && request.status === 200 ) {
            mapData = JSON.parse(request.responseText);
            // console.log(mapData);
            // Init regionNodes (list) (Add RowIDs of nodes to their respective region lists)
            for (let i=0; i<mapData.length; i++) {
                let entry = mapData[i];
                regionNodes[entry.AtlasRegionsKey].push(entry.RowID);
            }
        }

        //Draw Atlas Nodes & Lines
        drawAllAtlasRegions();
        //(This ^^^ must be in here, instead of after the call to loadMapsData, because the...
        //  http request is async. The resources wouldn't necessarily be loaded when the...
        //  drawAllAtlasRegions function is called.)
    }

}

function drawAllAtlasRegions() {
    for(let i=0; i<regionTiers.length; i++) {
        drawAtlasRegion(i, false);
    }
}

function drawAtlasRegion(regionID, redrawAdjacent) {
    
    //Remove previous nodes and lines for this region.
    if (linesContainer.children.length > regionID) {
        linesContainer.removeChildAt(regionID);
        nodesContainer.removeChildAt(regionID);
    }

    //This bit keeps track of whether adjacent regions have been redrawn w/in this func call
    redrawAdjacent = redrawAdjacent || false;
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //init region nodes Graphics object (Nodes)
    let regionNodesGraph = new PIXI.Graphics();
    regionNodesGraph.lineStyle(2, '0x0', 1, 0.5, false);
    regionNodesGraph.beginFill(0,1)

    //init region lines Graphics object (Lines)
    let regionLinesGraph = new PIXI.Graphics();
    let lineThickness = 2;
    let lineColor = 0xffffff;

    //Add Nodes and Lines to their respective containers
    linesContainer.addChildAt(regionLinesGraph, regionID);
    nodesContainer.addChildAt(regionNodesGraph, regionID);

    //'region' stores the IDs of the nodes in this region.
    let region = regionNodes[regionID];
    //Do not redraw the region that is currently being drawn.
    regionsRedrawn[regionID] = true;

    //loop over nodes in this region
    for (let i=0; i<region.length; i++) {
        let entry = region[i];

        //Node location and neighbor IDs
        let entryData = getTieredNodeDataByID(entry);
        let entryX = entryData[0];
        let entryY = entryData[1];
        let entryAtlasNodeKeys = entryData[2];
        
        //Draw Connecting Lines between nodes (PIXI.Graphics)
        for (let i=0; i<entryAtlasNodeKeys.length; i++) {
            let nodeKey = entryAtlasNodeKeys[i];
            let nodeData = getTieredNodeDataByID(nodeKey)

            //Draw Lines
            regionLinesGraph.lineStyle(lineThickness, lineColor)
                .moveTo(entryX+25, entryY+25)
                .lineTo(nodeData[0]+25, nodeData[1]+25);

            //Redraw adjacent region if not already done.
            if (redrawAdjacent && regionsRedrawn[mapData[nodeKey].AtlasRegionsKey] === false) {
                regionsRedrawn[mapData[nodeKey].AtlasRegionsKey] = true;
                drawAtlasRegion(mapData[nodeKey].AtlasRegionsKey);
            }
        }

        //Draw Nodes on 'regionNodesGraph' and add text sprites
        regionNodesGraph.drawCircle(entryX+25,entryY+25,30);
        let textSprite = new PIXI.Text(entry, {fontFamily : 'Arial', fontSize: 24, fill : 0xff1010, align : 'center'});
        textSprite.x = entryX;
        textSprite.y = entryY;
        regionNodesGraph.addChild(textSprite);
    }

    //Force rendering of ALL lines and nodes (I think)
    //TODO see if something like this helps at ALL, or if its actually a hindrance.
    // app.renderer.render(linesContainer);
    // app.renderer.render(nodesContainer);
}

// Returns an array of length 3 based on the supplied region tier.
// Format: [node_x_pos, node_y_pos, [list_of_neighbor_node_ids]]
function getTieredNodeDataByID(nodeID) {

    let entry = mapData[nodeID];
    let tier = regionTiers[entry.AtlasRegionsKey];
    //Defualt entryX and entryY (offscreen)
    let entryX = -100;
    let entryY = -100;
    //Neighbor node keys
    let atlasNodeKeys = [];
    switch(tier) {
    case 0:
        if (entry.Tier0 > 0) {
            entryX = entry.X0*mapScalingFactor;
            entryY = entry.Y0*mapScalingFactor;
            atlasNodeKeys = entry.AtlasNodeKeys0;
        }
        break;
    case 1:
        if (entry.Tier1 > 0) {
            entryX = entry.X1*mapScalingFactor;
            entryY = entry.Y1*mapScalingFactor;
            atlasNodeKeys = entry.AtlasNodeKeys1;
        }
        break;
    case 2:
        if (entry.Tier2 > 0) {
            entryX = entry.X2*mapScalingFactor;
            entryY = entry.Y2*mapScalingFactor;
            atlasNodeKeys = entry.AtlasNodeKeys2;
        }
        break;
    case 3:
        if (entry.Tier3 > 0) {
            entryX = entry.X3*mapScalingFactor;
            entryY = entry.Y3*mapScalingFactor;
            atlasNodeKeys = entry.AtlasNodeKeys3;
        }
        break;
    case 4:
        if (entry.Tier4 > 0) {
            entryX = entry.X4*mapScalingFactor;
            entryY = entry.Y4*mapScalingFactor;
            atlasNodeKeys = entry.AtlasNodeKeys4;
        }
        break;
    }

    return [entryX, entryY, atlasNodeKeys];
}

function cycleAllAtlasRegionTiers() {
    
    for(let i=0; i<regionTiers.length; i++) {
        if (regionTiers[i] < 4) {
            regionTiers[i] += 1;
        } else {
            regionTiers[i] = 0;
        }
        let btn = document.getElementsByClassName("watchstone "+i);
        btn[0].innerHTML = "Tier "+regionTiers[i];
    }
    drawAllAtlasRegions();
}

function cycleAtlasRegionTier(regionID) {
    if (regionTiers[regionID] < 4) {
        regionTiers[regionID] += 1;
    } else {
        regionTiers[regionID] = 0;
    }
    //Update corresponding button label
    document.getElementsByClassName("watchstone "+regionID)[0].innerHTML
        = "Tier "+regionTiers[regionID];
    
    //Redraw this region & adjacent regions
    drawAtlasRegion(regionID, true);
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
    //Auto update button positions if window is resized
    window.addEventListener('resize', placeAtlasTierButtons);
}

//Place atlas tier buttons in center, stacked vertically
function placeAtlasTierButtons() {
    updateMidPosition();
    let elements = document.getElementsByClassName("watchstone centered");
    let btnHeight = elements[0].offsetHeight;
    let y0 = (elements.length*btnHeight)/2;

    for(let i=0; i<elements.length; i++){
        placeElement(elements[i], midx, midy-y0+i*btnHeight);
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

//Stores the position of the center of the PIXI canvas, not the window.
function updateMidPosition() {
    let innerHeight = window.innerHeight;
    let innerWidth = window.innerWidth;
    if (innerHeight > innerWidth) {
        midx = innerWidth/2;
        midy = (innerWidth/pixiW * pixiH)/2
    } else {
        midy = innerHeight/2;
        midx = (innerHeight/pixiH * pixiW)/2
    }
}

function removeElementsByClass(className){
    let elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}


// ===============================
// Notes and currently unused
// ===============================
function usefulTools() {
    app.renderer.backgroundColor = 0x061639;

    app.renderer.autoResize = true;
    app.renderer.resize(512, 512);

    //Fill entire window (css styling)
    app.renderer.view.style.position = "absolute";
    app.renderer.view.style.display = "block";
    app.renderer.autoResize = true;
    app.renderer.resize(window.innerWidth, window.innerHeight);
    //if you do ^^^ do this to all HTML elements: <style>* {padding: 0; margin: 0}</style>

        // Alternative: sprite.position.set(x, y)
        //cat.scale.x = 2;
        //cat.scale.y = 2;
        //cat.scale.set(0.5, 0.5);
        //cat.rotation = 0.5;
        // Anchor for Location, Pivot for Rotation
        // cat.anchor.x = 0.5;
        // cat.anchor.y = 0.5;
        // cat.anchor.set(x, y)
        // cat.pivot.set(32, 32)
}

function clearPixiViews() {
    removeElementsByClass("pixi_atlas_of_worlds");
}

let directionMult = 1;
function animationLoop(delta) {
    
    // let lib = app.stage.getChildAt(1);
    
    // if (lib.y < 0 || lib.y > 100) {
    //     directionMult *= -1;
    // }
    
    // lib.y += 1*directionMult;

}

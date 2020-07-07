//Globals
var mapData;
var atlasSprite;
var linesContainer;
var nodesContainer;

//Create a Pixi Application
let pixiH = 2304;
let pixiW = 4096;
let app =  new PIXI.Application({width: pixiW, height: pixiH});

//Place Atlas Tier Button
let midx = 0;
let midy = 0;
updateMidPosition();
initAtlasTierButtons();
window.addEventListener('resize', placeAtlasTierButtons);

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
function createPixiView() {
    //Add the canvas that Pixi automatically created for you to the HTML document
    domTarget = document.getElementById("pixi_main");
    domTarget.appendChild(app.view);
    domTarget.lastChild.className = "pixi_atlas_of_worlds";

    //Make Fullscreen
    // app.renderer.view.style.position = "absolute";
    // app.renderer.view.style.display = "block";
    // app.renderer.autoResize = true;
    // app.renderer.resize(window.innerWidth, window.innerHeight);
}

function setup(loader, resources) {
    initSprites(loader, resources);
   
    //60fps Animation Ticker
    // app.ticker.add(delta => animationLoop(delta));
}

function initSprites(loader, resources) {

    atlasSprite = new PIXI.Sprite(resources["img/Atlas.jpg"].texture);
    linesContainer = new PIXI.Container();
    nodesContainer = new PIXI.Container();

    app.stage.addChild(atlasSprite);
    atlasSprite.addChild(linesContainer);
    atlasSprite.addChild(nodesContainer);

    addMaps(loader, resources, atlasSprite);


}

const mapScalingFactor = 4.05; //TODO: Make sure that pixi's text rendering is not the cause of misalignments.
var regionTiers = [0,0,0,0,0,0,0,0];
var regionNodes = [[], [], [], [], [], [], [], []];
function addMaps(loader, resources, atlasSprite) {
    
    let request = new XMLHttpRequest();
    request.open("GET", "data/AtlasNodeItemized.json", true);
    request.send(null);
    request.onreadystatechange = function() {
        if ( request.readyState === 4 && request.status === 200 ) {
            mapData = JSON.parse(request.responseText);

            // console.log(mapData);
            // Init regionNodes (list)
            for (let i=0; i<mapData.length; i++) {
                let entry = mapData[i];
                let nodeRegionID = entry.AtlasRegionsKey;
                regionNodes[nodeRegionID].push(entry.RowID);
            }
            //Draw the Atlas
            drawAllAtlasRegions();
        }
    }
    
}

function drawAllAtlasRegions() {
    for(let i=0; i<regionTiers.length; i++) {
        drawAtlasRegion(i);
    }
}

function drawAtlasRegion(regionID, redrawAdjacent) {
    
    if (linesContainer.children.length > regionID) {
        linesContainer.removeChildAt(regionID);
        nodesContainer.removeChildAt(regionID);
    }
    
    redrawAdjacent = redrawAdjacent || false;
    let regionsRedrawn = [false, false, false, false, false, false, false, false];

    //init region nodes Graphics (Nodes)
    let regionNodesGraph = new PIXI.Graphics();
    regionNodesGraph.lineStyle(2, '0x0', 1, 0.5, false);
    regionNodesGraph.beginFill(0,1)

    //init region lines Graphics (Lines)
    let regionLinesGraph = new PIXI.Graphics();
    let lineThickness = 2;
    let lineColor = 0xffffff;

    //Add Nodes and Lines to their respective containers
    linesContainer.addChildAt(regionLinesGraph, regionID);
    nodesContainer.addChildAt(regionNodesGraph, regionID);

    let region = regionNodes[regionID];
    
    regionsRedrawn[regionID] = true;
    for (let i=0; i<region.length; i++) {
        let entry = region[i];

        //Node location and neighbor IDs
        let entryData = getTieredNodeDataByID(entry);
        let entryX = entryData[0];
        let entryY = entryData[1];
        let entryAtlasNodeKeys = entryData[2];
        
        //Draw Connecting Lines (PIXI.Graphics)
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
}

function getTieredNodeDataByID(nodeID) {

    let entry = mapData[nodeID];
    let tier = regionTiers[entry.AtlasRegionsKey];
    //set entryX and entryY
    let entryX = -100;
    let entryY = -100;
    //neighbor node keys
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
    let btn = document.getElementsByClassName("watchstone "+regionID);
    btn[0].innerHTML = "Tier "+regionTiers[regionID];
    
    drawAtlasRegion(regionID, true);
}

function initAtlasTierButtons() {
    initMasterAtlasTierButton();
    let elements = document.getElementsByClassName("watchstone");
    for(let i=1; i<elements.length; i++){
        elements[i].addEventListener("click", function() {cycleAtlasRegionTier(i-1);} );
    }
    placeAtlasTierButtons();
}

function initMasterAtlasTierButton() {
    let element = document.getElementById("master_tier_button");
    element.addEventListener("click", cycleAllAtlasRegionTiers);
    
}

function placeAtlasTierButtons() {
    updateMidPosition();
    let elements = document.getElementsByClassName("watchstone");
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

function loadProgressHandler() {

}

function loadmapData() {

   
    //parsedData = JSON.parse('/data/AtlasNodePositionsT4.json');
    //alert(parsedData);
    // return mapData;
}

// function drawAtlasNodes() {

//     //init map nodes Sprite
//     let mapNodesSprite = new PIXI.Graphics(); //TODO in future vers, I think create one of these per region
//     mapNodesSprite.lineStyle(2, '0x0', 1, 0.5, false);
//     mapNodesSprite.beginFill(0,1)

//     //init lines Graphics
//     let linesGraph = new PIXI.Graphics();
//     let lineThickness = 2;
//     let lineColor = 0xffffff;

//     //TODO maybe better way of doing this (don't destroy each time, or one per region (as said above...))
//     // let nodeLayer = new PIXI.DisplayGroup(1, false);
//     // let lineLayer = new PIXI.DisplayGroup(0, false);
//     for (let i=0; i<mapData.length; i++) {
//         let entry = mapData[i];

//         //Node location and neighbor IDs
//         let entryData = getTieredNodeDataByID(i);
//         let entryX = entryData[0];
//         let entryY = entryData[1];
//         let entryAtlasNodeKeys = entryData[2];

//         //Make Connecting Lines (PIXI.Graphics)
//         for (let i=0; i<entryAtlasNodeKeys.length; i++) {
//             let nodeKey = entryAtlasNodeKeys[i];
//             let nodeData = getTieredNodeDataByID(nodeKey)
//             // linesGraph.position.set(0, 0);
//             linesGraph.lineStyle(lineThickness, lineColor)
//                 .moveTo(entryX+25, entryY+25)
//                 .lineTo(nodeData[0]+25, nodeData[1]+25);
//         }

//         //Draw Nodes on 'mapNodesSprite' and add text sprites
//         mapNodesSprite.drawCircle(entryX+25,entryY+25,30);
//         let textSprite = new PIXI.Text(i, {fontFamily : 'Arial', fontSize: 24, fill : 0xff1010, align : 'center'});
//         textSprite.x = entryX;
//         textSprite.y = entryY;
//         mapNodesSprite.addChild(textSprite);

//     }
//     atlasSprite.addChild(linesGraph);
//     atlasSprite.addChild(mapNodesSprite);
// }
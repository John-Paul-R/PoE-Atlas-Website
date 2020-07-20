
var searchGraphics;
let searchElements = document.getElementsByClassName("searchField");
const scale = 1.2;

for (let i=0; i<searchElements.length; i++) {
    searchElements[i].addEventListener('input', searchAtlas);
    console.log(searchElements[i] + " will now listen for input events and trigger searchAtlas.");
}
function searchAtlas(query) {
    console.log("running searchAtlas... "+query)
    if (query.target.value){
        console.log("Query: " + query.target.value)
        let objects = nodeData.map(el => { return {
            name: el.Name,
            id: el.RowID.toString(),
            tier: el.TieredData[getNodeRegionTier(el)].Tier.toString() 
        }; });
        let results = fuzzysort.go(query.target.value, objects, {
            keys: ['name', 'id', 'tier'],
            allowTypo: true,
            threshold: -500,
            // Create a custom combined score to sort by. -100 to the desc score makes it a worse match
            scoreFn: (a) => Math.max(
                a[0]?a[0].score:-1000,
                a[1]?a[1].score-50:-1000,
                a[2]?a[2].score-100:-1000
            )
        });
        
        var bestResult = results[0]

        
        clearSearchDisplayMods(nodePixiObjects);

        if (bestResult) {
            atlasSprite.addChild(searchGraphics);
            for(let i=0; i<results.length; i++) {
                let pixiObj = nodePixiObjects[results[i].obj.id];
                let sprite = pixiObj.circleSprite;
                pixiObj.container.scale.x *= scale;
                pixiObj.container.scale.y *= scale;
                let test = new PIXI.Graphics();
                test.lineStyle(2, '0xff8888', 1, 0.5, false)
                    .beginFill('0x555555',0)
                    .drawCircle(0, 0, 15);
                nodeGainLightFocus(pixiObj, scale, test);
                if (results[i].score==0)
                    break;
            }
        }
        // When using multiple `keys`, results are different. They're indexable to get each normal result
        // fuzzysort.highlight(bestResult[0]) // 'Google <b>Chr</b>ome'
        // fuzzysort.highlight(bestResult[1]) // 'Launch <b>Chr</b>ome'
        // bestResult.obj.title // 'Google Chrome'
        //If possible, perhaps run these each in their own threads?
        //Alternatively, just have them use the dropdown... (or a "Did you mean...?")
        // have alphabatized collection with all of the nodes by name
        // premade collections of all nodes at each tier
        // collections of nodes by region (we have this)
        console.log(bestResult?(bestResult.obj.name + " - Score: " + bestResult.score):"NO-MATCH-FOUND")
    } else {
        console.log("No query data was found.")
        clearSearchDisplayMods(nodePixiObjects);
    }
    renderStageThrottled();
}

function initSearchDisplay() {
    searchGraphics = new PIXI.Graphics();
    // searchGraphics.zIndex = 100;
    // app.stage.addChild(searchGraphics);
    // searchGraphics.lineStyle(lineThickness, '0x0', 1, 0.5, false)
    //     .beginFill('0x555555', .5)
    //     .drawCircle(500, 500, 1000);
    //     searchGraphics.endFill();
    
        console.log("test");
}

function clearSearchDisplayMods(pixiObjList) {
    for(let i=0; i<pixiObjList.length; i++) {
        // let pixiObj = pixiObjList[i];
        // pixiObj.container.scale.set(1, 1);
        // pixiObj.circleSprite.removeChildren();
        nodeLoseLightFocus(pixiObjList[i], scale, true, true);
    }
}
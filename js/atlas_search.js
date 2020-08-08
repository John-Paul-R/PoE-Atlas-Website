
import { getNodeRegionTier, nodeData, nodePixiObjects, renderStage, renderStageThrottled } from './pixi_atlas_of_worlds.js';
// import { logger } from './logger.js';
export { initSearch };

let searchElements = document.getElementsByClassName("searchField");
const scale = 1.2;

function searchTextChanged(query) {
    console.info("running searchAtlas... "+query)
    if (query.target.value){
        searchAtlas(query.target.value);
    } else {
        // console.log("No query data was found.")
        clearSearchDisplayMods(nodePixiObjects);
    }
    renderStageThrottled();
}

function searchAtlas(queryText, selectBest=false) {
    console.info("Query: " + queryText)
    let objects = nodeData.map(el => { return {
        name: el.Name,
        id: el.RowID.toString(),
        tier: el.TieredData[getNodeRegionTier(el)].Tier.toString() 
    }; });
    let results = fuzzysort.go(queryText.trim(), objects, {
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
    
    let bestResult = results[0]

    clearSearchDisplayMods(nodePixiObjects);

    if (bestResult) {
        for(let i=0; i<results.length; i++) {
            let pixiObj = nodePixiObjects[results[i].obj.id];
            let sprite = pixiObj.circleSprite;
            pixiObj.container.scale.x *= scale;
            pixiObj.container.scale.y *= scale;
            let test = new PIXI.Graphics();
            test.lineStyle(2, '0xff8888', 1, 0.5, false)
                .beginFill('0x555555',0)
                .drawCircle(0, 0, 15);
            if (i==0 && selectBest) {
                test.lineStyle(2, '0x77dddd', 1, 0.5, false)
                .beginFill('0x555555',0)
                .drawCircle(0, 0, 18);

                pixiObj.onSelect();
            }
            
            pixiObj.gainLightFocus(scale, test);
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
    console.info(bestResult?(bestResult.obj.name + " - Score: " + bestResult.score):"NO-MATCH-FOUND")
}

function setFormAction(formElem) {
    let textInput = formElem.getElementsByClassName("searchField")[0];
    searchAtlas(textInput.value, true);
}

function initSearch() {
    for (let i=0; i<searchElements.length; i++) {
        searchElements[i].addEventListener('input', searchTextChanged);
        searchElements[i].addEventListener('keydown', (e) => {
            
            if (e.key === "Enter")
                searchAtlas(e.target.value, true);
            renderStage();
        });
        console.info(searchElements[i] + " will now listen for input events and trigger searchAtlas.");
    }
    console.info("atlas_search.js initialization complete!");
}

function clearSearchDisplayMods(pixiObjList) {
    for(let i=0; i<pixiObjList.length; i++) {
        pixiObjList[i].loseLightFocus(scale, true, true);
    }
}
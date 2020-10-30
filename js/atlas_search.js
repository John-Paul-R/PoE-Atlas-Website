
import {
    getNodeRegionTier,
    nodeData,
    nodePixiObjects,
    renderStage,
    renderStageThrottled,
    app,
    NodePixiObject
} from './pixi_atlas_of_worlds.js';

import {
    executeIfWhenDOMContentLoaded
} from './util.js';

export { initSearch };

var searchElements;;

const scale = 1.44;

let lineThickness = 4;
const searchMatchGraphics = new PIXI.Graphics()
    .lineStyle(lineThickness, '0xff8888', 1, 0.5, false)
    .beginFill('0x555555',0)
    .drawCircle(0, 0, 30);//18/1.5
    
const textureSize = 64;
var searchMatchTexture = PIXI.RenderTexture.create({
    width: textureSize,
    height: textureSize,
    resolution: 6
});
searchMatchTexture.defaultAnchor = new PIXI.Point(0.5, 0.5);
searchMatchGraphics.position.set(textureSize/2, textureSize/2);
app.renderer.render(searchMatchGraphics, searchMatchTexture);



function searchTextChanged(query) {
    // console.info("running searchAtlas... "+query.target.value)
    let results = null;
    clearSearchDisplayMods(nodePixiObjects);
    if (query.target.value){
        results = searchAtlas(query.target.value);
    } else {
        // console.log("No query data was found.")
        clearSearchDisplayMods(nodePixiObjects);
    }
    updateSearchResultsListElement(results);
    queryDisplayElement.innerText = query.target.value;
    renderStageThrottled();
}
var fuzzysortAvg = 0;
var searchCount = 0;
function searchAtlas(queryText, selectBest=false) {
    console.info("searchAtlas - Query: " + queryText)
    let objects = nodeData.map(el => { return {
        name: el.Name,
        id: el.RowID.toString(),
        tier: el.TieredData[getNodeRegionTier(el)].Tier.toString()
    }; });

    var fuzzysortStart = performance.now();
    let results = fuzzysort.go(queryText.trim(), objects, {
        keys: ['name', /*'id',*/ 'tier'],
        allowTypo: true,
        threshold: -500,
        // Create a custom combined score to sort by. -100 to the desc score makes it a worse match
        scoreFn: (a) => Math.max(
            a[0]?a[0].score:-1000,
            a[1]?a[1].score-50:-1000,
            a[2]?a[2].score-100:-1000
        )
    });
    var fuzzysortTime = performance.now() - fuzzysortStart;
    searchCount += 1;
    fuzzysortAvg = (fuzzysortAvg * (searchCount - 1) + fuzzysortTime) / searchCount;
    console.log(`fuzzysort.js - A:${fuzzysortAvg.toFixed(3)} ms, I:${(fuzzysortTime).toFixed(3)} ms, found: "${results[0] ? results[0].obj.name : ""}", numMatches: ${results.length}`)

    // TODO Only change scale for name matches, not tier matches. (gets too cluttered atm)
    let bestResult = results[0]

    // If there is a match
    if (bestResult) {
        // Go through all partial (& full) matches...
        for(let i=0; i<results.length; i++) {
            // And highlight them as search results
            let pixiObj = nodePixiObjects[results[i].obj.id];
            pixiObj.isSearchMatch = true;

            //TODO Resize nodes withh onWindowResize, otherwise they don't scale right
            // (Note: This ^^^ is low priority, as the current implementation fixes itself upon new search being executed)
            
            // Add graphics to pixi obj
            let matchGraphics = new PIXI.Sprite(searchMatchTexture);//searchMatchGraphics.clone();
            pixiObj.searchMatchGraphic = matchGraphics;

            pixiObj.gainLightFocus(matchGraphics);

            // If this is the best match and 'selectBest' is true
            if (i==0 && selectBest) {
                // Use "selectBest" graphics
                //new PIXI.Sprite(NodePixiObject.TEX_SELECTED));

                pixiObj.onSelect();
            }
            
            // if (results[i].score==0)
            //     break;
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
    // console.info(bestResult?(bestResult.obj.name + " - Score: " + bestResult.score):"NO-MATCH-FOUND")
    return results;
}

var resultsListElement;
var queryDisplayElement;
function initSearch() {
    searchElements = document.getElementsByClassName("searchField")
    for (let i=0; i<searchElements.length; i++) {
        searchElements[i].addEventListener('input', searchTextChanged);
        searchElements[i].addEventListener('keydown', (e) => {
            
            if (e.key === "Enter") {
                clearSearchDisplayMods(nodePixiObjects);
                searchAtlas(e.target.value, true);
            }
            renderStage();
        });
        // console.info(searchElements[i], " will now listen for input events and trigger searchAtlas.");
    }
    resultsListElement = document.getElementById("search_results_list");
    queryDisplayElement = document.getElementById("search_query_text");
    console.info("atlas_search.js initialization complete!");
}
executeIfWhenDOMContentLoaded(initSearch);

function updateSearchResultsListElement(resultsArray) {
    let resultsElem = resultsListElement;//new HTMLOListElement();
    while (resultsElem.firstChild) {
        resultsElem.removeChild(resultsElem.lastChild);
    }
    if (resultsArray) {
        for (const node of resultsArray) {
            const li = resultsElem.appendChild(document.createElement('li'));
            li.innerText = node.obj.name;
            li.addEventListener('click', (e) => {
                nodePixiObjects[node.obj.id].onSelect();
            });
        }
    }
}

function clearSearchDisplayMods(pixiObjList) {
    for(let i=0; i<pixiObjList.length; i++) {
        const pixiObj = pixiObjList[i];
        pixiObj.isSearchMatch = false;
        
        if (pixiObj.searchMatchGraphic) {
            pixiObj.searchMatchGraphic.destroy();
            pixiObj.searchMatchGraphic = null;
        }

        pixiObj.loseLightFocus(scale, true);
    }
}

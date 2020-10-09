
import {
    getNodeRegionTier,
    nodeData,
    nodePixiObjects,
    renderStage,
    renderStageThrottled,
    getMapScaleFactor 
} from './pixi_atlas_of_worlds.js';

import {
    executeIfWhenDOMContentLoaded
} from './util.js';

export { initSearch };

var searchElements;;
const scale = 1.2;

function searchTextChanged(query) {
    console.info("running searchAtlas... "+query)
    let results = null;
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
    console.info("Query: " + queryText)
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

    clearSearchDisplayMods(nodePixiObjects);

    if (bestResult) {
        for(let i=0; i<results.length; i++) {
            let pixiObj = nodePixiObjects[results[i].obj.id];
            pixiObj.container.scale.x *= scale;
            pixiObj.container.scale.y *= scale;
            let test = new PIXI.Graphics();
            let mapScaleFactor = getMapScaleFactor();
            let lineThickness = 2*mapScaleFactor/1.5;
            //TODO Resize these withh onResizeWindow, otherwise they don't scale right
            // (Note: This ^^^ is low priority, as the current implementation fixes itself upon new search being executed)
            test.lineStyle(lineThickness, '0xff8888', 1, 0.5, false)
                .beginFill('0x555555',0)
                .drawCircle(0, 0, 18*mapScaleFactor/1.5);
            
            if (i==0 && selectBest) {
                test.lineStyle(lineThickness, '0x77dddd', 1, 0.5, false)
                .beginFill('0x555555',0)
                .drawCircle(0, 0, 21*mapScaleFactor/1.5);

                pixiObj.onSelect();
            }
            
            pixiObj.gainLightFocus(scale, test);
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
    console.info(bestResult?(bestResult.obj.name + " - Score: " + bestResult.score):"NO-MATCH-FOUND")
    return results;
}

function setFormAction(formElem) {
    let textInput = formElem.getElementsByClassName("searchField")[0];
    searchAtlas(textInput.value, true);
}
var resultsListElement;
var queryDisplayElement;
function initSearch() {
    searchElements = document.getElementsByClassName("searchField")
    for (let i=0; i<searchElements.length; i++) {
        searchElements[i].addEventListener('input', searchTextChanged);
        searchElements[i].addEventListener('keydown', (e) => {
            
            if (e.key === "Enter")
                searchAtlas(e.target.value, true);
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
            resultsElem.appendChild(document.createElement('li')).innerText = node.obj.name;
        }
    }
}

function clearSearchDisplayMods(pixiObjList) {
    for(let i=0; i<pixiObjList.length; i++) {
        pixiObjList[i].loseLightFocus(scale, true, true);
    }
}

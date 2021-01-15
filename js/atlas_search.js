
import {
    getNodeRegionTier,
    nodeData,
    nodePixiObjects,
    renderStage,
    renderStageThrottled,
    app,
    watchstones
} from './pixi_atlas_of_worlds.js';

import {
    executeIfWhenDOMContentLoaded,
    hashtagToCppHex
} from './util.js';

var searchElements;;

const scale = 1.44;

let lineThickness = 4;
const searchMatchGraphics = new PIXI.Graphics()
    .lineStyle(lineThickness, '0xff8888', 1, 0.5, false)
    .beginFill('0x555555',0)
    .drawCircle(0, 0, 30);
    
const textureSize = 64;
var searchMatchTexture = PIXI.RenderTexture.create({
    width: textureSize,
    height: textureSize,
    resolution: 6
});
searchMatchTexture.defaultAnchor = new PIXI.Point(0.5, 0.5);
searchMatchGraphics.position.set(textureSize/2, textureSize/2);
app.renderer.render(searchMatchGraphics, searchMatchTexture);


var prevQuery = null;
function searchTextChanged(query) {
    prevQuery = query;
    if (query) {
        let results = null;
        clearSearchDisplayMods(nodePixiObjects);
        if (query.target.value){
            results = searchAtlas(query.target.value);
        }
        updateSearchResultsListElement(results);
        queryDisplayElement.innerText = `'${query.target.value}'`;
        renderStageThrottled();
    }
}
var fuzzysortAvg = 0;
var searchCount = 0;
/**
 * 
 * @param {String} queryText 
 * @param {boolean} selectBest 
 */
function searchAtlas(queryText, selectBest=false) {
    // TODO - Toggle between "'search visible' and 'search all' for all search methods."
    let objects = nodeData.reduce((result, el) => {
        const tieredData = el.TieredData[getNodeRegionTier(el)];
        if (tieredData) {
            result.push({
                name: el.Name,
                id: el.id,
                tier: tieredData.Tier.toString()
            });
        }
        return result;
    }, []);

    queryText = queryText.trim();
    let results, resultsObjs, searchMode;
    // Tier Search
    if (queryText.startsWith('b') || queryText.startsWith('t') && queryText.charCodeAt(1) >= 48 && queryText.charCodeAt(1) <= 57) {
        let baseTierSearchObjects = nodeData.map((el) => {
            let lowestTierData = null;
            let i = 0;
            while (!lowestTierData && i <= 4) {
                lowestTierData = el.TieredData[i++];
            }
            return {
                name: el.Name,
                id: el.id,
                tier: lowestTierData.Tier
            };
        });

        let tierQueryText = queryText.substr(1);
        const tierSearch = (tier, searchObjects) => {
            return searchObjects.filter((el) => {
                if (el.tier !== tier)
                    return false;
                return true;
            })
        }
        if (queryText.startsWith('b')) {
            // Base Tier Search
            resultsObjs = tierSearch(Number.parseInt(tierQueryText), baseTierSearchObjects);
            searchMode = 'base-tier';
        } else if (queryText.startsWith('t')) {
            // Visible Tier Search
            resultsObjs = tierSearch(tierQueryText, objects);
            searchMode = 'visible-tier';
        }
    } else {
        var fuzzysortStart = performance.now();
        results = fuzzysort.go(queryText, objects, {
            keys: ['name'],
            allowTypo: true,
            threshold: -500,
            // Create a custom combined score to sort by. -100 to the desc score makes it a worse match
            // scoreFn: (a) => Math.max(
            //     a[0]?a[0].score:-1000,
            //     // a[1]?a[1].score-50:-1000,
            //     // a[2]?a[2].score-100:-1000
            // )
        });
        var fuzzysortTime = performance.now() - fuzzysortStart;
        searchCount += 1;
        fuzzysortAvg = (fuzzysortAvg * (searchCount - 1) + fuzzysortTime) / searchCount;    
        console.log(`fuzzysort.js - AvgTime: ${fuzzysortAvg.toFixed(3)} ms, Instance Time: ${(fuzzysortTime).toFixed(3)} ms`);
        
        searchMode = 'name';
    }

    resultsObjs = resultsObjs || results.map(el => el.obj);
    let bestResult = resultsObjs[0];

    console.group(`Search Atlas: '${queryText}'`);
    console.info(`Query: ${queryText}`);
    console.info(`Method: ${searchMode}`);
    console.info(`ResultCount: ${resultsObjs.length}`);
    if (searchMode === 'name')
        console.info(`BestResult: ${bestResult ? bestResult.name : null}`)
    console.groupEnd();

    // If there is a match
    if (bestResult) {
        // Go through all partial (& full) matches...
        for(let i=0; i<resultsObjs.length; i++) {
            // And highlight them as search results
            let pixiObj = nodePixiObjects[resultsObjs[i].id];
            pixiObj.isSearchMatch = true;
           
            // Add graphics to pixi obj
            let matchGraphics = new PIXI.Sprite(searchMatchTexture);//searchMatchGraphics.clone();
            pixiObj.searchMatchGraphic = matchGraphics;
            pixiObj.gainLightFocus(matchGraphics);

            // If this is the best match and 'selectBest' is true
            if (i==0 && selectBest) {
                pixiObj.onSelect();
            }
        }
    }

    return resultsObjs;
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
    const rerunSearch = () => {
        searchTextChanged(prevQuery);
    }
    watchstones.regionTierChangeFuncs.add(rerunSearch);
    console.info("atlas_search.js initialization complete!");
}
executeIfWhenDOMContentLoaded(initSearch);

function updateSearchResultsListElement(resultsArray) {
    let resultsElem = resultsListElement;
    while (resultsElem.firstChild) {
        resultsElem.removeChild(resultsElem.lastChild);
    }
    if (resultsArray) {
        for (const node of resultsArray) {
            const li = resultsElem.appendChild(document.createElement('li'));
            li.innerText = node.name;
            li.addEventListener('click', (e) => {
                nodePixiObjects[node.id].onSelect();
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

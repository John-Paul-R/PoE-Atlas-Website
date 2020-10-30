/*
 * !Note: Much of this file is NOT my code.
 * !Original Source: https://github.com/anvaka/ngraph/blob/master/examples/pixi.js/03%20-%20Zoom%20And%20Pan/globalInput.js
*/

// export { initZoomPanInput, bindZoomPanInput };
//The first object that is added to this should be the background
//(Must have defined bounds, like a sprite)
//(this ^^^ is for constraining the zoom/pan to the screen)
import { 
    app,
    renderStageThrottled,
    atlasSprite,
    resourceLoadFuncs
} from './pixi_atlas_of_worlds.js';
import { executeOrWait } from './util.js'

var displayObjs = [];

function initZoomPanInput(pixiApp, renderStageThrottled) {

    var stage = pixiApp.stage;
    stage.interactive = true;

    var mainObj = displayObjs[0];

    //---------------------
    // Add Event Listeners
    //---------------------
    
    //Mousewheel Zoom
    addZoom(pixiApp);
    //Pan on Click & Drag
    addDragNDrop(pixiApp);

    //Reset zoom & position of DisplayObjects on Double-Click
    //TODO Reimplement? Or just put a button for it? idk
    // pixiApp.view.addEventListener('dblclick', resetPositions);


    //-------------------
    // Private Functions
    //-------------------
    function resetPositions() {
        for (let i=0; i<displayObjs.length; i++) {
            let dispObj = displayObjs[i];
            //reset positions of bound objects to their starting positions
            dispObj.updatePosition();
            //reset zoom/scale of bound objects to starting values
            dispObj.updateScale();
        }
        renderStageThrottled();
    }

    var isScaling = false;
    function addZoom(pixiApp) {
        // Mouse Wheel Zoom
        pixiApp.view.addEventListener('wheel', function (e) {
            zoom(e.clientX, e.clientY, -0.25*Math.sign(e.deltaY));
        });
      
        var pGestureData;
        stage.touchstart = (e) => {
            if (e.data.originalEvent.touches && e.data.originalEvent.touches.length == 2) {
                isScaling = true;
                pinchStart(e.data.originalEvent);        
            }
        }
        stage.touchmove = (e) => {
            if (isScaling) {
                pinchMove(e.data.originalEvent);
            }
        }
        const touchEnd = (e) => {
            if (isScaling) {
                // pinchEnd(e);
                isScaling = false;
            }
        }
        stage.touchend = touchEnd;
        stage.touchendoutside = touchEnd;
        stage.touchcancel = touchEnd;

        function calcGestureData(e) {
            return {
                dist: Math.hypot(
                    e.touches[0].pageX - e.touches[1].pageX,
                    e.touches[0].pageY - e.touches[1].pageY),
                avgX: (e.touches[0].pageX + e.touches[1].pageX)/2,
                avgY: (e.touches[0].pageY + e.touches[1].pageY)/2
            }
        }
        function pinchStart(touchEvent) {
            pGestureData = calcGestureData(touchEvent);
        }
        function pinchMove(touchEvent) {
            let cGestureData = calcGestureData(touchEvent);
            //This gives % increase/decrease in distance between touch points
            let scaleFactor = (cGestureData.dist - pGestureData.dist) / pGestureData.dist;
            let translation = {
                x: cGestureData.avgX - pGestureData.avgX,
                y: cGestureData.avg - pGestureData.avgY
            }
            zoom(cGestureData.avgX, cGestureData.avgY, scaleFactor);
            pGestureData = cGestureData;
        }

    }

    function addDragNDrop(pixiApp) {
        var isDragging = false, isMouseDown = false,
            prevX, prevY;

        stage.pointerdown = function (interactEvent) {
            var pos = interactEvent.data.global;
            prevX = pos.x;
            prevY = pos.y;
            // isDragging = true;
            isMouseDown = true;
        };

        stage.pointermove = function (interactEvent) {
            if (isMouseDown && !isScaling) { // If the mouse isn't down, we're not dragging
                var pos = interactEvent.data.global;
                let dx = pos.x-prevX;
                let dy = pos.y-prevY;
                // Don't start counting mousedown as 'dragging' immediately...
                // Wait until the mouse has moved a certain distance.
                if (!isDragging) {
                    const minMove = 3;
                    if (dx*dx > minMove*minMove || dy*dy > minMove*minMove) {
                        isDragging = true;
                    }
                }
                if (isDragging) {
                    //limit positions to Atlas sprite display bounds
                    let delta = limitMoveToRange(dx, dy);
   
                    mainObj.position.x += delta.x;
                    mainObj.position.y += delta.y;
                    prevX = pos.x;
                    prevY = pos.y;
                    
                    //Render frames while dragging
                    renderStageThrottled();    
                }
                // console.log(`${isDragging?"DRAGGING":"NOT_DRAGGING"}: (${pos.x}, ${pos.y}) - dx: ${dx}, dy: ${dy}`)

            }
        };

        const pointerUp = (interactEvent) => {
            isDragging = false;
            isMouseDown = false
        };
        stage.pointerup = pointerUp;
        stage.pointerupoutside = pointerUp;
        window.addEventListener('mouseup', pointerUp);
    }

    function limitMoveToRange(dx, dy) {
        let screen = pixiApp.screen;

        if (mainObj.width >= screen.width)
            dx = confine2dViewportToObj(mainObj.x, mainObj.width, dx, screen.x, screen.x+screen.width);
        else
            dx = confine2dObjToViewport(mainObj.x, mainObj.width, dx, screen.x, screen.x+screen.width);

        if (mainObj.height >= screen.height)
            dy = confine2dViewportToObj(mainObj.y, mainObj.height, dy, screen.y, screen.y+screen.height);
        else
            dy = confine2dObjToViewport(mainObj.y, mainObj.height, dy, screen.y, screen.y+screen.height);
        
        return {x: dx, y: dy}
    }

    function confine2dViewportToObj(moverPos, moverLength, delta, min, max) {
        if (delta>0 && moverPos+delta > min) {
            delta = min-moverPos;
        } else if (delta<0 && moverPos+moverLength+delta < max) {
            delta = max-(moverPos+moverLength);
        }
        return delta;
    }
    function confine2dViewportToObj2(moverPos, moverLength, min, max) {
        let delta = 0;
        const condition1 = moverPos+moverLength < max
        const condition2 = moverPos > min
        if (condition1 && !condition2) {
            delta = max-(moverPos+moverLength);
        } else if (condition2 && !condition1) {
            delta = min-moverPos;
        }
        return delta;
    }

    function confine2dObjToViewport(moverPos, moverLength, delta, min, max) {
        if (moverPos+delta < min) {
            delta = min-moverPos;
        } else if (moverPos+moverLength+delta > max) {
            delta = max-(moverPos+moverLength);
        }
        return delta;
    }

    //TODO Note: when you zoom in, then resize the window, the containers don't resize/reposition correctly.

    var getGraphCoordinates = (function () {
        var ctx = {
          global: { x: 0, y: 0} // store it inside closure to avoid GC pressure
        };
    
        return function (displayObj, x, y) {
            ctx.global.x = x; ctx.global.y = y;
            // return PIXI.InteractionData.prototype.getLocalPosition.call(ctx, graphGraphics);
            return displayObj.toLocal(ctx.global,undefined, new PIXI.Point(), true);
            // return displayObj.toLocal(ctx.global);//out.getLocalPosition(graphGraphics,new PIXI.Point(), ctx);
        }
    }());
    
    function zoom(x, y, zoomAmount) {//isZoomIn) {
        //NOTE: We want the nodes and lines to move together, so we will do the...
        // math relateive to one of them, then apply the resultant (same) tranformation to both
        // -- We could also do it relative to the average of the elements...? idk, will see
        // let direction = isZoomIn ? 1 : -1;
        var factor = (1 + zoomAmount); //(1 + direction * 0.1);
        let minScale = mainObj.getScale();
        let maxScale = minScale.x*5
        let cScale = mainObj.scale;
        if (cScale.x*factor > minScale.x && cScale.y*factor > minScale.y) {
            if (cScale.x*factor <= maxScale) {
                //Scale Atlas
                mainObj.scale.x *= factor;
                mainObj.scale.y *= factor;

                let beforeTransform = getGraphCoordinates(mainObj, x, y);
                mainObj.updateTransform();
                let afterTransform = getGraphCoordinates(mainObj, x, y);
                let delta = //limitMoveToRange(
                    {x:(afterTransform.x - beforeTransform.x) * mainObj.scale.x,
                    y:(afterTransform.y - beforeTransform.y) * mainObj.scale.y}//);
                mainObj.position.x += delta.x;
                mainObj.position.y += delta.y;
                let screen = pixiApp.screen;
                mainObj.position.x += confine2dViewportToObj2(mainObj.position.x, mainObj.width, 0, screen.x+screen.width);
                mainObj.position.y += confine2dViewportToObj2(mainObj.position.y, mainObj.height, 0, 0+screen.height);

                mainObj.updateTransform();
            }

        } else {
            resetPositions();
        }
        renderStageThrottled();
    }
}

function bindZoomPanInput(dynamicSprite) {
    //Add the DisplayObject to the list of objects to be affected by mouse/wheel input events
    displayObjs.push(dynamicSprite);
}

const bindAtlas = () => bindZoomPanInput(atlasSprite);
const initAtlas = () => initZoomPanInput(app, renderStageThrottled);
executeOrWait(
    bindAtlas,
    app,
    () => resourceLoadFuncs.add(bindAtlas)
);
executeOrWait(
    initAtlas,
    app,
    () => resourceLoadFuncs.add(initAtlas)
);

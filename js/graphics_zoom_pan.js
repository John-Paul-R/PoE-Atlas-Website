/*
 * !Note: this is NOT my code. I just made small adjustments.
 * !Source: https://github.com/anvaka/ngraph/blob/master/examples/pixi.js/03%20-%20Zoom%20And%20Pan/globalInput.js
*/

//The first object that is added to this should be the background
//(Must have defined bounds, like a sprite)
//(this ^^^ is for constraining the zoom/pan to the screen)
var displayObjs = []

function initZoomPanInput(pixiApp) {

    var mainObj = displayObjs[0];
    //---------------------
    // Add Event Listeners
    //---------------------
    
    //Mousewheel Zoom
    pixiApp.view.addEventListener('wheel', function (e) {
        zoom(e.clientX, e.clientY, e.deltaY < 0);
    });//require('./lib/addWheelListener');
  
    //Pan on Click & Drag
    addDragNDrop(pixiApp);

    //Reset zoom & position of DisplayObjects on Double-Click
    app.view.addEventListener('dblclick', resetPositions);


    //-------------------
    // Private Functions
    //-------------------
    function resetPositions() {
        for (let i=0; i<displayObjs.length; i++) {
            let dispObj = displayObjs[i];
            //reset positions of bound objects to their starting positions
            let pos = dispObj.posFunc();
            dispObj.obj.position.set(pos.x, pos.y);
            //reset zoom/scale of bound objects to starting values
            let scale = dispObj.scaleFunc();
            dispObj.obj.scale.set(scale.x, scale.y);
        }
    }

    function addDragNDrop(pixiApp) {
        var stage = pixiApp.stage;
        stage.interactive = true;

        var isDragging = false,
            prevX, prevY;

        stage.mousedown = function (interactEvent) {
            var pos = interactEvent.data.global;
            prevX = pos.x; prevY = pos.y;
            isDragging = true;
        };

        stage.mousemove = function (interactEvent) {
            if (!isDragging) {
            return;
            }
            var pos = interactEvent.data.global;
            //dx, dy
            let delta = limitMoveToRange(pos.x-prevX, pos.y-prevY);
                        
            opOnDisplayObjs(function(obj) {
                obj.position.x += delta.x;
                obj.position.y += delta.y;
                prevX = pos.x; prevY = pos.y;
            });
            //limit positions to Atlas sprite display bounds
        };

        window.addEventListener('mouseup', function (e) {
            isDragging = false;
        });
    }
    function limitMoveToRange(dx, dy) {
        let mainObjO = mainObj.obj;
        let screen = pixiApp.screen;
        dx = limit2dMoveToRange(mainObjO.x, mainObjO.width, dx, screen.x, screen.x+screen.width);
        dy = limit2dMoveToRange(mainObjO.y, mainObjO.height, dy, screen.y, screen.y+screen.height);
        return {x: dx, y: dy}
    }

    function limit2dMoveToRange(moverPos, moverLength, delta, min, max) {
        
        if (moverPos+delta > min) {
            delta = min-moverPos;
        } else if (moverPos+moverLength+delta < max) {
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
    
    function zoom(x, y, isZoomIn) {
        //NOTE: We want the nodes and lines to move together, so we will do the...
        // math relateive to one of them, then apply the resultant (same) tranformation to both
        // -- We could also do it relative to the average of the elements...? idk, will see
        direction = isZoomIn ? 1 : -1;
        var factor = (1 + direction * 0.1);
        let minScale = mainObj.scaleFunc();
        let cScale = mainObj.obj.scale;
        let baseScale = mainObj.scaleFunc();
        if (cScale.x*factor > minScale.x && cScale.y*factor > minScale.y) {
           
            opOnDisplayObjs(function(obj) {
                obj.scale.x *= factor;
                obj.scale.y *= factor;
            });

            var mainDisplayObj = mainObj.obj;
            var beforeTransform = getGraphCoordinates(mainDisplayObj, x, y);
            mainDisplayObj.updateTransform();//TODO figure out what this does. Remove & run. See if all DisplayObjects need to have this done
            var afterTransform = getGraphCoordinates(mainDisplayObj, x, y);
            let dx = (afterTransform.x - beforeTransform.x) * mainDisplayObj.scale.x;
            let dy = (afterTransform.y - beforeTransform.y) * mainDisplayObj.scale.y;
            let delta = limitMoveToRange(dx, dy);

            opOnDisplayObjs(function (obj) {
                // Technically code below is not required, but helps to zoom on mouse
                // cursor, instead center of graphGraphics coordinates
                obj.position.x += delta.x;
                obj.position.y += delta.y;
                obj.updateTransform();
            });
        } else {
            resetPositions();
        }
    }

    function opOnDisplayObjs(func) {
        for (let i=0; i<displayObjs.length; i++) {
            func(displayObjs[i].obj);
        }
    }
}

function bindZoomPanInput(displayObj, defaultScaleFunc, defaultPositionFunc) {
    //Add the DisplayObject to the list of objects to be affected by mouse/wheel input events
    displayObjs.push({
        obj: displayObj,
        scaleFunc: defaultScaleFunc,
        posFunc: defaultPositionFunc
    });
}

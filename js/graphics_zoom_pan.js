/*
 * !Note: this is NOT my code. I just made small adjustments.
 * !Source: https://github.com/anvaka/ngraph/blob/master/examples/pixi.js/03%20-%20Zoom%20And%20Pan/globalInput.js
*/

var displayObjs = []

function initZoomPanInput(pixiApp) {

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
    app.view.addEventListener('dblclick', function(e) {
        for (let i=0; i<displayObjs.length; i++) {
            let dispObj = displayObjs[i];
            //reset positions of bound objects to their starting positions
            let pos = dispObj.posFunc();
            dispObj.obj.position.set(pos.x, pos.y);
            //reset zoom/scale of bound objects to starting values
            let scale = dispObj.scaleFunc();
            dispObj.obj.scale.set(scale.x, scale.y);
        };
    });


    //-------------------
    // Private Functions
    //-------------------
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
            var dx = pos.x - prevX;
            var dy = pos.y - prevY;

            opOnDisplayObjs(function(obj) {
                obj.position.x += dx;
                obj.position.y += dy;
                prevX = pos.x; prevY = pos.y;
            });
            //limit positions to Atlas sprite display bounds
        };

        stage.mouseup = function (moveDate) {
            isDragging = false;
        };
    }

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
        opOnDisplayObjs(function(obj) {
            obj.scale.x *= factor;
            obj.scale.y *= factor;

            // Technically code below is not required, but helps to zoom on mouse
            // cursor, instead center of graphGraphics coordinates
            var mainDisplayObj = obj;
            var beforeTransform = getGraphCoordinates(mainDisplayObj, x, y);
            mainDisplayObj.updateTransform();//TODO figure out what this does. Remove & run. See if all DisplayObjects need to have this done
            var afterTransform = getGraphCoordinates(mainDisplayObj, x, y);
        
            obj.position.x += (afterTransform.x - beforeTransform.x) * obj.scale.x;
            obj.position.y += (afterTransform.y - beforeTransform.y) * obj.scale.y;
            obj.updateTransform();
        });
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

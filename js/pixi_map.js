//Create a Pixi Application
let app =  new PIXI.Application({width: 512, height: 512});

//Load Pixi resources
PIXI.Loader.shared
    .add("img/library.png")
    .add("img/technology.png",
    "img/utility.png")
    .on("progress", loadProgressHandler)
    .load(setup);


function createPixiView() {

    //Add the canvas that Pixi automatically created for you to the HTML document
    domTarget = document.getElementById("pixi_main");
    domTarget.appendChild(app.view);
    domTarget.lastChild.className = "pixi_view";

}

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

}

function clearPixiViews() {
    removeElementsByClass("pixi_view");
}

function setup() {
    initSprites();

    //60fps Animation Ticker
    app.ticker.add(delta => animationLoop(delta));
}

function removeElementsByClass(className){
    var elements = document.getElementsByClassName(className);
    while(elements.length > 0){
        elements[0].parentNode.removeChild(elements[0]);
    }
}

function initSprites() {
    let resources = PIXI.Loader.shared.resources

    let librarySprite = new PIXI.Sprite(resources["img/library.png"].texture);
    app.stage.addChild(librarySprite);

    let techSprite = new PIXI.Sprite(resources["img/technology.png"].texture);
    app.stage.addChild(techSprite);
    techSprite.y = 400;
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
   
let directionMult = 1;
function animationLoop(delta) {
    
    let lib = app.stage.getChildAt(0);
    
    if (lib.y < 0 || lib.y > 100) {
        directionMult *= -1;
    }
    
    lib.y += 1*directionMult;

}

function loadProgressHandler() {

}
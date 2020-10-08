
export {
    throttle,
    debounce,
    executeOrWait,
    executeIfWhenDOMContentLoaded
};

function throttle(func, timeInterval) {
    var lastTime = 0;
    return function () {
        var now = Date.now();
        if (now - lastTime >= timeInterval) {
            func();
            lastTime = now;
        } else {
            setTimeout(func, lastTime+timeInterval);
        }
    };
}
function debounce(func, delay) { 
    let debounceTimer 
    return function() { 
        const context = this
        const args = arguments 
            clearTimeout(debounceTimer) 
                debounceTimer 
            = setTimeout(() => func.apply(context, args), delay) 
    } 
}
function executeOrWait(execFunc, condition, waitFunc) {
    if (condition) {
        execFunc();
    } else {
        waitFunc(execFunc);
    }
}
function executeIfWhenDOMContentLoaded(func) {
    executeOrWait(
        func, 
        (
            document.readyState === "complete" 
            || document.readyState === "loaded" 
            || document.readyState === "interactive"
        ),
        () => window.addEventListener('DOMContentLoaded', func)
    );
}
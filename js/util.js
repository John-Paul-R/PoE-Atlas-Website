
export const throttle = (func, timeInterval) => {
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
export const debounce = (func, delay) => { 
    let debounceTimer 
    return function() { 
        const context = this
        const args = arguments 
            clearTimeout(debounceTimer) 
                debounceTimer 
            = setTimeout(() => func.apply(context, args), delay) 
    } 
}

var iframe_1 = document.getElementById('iframe_1_container_outer');
var iframe = {
    frame: iframe_1,
    show: ()=>iframe_1.classList.remove('hidden'),
    hide: ()=>iframe_1.classList.add('hidden'),
    toggle: ()=>iframe_1.classList.toggle('hidden'),
};
iframe_1.addEventListener('click', window.iframe.hide);
document.getElementById('iframe_1_exit').addEventListener('click', window.iframe.hide);


var searchbarFocus = (function(){
    let searchbars = document.getElementsByClassName('searchbar');
    for (const searchbar of searchbars) {
        searchbar.addEventListener('focusin', (e)=>searchbarFocus(e, searchbar, true), true);
        searchbar.addEventListener('focusout', (e)=>searchbarFocus(e, searchbar, false), true);
        searchbar.addEventListener("mouseenter", (e)=>searchbarFocus(e, searchbar, true, true), true);
        searchbar.addEventListener("mouseleave", (e)=>searchbarFocus(e, searchbar, false, true), true);
    }
    function searchbarFocus(e, searchbar, focused, mouse) {
        e.stopPropagation();
        if (mouse) {
            if (focused)
                searchbar.isHovered = true;
            else
                searchbar.isHovered = false;
        }
        if (focused) {
            gainFocus(searchbar)
        } else {
            loseFocus(searchbar);
        }
    }
    function gainFocus(elem) {
        gsap.to(elem, .15, { scale:1, opacity: 1 });
        elem.style.setProperty("box-shadow", "var(--shadow)");
    }
    function loseFocus(elem) {
        if (!elem.contains(document.activeElement) && !elem.isHovered) { //&& (true || elem.parentElement.querySelector(".searchField").value == "")
            gsap.to(elem, .15, { scale: .99, opacity: 0.8});
            elem.style.setProperty("box-shadow", "none");
            // elem.style.setProperty("border", "1px var(--color-element-1) solid");
        }
    }
})();

bindSearchbarFocus();

var searchbars; 
function bindSearchbarFocus(searchbarElements) {
    if (!searchbarElements) {
        searchbars = document.getElementsByClassName('searchbar');
    }
    for (let i=0; i<searchbars.length; i++) {
        searchbars[i].addEventListener('focusin', ()=>searchbarFocus('in'));
        searchbars[i].addEventListener('focusout', ()=>searchbarFocus('out'));
        searchbars[i].addEventListener("mouseenter", searchbarMouseEnter );
        searchbars[i].addEventListener("mouseleave", searchbarMouseLeave );
    }
}

function searchbarFocus(val) {
    let parent = event.target.parentElement;
    if (val == 'in') {
        gainFocus(parent)
    } else {
        if (!parent.isHovered && (true || event.target.parentElement.querySelector(".searchField").value == "")) {
            loseFocus(parent);
        }

    }
    //parent.style.setProperty('opacity', newOpacity);
}

function searchbarMouseEnter(e) {
    gainFocus(e.target);
    e.target.isHovered = true;
}
function searchbarMouseLeave(e) {
    loseFocus(e.target);
    e.target.isHovered = false;

}
function gainFocus(elem) {
    let newOpacity = 1;
    gsap.to(elem, .15, { scale:1, opacity: newOpacity });
    elem.style.setProperty("box-shadow", "var(--shadow)");
}
function loseFocus(elem) {
    let newOpacity = 1;
    if (!elem.contains(document.activeElement) && (true || elem.parentElement.querySelector(".searchField").value == "")) {
        newOpacity = 0.8
        //var default_scale = parseInt(parent.style.getPropertyValue('--default-scale'));
        gsap.to(elem, .15, { scale: .99, opacity: newOpacity});
        elem.style.setProperty("box-shadow", "none");
        // elem.style.setProperty("border", "1px var(--color-element-1) solid");
    }
}

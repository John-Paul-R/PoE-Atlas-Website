bindSearchbarFocus();

function bindSearchbarFocus(searchbarElements) {
    if (!searchbarElements) {
        searchbarElements = document.getElementsByClassName('searchbar');
    }
    for (let i=0; i<searchbarElements.length; i++) {
        searchbarElements[i].addEventListener('focusin', ()=>searchbarFocus('in'));
        searchbarElements[i].addEventListener('focusout', ()=>searchbarFocus('out'));
    }
}

function searchbarFocus(val) {
    let parent = event.target.parentElement
    let newOpacity = 1;
    if (val == 'in') {
        gsap.to(parent, .15, { scale:1, opacity: newOpacity });
        parent.style.setProperty("box-shadow", "var(--shadow)");
        parent.style.setProperty("border", "1px var(--color-base) solid");
    } else {
        if (true || event.target.parentElement.querySelector(".searchField").value == "") {
            newOpacity = 0.8
            //var default_scale = parseInt(parent.style.getPropertyValue('--default-scale'));
            gsap.to(parent, .15, { scale: .99, opacity: newOpacity});
            parent.style.setProperty("box-shadow", "none");
            parent.style.setProperty("border", "1px var(--color-element-1) solid");
        }

    }
    //parent.style.setProperty('opacity', newOpacity);
}
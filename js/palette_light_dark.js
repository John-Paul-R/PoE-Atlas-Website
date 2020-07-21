var buttonElements;
var paletteIndex;
const STORAGE_KEY = 'selectedPaletteIndex';
class ColorPalette {
    constructor (paletteName, base, background, element1, accent1, accent2, inverse, text, textInverse) {
        this.paletteName = paletteName;
        this.base = base;
        this.background = background;
        this.element1 = element1;
        this.accent1 = accent1;
        this.accent2 = accent2;
        this.inverse = inverse;
        this.text = text;
        this.textInverse = textInverse;
    }
}
var colorPalettes = [
     new ColorPalette('Light'   , '#fafafa', '#f0f0f0', '#e0e0e0', '#aaaaaa', '#888888', '#333333', '#454545', '#d0d0d0')
    ,new ColorPalette('Dark'    , '#252525', '#353535', '#252525', '#af0404', '#888888', '#f0f0f0', '#f0f0f0', '#414141')
]; //todo load this from external file? or from online library of available palettes?

function bindPaletteSwapButtons(btnElements) {
    if (!btnElements) {
        buttonElements = document.getElementsByClassName('swap_palette');
    } else {
        buttonElements = btnElements;
    }
    console.log(buttonElements);
    for (let i=0; i<buttonElements.length; i++) {
        buttonElements[i].addEventListener('click', swapPalette);
    }
}
bindPaletteSwapButtons();
loadStoredPalette();
function loadStoredPalette() {
    let stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
        paletteIndex = parseInt(stored, 10);
    } else {
        paletteIndex = 0;
        window.localStorage.setItem(STORAGE_KEY, '0');
    }
    displayPalette(paletteIndex);
}

export function swapPalette() {
    paletteIndex +=1;
    if (paletteIndex >= colorPalettes.length) {
        paletteIndex = 0;
    }
    displayPalette(paletteIndex);
    window.localStorage.setItem(STORAGE_KEY, paletteIndex);
}

export function displayPalette(paletteID) {
    const style = document.documentElement.style;
    let p = colorPalettes[paletteID];
    style.setProperty('--color-base',           p.base);
    style.setProperty('--color-background',     p.background);
    style.setProperty('--color-element-1',      p.element1);
    style.setProperty('--color-accent-1',       p.accent1);
    style.setProperty('--color-accent-2',       p.accent2);
    style.setProperty('--color-inverse',        p.inverse);
    style.setProperty('--color-text',           p.text);
    style.setProperty('--color-text-inverse',   p.textInverse);
    // for (let i=0; i<buttonElements.length; i++) {
    //     buttonElements[i].textContent = p.paletteName;
    // }
}
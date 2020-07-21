var buttonElements;
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

export function swapPalette() {
    const root = document.documentElement;
    let cPalette = root.style.getPropertyValue('--current-palette');
    
    if (cPalette == 0) {
        root.style.setProperty('--color-base', '#252525');
        root.style.setProperty('--color-background', '#353535');
        root.style.setProperty('--color-element-1', '#252525');//'#ff0000');
        root.style.setProperty('--color-accent-1', '#af0404');
        root.style.setProperty('--color-accent-2', '#888888');
        root.style.setProperty('--color-inverse', '#f0f0f0');
        root.style.setProperty('--color-text', '#f0f0f0');
        root.style.setProperty('--color-text-inverse', '#414141');
        root.style.setProperty('--current-palette', 1);
        for (let i=0; i<buttonElements.length; i++) {
            buttonElements[i].textContent = "Light";
        }
    } else if (cPalette == 1) {
        root.style.setProperty('--color-base', '#fafafa');
        root.style.setProperty('--color-background', '#f0f0f0');
        root.style.setProperty('--color-element-1', '#e0e0e0');
        root.style.setProperty('--color-accent-1', '#aaaaaa');
        root.style.setProperty('--color-accent-2', '#888888');
        root.style.setProperty('--color-inverse', '#333333');
        root.style.setProperty('--color-text', '#454545');
        root.style.setProperty('--color-text-inverse', '#d0d0d0');
        root.style.setProperty('--current-palette', 0);
        for (let i=0; i<buttonElements.length; i++) {
            buttonElements[i].textContent = "Dark";
        }
    }
}
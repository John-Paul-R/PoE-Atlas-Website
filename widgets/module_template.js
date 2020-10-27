import { SidebarWidget, sidebar } from '../js/widget.js';
// Begin Module
// moduleManager.register(initModule);
// todo moduleManager.addExternalStyle('link-to-stylesheet');
// todo moduleManager.addStyle('stylesheet-content');
function buildSidebarElem(textContent) {
    var sidebarElem = document.createElement('div');
    // HTML Building
    sidebarElem.textContent = textContent;
    return sidebarElem;
}
class ACustomizedSideBarWidget extends SidebarWidget {
    constructor(moduleName, displayName) {
        super(moduleName, displayName, () => buildSidebarElem(displayName));
        //do things
        this.instanceData = {
            interesting: "data",
        };
    }
}
sidebar.registerWidget(new SidebarWidget('MyBasicSidebarWidget', 'A Basic Widget', () => buildSidebarElem('words')));
sidebar.registerWidget(new ACustomizedSideBarWidget('SpecialSidebarWidget', 'A Special Widget'));
//# sourceMappingURL=module_template.js.map
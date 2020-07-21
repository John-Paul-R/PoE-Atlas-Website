
export { logger, Logger };

class Logger {
    constructor(defaultLevel='log', displayLevelNames=true, customLevels={}, enabled=true) {
        let logFunc;
        switch (defaultLevel) {
            case 'log': logFunc = console.log;
                break;
            case 'info': logFunc = console.info;
                break;
            case 'warn': logFunc = console.warn;
                break;
            case 'error': logFunc = console.error;
        }
        this.logFunc = logFunc;
        this.displayLevelNames = displayLevelNames;
        this.levels = {
            log: new LogLevel('log', ''),
            info: new LogLevel('info', '[INFO]: '),
            warn: new LogLevel('warn', '[WARN]: '),
            error: new LogLevel('error', '[ERROR]: ')
        }
        for (var key in customLevels) {
            this.levels[key] = customLevels[key];
        }
        this.enabled = enabled;
    }
    
    log(...msg) {if (this.enabled) {
        logFunc(this.levels.log.displayName+msg);
    }}
    info(...msg) {if (this.enabled) {
        console.info(this.levels.info.displayName+msg)
    }}
    warn(...msg) {if (this.enabled){
        console.warn(this.levels.warn.displayName+msg);
    }}
    error(...msg) {if (this.enabled) {
        console.error(this.levels.error.displayName+msg);
    }}
    table(tableArray) {if (this.enabled) {
        console.table(tableArray);
    }}
    group(headingMsg) {if (this.enabled) {
        console.group(headingMsg);
    }}
    groupCollapsed(headingMsg) {if (this.enabled) {
        console.groupCollapsed(headingMsg);
    }}
    groupEnd() {if (this.enabled) {
        console.groupEnd();
    }}

    setEnabled(bool) {
        this.enabled = bool;
    }
    isEnabled() {
        return this.enabled;
    }
}

class LogLevel {
    constructor(name, displayName) {
        this.name = name;
        this.displayName = displayName;
    }
}

var logger = new Logger();

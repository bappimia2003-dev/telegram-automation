"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInMemoryLogs = getInMemoryLogs;
exports.sleep = sleep;
exports.log = log;
exports.errLog = errLog;
const inMemoryLogs = [];
function getInMemoryLogs() {
    return inMemoryLogs;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function log(tag, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${tag}] ${message} ${optionalParams.length ? JSON.stringify(optionalParams) : ''}`.trim();
    console.log(entry);
    inMemoryLogs.push(entry);
    if (inMemoryLogs.length > 500)
        inMemoryLogs.shift();
}
function errLog(tag, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] [${tag}] ❌ ${message} ${optionalParams.length ? JSON.stringify(optionalParams) : ''}`.trim();
    console.error(entry);
    inMemoryLogs.push(entry);
    if (inMemoryLogs.length > 500)
        inMemoryLogs.shift();
}

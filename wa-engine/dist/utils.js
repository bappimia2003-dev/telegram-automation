"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
exports.log = log;
exports.errLog = errLog;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function log(tag, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${tag}] ${message}`, ...optionalParams);
}
function errLog(tag, message, ...optionalParams) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [${tag}] ❌ ${message}`, ...optionalParams);
}

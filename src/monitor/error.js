// src/monitor/error.js
export class ErrorMonitor {
    constructor(reporter) {
        this.reporter = reporter;
    }

    // JS执行错误
    monitorJsError() {
        window.addEventListener('error', (event) => {
            if (event.target instanceof HTMLElement) {
                // 资源加载错误（img/script/css）
                this.reporter.addToQueue({
                    type: 'resourceError',
                    target: event.target.src || event.target.href,
                    tagName: event.target.tagName,
                    message: event.message,
                    timestamp: Date.now(),
                });
            } else {
                // JS错误：收集堆栈信息
                this.reporter.addToQueue({
                    type: 'jsError',
                    message: event.message,
                    stack: event.error?.stack || '',
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    timestamp: Date.now(),
                    appVersion: this.reporter.appVersion, // 关联构建版本（关键！用于SourceMap还原）
                });
            }
        });
    }

    // Promise错误（含async/await）
    monitorPromiseError() {
        window.addEventListener('unhandledrejection', (event) => {
            this.reporter.addToQueue({
                type: 'promiseError',
                message: event.reason?.message || 'Promise rejection',
                stack: event.reason?.stack || '',
                timestamp: Date.now(),
                appVersion: this.reporter.appVersion,
            });
            event.preventDefault();
        });
    }

    init() {
        this.monitorJsError();
        this.monitorPromiseError();
    }
}
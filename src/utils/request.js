// 确保类正确导出，init方法存在
export class RequestMonitor {
    constructor(reporter) {
        this.reporter = reporter; // 接收reporter，用于上报请求数据
    }

    interceptXHR() {
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            this._requestInfo = { method, url, startTime: Date.now() };
            originalOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            const self = this;
            this.addEventListener('load', function () {
                if (self._requestInfo) {
                    self._requestInfo.duration = Date.now() - self._requestInfo.startTime;
                    self._requestInfo.status = this.status;
                    self._requestInfo.type = 'xhr';
                    self.reporter.addToQueue({ type: 'request', ...self._requestInfo });
                }
            });
            originalSend.apply(this, arguments);
        };
    }

    interceptFetch() {
        const originalFetch = window.fetch;
        window.fetch = async function (url, options = {}) {
            const startTime = Date.now();
            try {
                const response = await originalFetch(url, options);
                const duration = Date.now() - startTime;
                this.reporter.addToQueue({
                    type: 'request',
                    method: options.method || 'GET',
                    url,
                    duration,
                    status: response.status,
                    type: 'fetch',
                });
                return response;
            } catch (error) {
                this.reporter.addToQueue({
                    type: 'requestError',
                    method: options.method || 'GET',
                    url,
                    error: error.message,
                    duration: Date.now() - startTime,
                });
                throw error;
            }
        }.bind(this);
    }

    // 关键：init方法正确定义，初始化拦截逻辑
    init() {
        this.interceptXHR();
        this.interceptFetch();
    }
}
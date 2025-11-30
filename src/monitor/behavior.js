// src/monitor/behavior.js
export class BehaviorMonitor {
    constructor(reporter) {
        this.reporter = reporter;
        this.pageViewTracked = false;
    }

    // 监控页面浏览
    monitorPageView() {
        // 首次加载时记录页面浏览
        if (!this.pageViewTracked) {
            this.trackPageView();
            this.pageViewTracked = true;
        }

        // SPA应用中监听路由变化
        this.listenToRouteChanges();
    }

    trackPageView() {
        const pageData = {
            type: 'pageView',
            url: window.location.href,
            title: document.title,
            timestamp: Date.now(),
            referrer: document.referrer
        };

        this.reporter.addToQueue(pageData);
    }

    listenToRouteChanges() {
        // 监听 history.pushState 和 history.replaceState
        const originPushState = history.pushState;
        const originReplaceState = history.replaceState;

        history.pushState = function() {
            originPushState.apply(this, arguments);
            setTimeout(() => {
                this.trackPageView();
            }, 0);
        }.bind(this);

        history.replaceState = function() {
            originReplaceState.apply(this, arguments);
            setTimeout(() => {
                this.trackPageView();
            }, 0);
        }.bind(this);

        // 监听 popstate 事件（浏览器前进后退按钮）
        window.addEventListener('popstate', () => {
            setTimeout(() => {
                this.trackPageView();
            }, 0);
        });
    }

    // 监控点击行为
    monitorClicks() {
        document.addEventListener('click', (event) => {
            const clickData = {
                type: 'click',
                timestamp: Date.now(),
                x: event.clientX,
                y: event.clientY,
                target: this.getElementSelector(event.target),
                tag: event.target.tagName,
                text: event.target.innerText?.substring(0, 100) // 限制文本长度
            };

            this.reporter.addToQueue(clickData);
        }, true);
    }

    // 获取元素的选择器路径
    getElementSelector(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        
        let selector = element.tagName.toLowerCase();
        if (element.className && typeof element.className === 'string') {
            selector += '.' + element.className.split(' ').join('.');
        }
        
        return selector;
    }

    // 监控页面停留时间
    monitorPageStay() {
        let startTime = Date.now();
        
        // 页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                const stayData = {
                    type: 'pageStay',
                    duration: Date.now() - startTime,
                    timestamp: Date.now()
                };
                
                this.reporter.addToQueue(stayData);
            } else {
                startTime = Date.now();
            }
        });

        // 页面卸载前上报
        window.addEventListener('beforeunload', () => {
            const stayData = {
                type: 'pageStay',
                duration: Date.now() - startTime,
                timestamp: Date.now()
            };
            
            // 使用 sendBeacon 确保数据被发送
            if (this.reporter.reportUrl && navigator.sendBeacon) {
                navigator.sendBeacon(
                    this.reporter.reportUrl,
                    JSON.stringify([stayData])
                );
            }
        });
    }

    // 监控自定义事件
    monitorCustomEvents() {
        // 提供一个全局方法供用户记录自定义行为
        window.MonitorSDK.trackEvent = (eventName, eventData = {}) => {
            const customEventData = {
                type: 'customEvent',
                eventName,
                data: eventData,
                timestamp: Date.now()
            };
            
            this.reporter.addToQueue(customEventData);
        };
    }

    init() {
        this.monitorPageView();
        this.monitorClicks();
        this.monitorPageStay();
        this.monitorCustomEvents();
    }
}
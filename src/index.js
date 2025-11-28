// src/index.js
import { Reporter } from './utils/report';
import { PerformanceMonitor } from './monitor/performance';
import { ErrorMonitor } from './monitor/error';
import { FrameworkMonitor } from './monitor/framework';
import { RequestMonitor } from './utils/request';

export default class MonitorSDK {
    constructor(options) {
        // 初始化配置
        this.options = {
            reportUrl: options.reportUrl,
            appVersion: options.appVersion || '1.0.0',
            framework: options.framework,
        };

        // 初始化上报器
        this.reporter = new Reporter(this.options);

        // 初始化各监控模块
        this.initMonitors();
    }

    initMonitors() {
        new PerformanceMonitor(this.reporter).init();
        new ErrorMonitor(this.reporter).init();
        new FrameworkMonitor(this.reporter, this.options).init();
        new RequestMonitor(this.reporter).init();
    }
}

// 暴露到全局
window.MonitorSDK = MonitorSDK;
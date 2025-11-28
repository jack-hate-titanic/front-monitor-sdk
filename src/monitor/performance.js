// src/monitor/performance.js
export class PerformanceMonitor {
    constructor(reporter) {
        this.reporter = reporter;
        this.performanceData = { type: 'performance' };
    }

    // 捕获FP（首次绘制）、FCP（首次内容绘制）
    capturePaintMetrics() {
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach(entry => {
            if (entry.name === 'first-paint') this.performanceData.fp = entry.startTime;
            if (entry.name === 'first-contentful-paint') this.performanceData.fcp = entry.startTime;
        });
    }

    // 捕获LCP（最大内容绘制，兼容动态内容）
    captureLcpMetric() {
        if (!window.PerformanceObserver) return;

        const lcpObserver = new PerformanceObserver(entries => {
            const lcpEntry = entries.getEntries()[0];
            this.performanceData.lcp = lcpEntry.startTime;
            // LCP可能多次触发（动态内容），取最后一次
            this.reporter.addToQueue(this.performanceData);
        });

        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    }

    // 初始化性能监控
    init() {
        this.capturePaintMetrics();
        this.captureLcpMetric();
        // 监听页面加载完成，补充导航性能数据
        window.addEventListener('load', () => {
            const navEntry = performance.getEntriesByType('navigation')[0];
            this.performanceData.loadTime = navEntry.loadEventEnd - navEntry.navigationStart;
            this.reporter.addToQueue(this.performanceData);
        });
    }
}
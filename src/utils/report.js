// src/utils/report.js
export class Reporter {
    constructor(options) {
        this.reportUrl = options.reportUrl; // 后端上报接口
        this.appVersion = options.appVersion || '1.0.0'; // 构建版本（关联SourceMap）
        this.queue = []; // 上报队列
        this.batchSize = 10; // 批量上报阈值
        this.reportInterval = 5000; // 定时上报间隔（5s）
        this.maxRetries = 3; // 失败重试次数

        // 启动定时上报
        this.startReportTimer();
    }

    // 添加数据到队列
    addToQueue(data) {
        this.queue.push(data);
        // 队列满了立即上报
        if (this.queue.length >= this.batchSize) {
            this.reportBatch();
        }
    }

    // 批量上报
    async reportBatch() {
        if (this.queue.length === 0) return;
        const batchData = [...this.queue];
        this.queue = []; // 清空队列（失败后会重新加入）

        try {
            const response = await fetch(this.reportUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batchData),
            });
            if (!response.ok) throw new Error('上报失败');
            console.log('批量上报成功');
        } catch (error) {
            console.error('上报失败，重试中...', error);
            // 失败后重新加入队列，并重试
            this.queue.unshift(...batchData);
            this.retryReport();
        }
    }

    // 失败重试
    retryReport(retries = 0) {
        if (retries >= this.maxRetries) {
            console.error('上报重试次数耗尽，数据丢弃');
            return;
        }
        setTimeout(() => {
            this.reportBatch(retries + 1);
        }, 1000 * Math.pow(2, retries)); // 指数退避重试
    }

    // 启动定时上报
    startReportTimer() {
        setInterval(() => {
            this.reportBatch();
        }, this.reportInterval);
    }
}
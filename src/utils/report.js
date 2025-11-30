// 数据上报核心逻辑（image.gif优先）
class Report {
    constructor(config) {
        this.reportUrl = config.reportUrl; // 上报接口地址（需返回204或1x1 GIF）
        this.appId = config.appId;
        this.cacheKey = `monitor_sdk_cache_${this.appId}`;
        this.batchSize = 5; // 因image.gif支持数据量小，批量阈值下调为5条
        this.reportTimer = null;
        this.cacheQueue = this.loadCache();
        // 1x1透明GIF的base64（避免依赖外部图片，减少请求失败风险）
        this.emptyGif = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        this.bindUnloadEvent(); // 绑定页面卸载事件
    }

    // 核心上报入口：按优先级选择上报方式
    async report(data) {
        const formattedData = data;
        this.cacheQueue.push(formattedData);

        // 达到批量阈值或定时触发上报
        if (this.cacheQueue.length >= this.batchSize) {
            await this.sendBatch();
        } else {
            this.startReportTimer();
        }
    }

    // 批量发送：image.gif → sendBeacon → XHR 降级逻辑
    async sendBatch() {
        if (this.cacheQueue.length === 0) return;

        const sendQueue = [...this.cacheQueue];
        this.cacheQueue = [];
        const serializedData = JSON.stringify(sendQueue);

        try {
            // 1. 优先使用image.gif（仅当数据≤2KB时尝试）
            if (serializedData.length <= 2048) { // 2KB安全阈值，避免URL超长
                const isImageSuccess = this.sendByImageGif(sendQueue);
                if (isImageSuccess) {
                    console.log('image.gif 上报成功');
                    return;
                }
            }

            // 2. 降级使用sendBeacon（数据超2KB或image.gif失败）
            if (navigator.sendBeacon) {
                const isBeaconSuccess = this.sendByBeacon(serializedData);
                if (isBeaconSuccess) {
                    console.log('sendBeacon 上报成功');
                    return;
                }
            }

            // 3. 最终降级使用XHR（兜底所有场景）
            const isXhrSuccess = await this.sendByXHR(serializedData);
            if (isXhrSuccess) {
                console.log('XHR 上报成功');
                return;
            }

            // 所有方式失败，缓存数据
            throw new Error('所有上报方式均失败');
        } catch (error) {
            console.error('上报失败，缓存数据:', error);
            this.cacheQueue = [...sendQueue, ...this.cacheQueue];
            this.saveCache();
        }
    }

    // 方式1：image.gif 上报（首选）
    sendByImageGif(queue) {
        try {
            // 1. 拼接GET参数（序列化+URL编码，避免特殊字符）
            const params = new URLSearchParams();
            params.append('payload', encodeURIComponent(JSON.stringify(queue))); // 二次编码，确保安全

            // 2. 构造上报URL（接口+参数，末尾拼接空GIF避免浏览器渲染异常）
            const reportUrlWithParams = `${this.reportUrl}?${params.toString()}&t=${Date.now()}`; // 添加时间戳防缓存

            // 3. 创建img标签，请求GIF
            const img = new Image(1, 1); // 1x1像素，不占用页面空间
            img.src = reportUrlWithParams;
            img.style.display = 'none';
            img.style.position = 'absolute';
            img.style.left = '-9999px';
            img.style.top = '-9999px';

            // 4. 监听加载/错误事件（仅清理资源，无法确认上报成功）
            img.onload = () => {
                // 加载成功后，替换为base64 GIF，避免重复请求
                img.src = this.emptyGif;
                document.body.removeChild(img);
            };
            img.onerror = (error) => {
                console.error('image.gif 上报失败:', error);
                img.src = this.emptyGif;
                document.body.removeChild(img);
            };

            // 5. 防止内存泄漏：页面卸载时清理img
            window.addEventListener('unload', () => {
                img.onload = null;
                img.onerror = null;
            });

            document.body.appendChild(img);
            return true; // 表示请求发起成功（不代表上报成功）
        } catch (error) {
            console.error('image.gif 上报失败:', error);
            return false;
        }
    }

    // 方式2：sendBeacon 上报（降级）
    sendByBeacon(dataStr) {
        try {
            // 包装为Blob，支持JSON格式（部分浏览器需指定Content-Type）
            const blob = new Blob([dataStr], { type: 'application/json; charset=utf-8' });
            // sendBeacon返回true表示浏览器已接收请求（后台异步发送）
            return navigator.sendBeacon(this.reportUrl, blob);
        } catch (error) {
            console.error('sendBeacon 上报失败:', error);
            return false;
        }
    }

    // 方式3：XHR 上报（兜底）
    sendByXHR(dataStr) {
        return new Promise((resolve) => {
            // 适配IE7+：使用ActiveXObject（可选，根据业务兼容需求决定）
            const XHR = window.XMLHttpRequest ? XMLHttpRequest : ActiveXObject('Microsoft.XMLHTTP');
            const xhr = new XHR();

            xhr.open('POST', this.reportUrl, true);

            // 设置请求头（支持自定义CSRF、跨域配置）
            xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');


            // 跨域配置（若需携带Cookie，需服务端允许）
            xhr.withCredentials = false;

            // 响应处理
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    // 兼容IE：IE可能返回1223（等价于204 No Content）
                    const successStatus = [200, 201, 204, 1223];
                    resolve(successStatus.includes(xhr.status));
                }
            };

            // 错误处理
            xhr.onerror = () => {
                console.error('XHR 上报失败（网络错误）');
                resolve(false);
            };

            // 超时处理（5秒超时）
            xhr.timeout = 5000;
            xhr.ontimeout = () => {
                console.error('XHR 上报超时');
                resolve(false);
            };

            // 发送数据
            xhr.send(dataStr);
        });
    }

    // 页面卸载时的特殊处理（优先sendBeacon，保证可靠性）
    bindUnloadEvent() {
        window.addEventListener('beforeunload', () => {
            if (this.cacheQueue.length === 0) return;

            const dataStr = JSON.stringify(this.cacheQueue);
            let isReported = false;

            // 1. 页面卸载时，优先用sendBeacon（比image.gif可靠）
            if (navigator.sendBeacon) {
                isReported = this.sendByBeacon(dataStr);
            }

            // 2. sendBeacon不支持时，用image.gif兜底（仅少量数据）
            if (!isReported && dataStr.length <= 2048) {
                isReported = this.sendByImageGif(this.cacheQueue);
            }

            // 3. 无论是否成功，清空缓存（避免重复上报）
            this.cacheQueue = [];
            this.saveCache();
        });
    }

    loadCache() {
        try {
            const cache = localStorage.getItem(this.cacheKey);
            return cache ? JSON.parse(cache) : [];
        } catch (error) {
            console.error('加载缓存失败:', error);
            return [];
        }
    }

    saveCache() {
        try {
            // 限制缓存大小（最多50条），避免localStorage溢出
            const limitQueue = this.cacheQueue.slice(0, 50);
            localStorage.setItem(this.cacheKey, JSON.stringify(limitQueue));
        } catch (error) {
            console.error('保存缓存失败:', error);
        }
    }

    startReportTimer() {
        if (this.reportTimer) clearTimeout(this.reportTimer);
        // 定时上报间隔缩短为5秒（因image.gif批量阈值小，避免缓存堆积）
        this.reportTimer = setTimeout(() => {
            this.sendBatch();
        }, 5000);
    }
}
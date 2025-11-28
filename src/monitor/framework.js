// src/monitor/framework.js
export class FrameworkMonitor {
    constructor(reporter, options = {}) {
        this.reporter = reporter;
        this.framework = options.framework; // 指定框架：vue/react
        this.React = window.React; // 从全局获取React（避免额外引入）
    }

    // Vue错误捕获（支持Vue2/Vue3）
    monitorVueError() {
        if (!window.Vue) return;
        // Vue2：Vue.config.errorHandler
        // Vue3：app.config.errorHandler
        const Vue = window.Vue;
        const originalErrorHandler = Vue.config.errorHandler;

        Vue.config.errorHandler = (err, vm, info) => {
            this.reporter.addToQueue({
                type: 'vueError',
                message: err.message,
                stack: err.stack,
                component: vm?.$options?.name || 'anonymous',
                lifecycle: info, // 错误发生的生命周期（如mounted、updated）
                appVersion: this.reporter.appVersion,
            });
            // 保留原有错误处理
            if (originalErrorHandler) originalErrorHandler(err, vm, info);
        };
    }

    // React错误捕获（ErrorBoundary+全局兜底，修复JSX）
    monitorReactError() {
        if (!this.React) return;
        const React = this.React;

        // 1. 提供React ErrorBoundary组件（需用户在项目中使用）
        window.MonitorSDK.ReactErrorBoundary = class ReactErrorBoundary extends React.Component {
            constructor(props) {
                super(props);
                this.state = { hasError: false };
            }

            // 静态方法：捕获错误并更新状态
            static getDerivedStateFromError() {
                return { hasError: true };
            }

            // 捕获错误并上报
            componentDidCatch(err, errorInfo) {
                this.props.reporter.addToQueue({
                    type: 'reactError',
                    message: err.message,
                    stack: err.stack,
                    componentStack: errorInfo.componentStack,
                    appVersion: this.props.reporter.appVersion,
                });
            }

            render() {
                if (this.state.hasError) {
                    // 修复JSX：确保React变量可用（通过this.props.react获取）
                    const React = this.props.react;
                    return this.props.fallback || React.createElement('div', null, '页面出错了');
                }
                return this.props.children;
            }
        };

        // 2. 给ErrorBoundary组件绑定React依赖（避免用户手动传入）
        window.MonitorSDK.ReactErrorBoundary.defaultProps = {
            react: React
        };

        // 3. 全局兜底捕获未被ErrorBoundary捕获的错误
        window.addEventListener('unhandledrejection', (event) => {
            if (event.reason?.stack?.includes('React')) {
                this.reporter.addToQueue({
                    type: 'reactUnhandledError',
                    message: event.reason.message,
                    stack: event.reason.stack,
                    appVersion: this.reporter.appVersion,
                });
            }
        });
    }

    init() {
        if (this.framework === 'vue') this.monitorVueError();
        if (this.framework === 'react') this.monitorReactError();
        // 未指定框架则自动检测
        if (!this.framework) {
            window.Vue && this.monitorVueError();
            window.React && this.monitorReactError();
        }
    }
}
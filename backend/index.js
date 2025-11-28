const Koa = require('koa');
const Router = require('koa-router');
const cors = require('@koa/cors'); // 注意：这里是@koa/cors，不是koa-cors！
const bodyParser = require('koa-bodyparser');
const multer = require('@koa/multer');
const fs = require('fs-extra');
const path = require('path');

const app = new Koa();
const router = new Router();

// ===================== 核心：完善CORS跨域配置 =====================
app.use(cors({
    // 1. 允许的前端源（开发环境可设为*，生产环境替换为你的前端域名，如https://xxx.github.io）
    origin: '*',
    // 2. 允许的请求方法（必须包含OPTIONS预检方法和POST上报方法）
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    // 5. 预检请求缓存时间（秒）：浏览器会缓存该配置，减少重复OPTIONS请求
    maxAge: 86400, // 24小时
}));

// ===================== 其他中间件 =====================
app.use(bodyParser()); // 解析JSON请求体

// 存储目录配置
const STORAGE_DIR = path.join(__dirname, 'storage');
const DATA_DIR = path.join(STORAGE_DIR, 'data');
const SOURCEMAP_DIR = path.join(STORAGE_DIR, 'sourcemaps');
fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(SOURCEMAP_DIR);

// ===================== 接口路由 =====================
// 1. 监控数据上报接口（POST）
router.post('/api/report', async (ctx) => {
    try {
        const reportData = ctx.request.body;
        const filename = `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
        // 写入文件存储
        await fs.writeFile(
            path.join(DATA_DIR, filename),
            JSON.stringify(reportData, null, 2),
            'utf8'
        );
        ctx.status = 200;
        ctx.body = { code: 0, message: '上报成功', requestId: filename };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { code: -1, message: '上报失败', error: error.message };
    }
});

// 2. SourceMap上传接口（POST）
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, SOURCEMAP_DIR),
    filename: (req, file, cb) => {
        const { version } = req.body;
        const fileName = `monitor-sdk-${version}.js.map`;
        cb(null, fileName);
    },
});
const upload = multer({ storage });
router.post('/api/upload-sourcemap', upload.single('sourcemap'), async (ctx) => {
    try {
        const { version } = ctx.req.body;
        if (!version || !ctx.file) {
            ctx.status = 400;
            ctx.body = { code: -1, message: '缺少版本号或SourceMap文件' };
            return;
        }
        ctx.status = 200;
        ctx.body = { code: 0, message: 'SourceMap上传成功' };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { code: -1, message: 'SourceMap上传失败', error: error.message };
    }
});

// 3. 错误还原接口（POST）
router.post('/api/restore-error', async (ctx) => {
    try {
        const { stack, appVersion } = ctx.request.body;
        if (!stack || !appVersion) {
            ctx.status = 400;
            ctx.body = { code: -1, message: '缺少错误堆栈或应用版本' };
            return;
        }

        const ErrorStackParser = require('error-stack-parser');
        const parsedStacks = ErrorStackParser.parse({ stack });

        const sourceMapPath = path.join(SOURCEMAP_DIR, `monitor-sdk-${appVersion}.js.map`);
        if (!await fs.pathExists(sourceMapPath)) {
            ctx.status = 404;
            ctx.body = { code: -1, message: `未找到版本${appVersion}的SourceMap文件` };
            return;
        }
        const sourceMapContent = await fs.readFile(sourceMapPath, 'utf8');

        const { SourceMapConsumer } = require('source-map-js');
        const consumer = await new SourceMapConsumer(sourceMapContent);

        const restoredStacks = await Promise.all(
            parsedStacks.map(async (stackFrame) => {
                const originalPos = consumer.originalPositionFor({
                    line: stackFrame.lineNumber,
                    column: stackFrame.columnNumber,
                });

                let sourceContent = '源码文件未找到';
                if (originalPos.source) {
                    const sourceFilePath = path.join(__dirname, '..', originalPos.source);
                    if (await fs.pathExists(sourceFilePath)) {
                        sourceContent = await fs.readFile(sourceFilePath, 'utf8');
                        const prettier = require('prettier');
                        sourceContent = prettier.format(sourceContent, {
                            parser: 'babel',
                            singleQuote: true,
                            semi: true,
                            printWidth: 120,
                        });
                    }
                }

                return {
                    functionName: stackFrame.functionName,
                    fileName: stackFrame.fileName,
                    lineNumber: stackFrame.lineNumber,
                    columnNumber: stackFrame.columnNumber,
                    originalSource: originalPos.source || '未知源码文件',
                    originalLine: originalPos.line || '未知行号',
                    originalColumn: originalPos.column || '未知列号',
                    originalFunctionName: originalPos.name || '未知函数名',
                    sourceContent: sourceContent,
                };
            })
        );

        consumer.destroy();
        ctx.status = 200;
        ctx.body = { code: 0, message: '错误还原成功', data: restoredStacks };
    } catch (error) {
        ctx.status = 500;
        ctx.body = { code: -1, message: '错误还原失败', error: error.message };
    }
});

// ===================== 注册路由+启动服务 =====================
app.use(router.routes()).use(router.allowedMethods());

// 注意：用户当前后端端口是3002，需改为3002（之前是3001）
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Koa后端服务启动成功：http://localhost:${PORT}`);
    console.log(`允许跨域的前端源：http://127.0.0.1:5500、http://localhost:5500等`);
});
# 形转 · Model Converter

免费、无需上传文件的 **STL / 3MF 双向转换工具**。模型在浏览器 Web Worker 中处理，支持大网格和多零件 3MF。

**在线使用：https://model.white-box.cc**

- **3MF → STL**：提取模型几何，供接受 STL 的软件或打印服务使用。
- **STL → 3MF**：精确合并重复顶点，压缩存储并记录所选单位；不做减面。
- 支持 3MF 组件引用、位置变换和单位换算。
- 分离输入大小、解压大小和面数限制，转换失败时给出具体原因。

实测约 187 万三角面的模型：约 93 MB STL → 36.5 MB 3MF，逐项校验后三角面的顶点坐标保持一致。不同模型的压缩效果不同。

## 本地运行（免费版）

需要 Node.js 22.12+ 和 npm，无需 Python、Docker 或 Cloudflare 账号。

```sh
npm ci
npm run dev:free
```

生产构建：

```sh
npm run build:free
npm run check
npm run test:web
```

## 部署免费版

1. 使用 `wrangler login` 登录自己的 Cloudflare 账号。
2. 修改 `wrangler.preview.jsonc` 中的 Worker 名称；删除 `routes` 使用 workers.dev，或改成自己的自定义域名。
3. 删除或替换 `web/index.html` 中的 Cloudflare Web Analytics 统计代码，避免将自建站统计发送到演示站的账号。
4. 运行 `npm run deploy:free`。

该配置只使用静态资源和轻量 Worker，不创建付费 CAD 容器。生产站接入 Cloudflare Web Analytics 记录访问和性能信息；转换程序不上传模型文件。统计脚本的公开站点 token 不是管理凭据。

## 可选 CAD 服务（未在演示站启用）

仓库也保留了 STEP 转换的实验性服务端实现；免费版不提供 STEP 转换。

需要 Python 3.12+。安装 `cad/requirements.txt` 后，运行 `PORT=8788 python cad/server.py`，另一个终端执行 `npm run dev`。本地 API 无口令校验，仅应绑定可信开发环境。

部署 CAD 服务需要 Docker、Workers Paid 及 Containers 权限，会产生云端资源费用：修改 `wrangler.jsonc` 的名称和域名后运行 `npm run deploy`，然后用 `wrangler secret put ACCESS_KEY` 设置访问口令。未设置口令时 API 拒绝访问。不要将口令提交到仓库。

容器最多一个实例，一次执行一个任务，空闲 10 分钟休眠。

## 验证

- `python -m unittest discover -s tests -v`：六方向转换、尺寸、单位、开放网格拒绝及可选真实 3MF 样本。
- `node tests/browser.mjs`：本地网页真实模型互转、下载、桌面/手机布局。测试用用户下载目录中的坐姿矫正样本。
- `node tests/api.mjs`：上传、轮询、STEP 实体结果下载及 STEP → 3MF。需要 `/private/tmp/converter-box.stl` 测试盒子。
- `npm run check && npm run build`。

## 数据和限制

3MF ↔ STL 在浏览器内转换。STEP 相关任务上传 CAD 容器；模型不发送给其他服务。临时结果最多保留一小时，容器休眠、重启或部署后可能提前清除；请及时下载。没有永久历史记录。

免费版输入限制：3MF 50 MB、STL 200 MB（CAD 版本输入仍为 50 MB）、浏览器网格 3,000,000 面（CAD 服务仍为 200,000 面）、浏览器端 3MF 模型数据解压后 300 MB（不解压无关图片和打印配置），CAD 服务仍限制归档总解压大小 150 MB；CAD 子进程最多运行 8 分钟。输出统一为毫米。STL 无单位，需手动指定输入单位。输出 STL 合并零件，3MF 尽可能保留分组；STL 本身不含零件名称，无法恢复原始分组语义。颜色、材质与打印机配置不保留。

网格转 STEP 检查闭合性，缝合并检查实体，合并共面面片，导出后重新读取并验证实体数和有效性。不自动恢复参数化历史、圆柱或复杂曲面，不保证 Shapr3D 中每种编辑操作均成功。STEP 回读通过不等于 Shapr3D 实际导入验证。STEP 网格化精度为 0.05 / 0.1 / 0.3 mm，曲面导出网格后往返无法恢复原始曲面。

## 结构

- `web/`：中文界面、浏览器网格转换、带单位和组件变换的 3MF 读取器。
- `worker/index.ts`：访问口令、路径校验和容器转发。
- `cad/server.py`：限并发异步任务、临时文件、超时和清理。
- `cad/convert.py`：OpenCascade / trimesh 转换、实体校验。

## 许可证

本项目原创代码采用 MIT 许可证，见 [LICENSE](LICENSE)。第三方依赖遵循各自许可证；可选 CAD 服务使用 OpenCascade 及其 Python 绑定。

大模型测试使用本地自备样本，仓库不包含用户模型文件。`tests/archive.test.mjs` 使用代码生成的测试数据，无需外部样本。

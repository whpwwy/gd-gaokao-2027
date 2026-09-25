# 广东省高考历史信息查询推荐（微信小程序）

一款**定位为"历史数据查询工具"**的微信小程序：把广东新高考（2021–2026，当前为物理类）的院校专业组投档分、一分一段表、选科要求等公开数据离线打包，提供**按分数查院校、按分数查位次/同位分、按院校查录取分**三大查询能力，并基于等位次法给出"冲 / 稳 / 保"志愿推荐。运行时不联网、不收集个人敏感信息。

- AppID：`wxc4fcdc670a2ff57a`
- 数据范围：广东省 · 物理类 · 2021–2026 年（后续可扩展历史类等其他类别）
- 开发框架：微信原生小程序 + TypeScript（无云开发、无后端服务）

---

## 一、功能特性

1. **按分数搜院校 + 志愿推荐**
   - 输入分数 → 换算全省位次 → 以等位次法匹配近年"院校专业组"，输出 **冲 / 稳 / 保** 三档候选
   - 筛选条件：院校地区（**多选**）、办学层次、办学性质、仅看 985 / 211、院校名称关键词、**专业组最少计划招生人数**（留空 = 不约束）
   - 结果页：顶部"冲/稳/保"数字可点击平滑滚动定位；三个分区可折叠/展开
2. **按分数查位次与历年同位分**
   - 任意分数 → 该年一分一段表中的全省位次；并按"相同位次"换算其他年份的同位分
3. **按院校查录取分与选科**
   - 院校搜索（名称 / 代码模糊匹配）→ 院校详情：年度校线趋势、历年专业组投档表（计划/投档/最低分/最低排位）、专业选科要求（可展开查看组内具体专业）
4. **收藏**：院校、专业组两类收藏，本地持久化；专业组标签旁提供"什么是院校专业组"的概念说明
5. **隐私**：不登录、不授权敏感权限、不发起网络请求，全部数据离线内置

---

## 二、技术栈

| 项 | 选择 |
|---|---|
| 小程序框架 | 微信原生（WXML / WXSS / TS），渲染组件框架 glass-easel |
| 语言 | TypeScript（`strict` 严格模式，CommonJS 输出，ES2020） |
| 数据构建 | Node.js 脚本（仅用内置 `fs`/`zlib`，无第三方运行时依赖） |
| 开发依赖 | `typescript`、`miniprogram-api-typings` |
| 数据形态 | 构建产物为紧凑数组 + 位标志 + 字典索引的 JS 模块，配套手工维护 `.d.ts` |

---

## 三、目录结构

```
For2027eea/
├─ project.config.json          # 微信开发者工具项目配置（appid、编译/压缩/分包等）
├─ project.private.config.json  # 本机私有配置（已 .gitignore，不入库）
├─ tsconfig.json                # TS 严格编译配置（typeRoots 指向 ./typings）
├─ package.json
├─ data/                        # 原始数据源（手工/脚本采集，见“数据来源”）
│   ├─ 广东高考物理类(2021-2026)高校录取分数.csv
│   ├─ 物理类一分一段表(2021-2026)总表.csv
│   ├─ 院校专业选科要求.csv
│   ├─ 院校属性补充表.csv
│   ├─ gaokao-pro_school-index.json.gz
│   └─ gaokao-pro_group-majors.json
├─ scripts/
│   ├─ build-data.mjs           # 数据构建：CSV/gzip 清洗 → 小程序数据产物
│   ├─ verify-logic.mjs         # 逻辑回归验证（60 项断言）
│   ├─ probe-group-coverage.mjs # 一次性：探测专业组映射覆盖率
│   └─ draw-logo.ps1            # 小程序 logo 绘制脚本（GDI+，原创图形）
├─ typings/                     # 微信小程序 API 类型声明（typeRoots）
└─ miniprogram/                 # 小程序根目录（miniprogramRoot）
    ├─ app.ts / app.json / app.wxss
    ├─ images/logo.png
    ├─ data/                    # 构建产物（主包数据）+ 配套 .d.ts
    │   ├─ schools.js  admissions.js  rank-tables.js  manifest.js
    ├─ services/                # 业务服务层（主包，页面共享）
    │   ├─ types.ts  data-service.ts  rank.ts
    │   ├─ recommend.ts  favorites.ts  nav.ts
    ├─ pages/                   # 主包页面（7 个）
    └─ subpkg/                  # 分包：院校详情
        ├─ data/subjects.js (+.d.ts)
        ├─ services/subject.ts
        └─ pages/school-detail/
```

---

## 四、页面说明

页面在 [miniprogram/app.json](miniprogram/app.json) 中注册。

### 主包页面

| 路径 | 作用 |
|---|---|
| `pages/index/index` | 首页：三大功能入口；配置转发/朋友圈分享（含 logo） |
| `pages/rank/rank` | 位次查询：输入分数与年份 → 位次 + 历年同位分 |
| `pages/recommend/recommend` | 推荐表单：分数/年份/数量 + 全部筛选条件 |
| `pages/recommend-result/recommend-result` | 推荐结果：冲/稳/保三档，锚点跳转 + 分区折叠 |
| `pages/school-search/school-search` | 院校搜索：名称/代码模糊搜索 → 进入详情 |
| `pages/favorites/favorites` | 我的收藏：院校/专业组列表，长按删除 |
| `pages/about/about` | 数据说明、隐私说明、免责声明 |

### 分包页面

| 路径 | 作用 |
|---|---|
| `subpkg/pages/school-detail/school-detail` | 院校详情：属性标签、年度校线趋势、历年专业组投档表、专业选科要求 |

分包相关配置：
- `subPackages`：分包根目录 `subpkg`，仅含院校详情一个页面
- `preloadRule`：进入推荐结果 / 院校搜索 / 收藏页时预加载分包，减少进入详情的等待与加载竞态
- `lazyCodeLoading: "requiredComponents"`：按需注入组件代码

---

## 五、服务层架构

服务层位于 [miniprogram/services/](miniprogram/services/)，页面只负责交互与渲染，业务逻辑全部收敛在此。

| 模块 | 职责 |
|---|---|
| `types.ts` | 全部业务领域类型（`School`、`AdmissionRecord`、`RecommendCandidate`、`RecommendFilters` 等）；展示辅助函数 `formatGroupLabel()`（`206`→`206专业组`，缺失→`未分组`） |
| `data-service.ts` | 单例 `dataService`：加载 4 个数据产物，转换为面向页面的友好结构，提供院校查询/搜索、投档记录、一分一段表等只读接口 |
| `rank.ts` | 位次服务：`rankAtScore()`（分数→位次）、`scoreAtRank()`（位次→分数）、`equivalentsByScore()` / `equivalentsByRank()`（历年同位分） |
| `recommend.ts` | 推荐服务：聚合专业组近三年位次 → 冲稳保分档 → 概率评估 → 配额截取与补位；`emptyFilters()` 默认筛选 |
| `favorites.ts` | 收藏服务：基于 `wx.storage`（键 `gaokao_favorites_v1`）的增删查改 |
| `nav.ts` | 导航守卫 `go()`：对同一目标页面 600ms 内的重复跳转去抖，规避并发 `navigateTo` 导致的路由错误 |

分包内另有 [subpkg/services/subject.ts](miniprogram/subpkg/services/subject.ts)：读取 `subjects.js`，提供专业类选科视图、报考资格判断 `canApply()` 与中文简述 `describe()`。

**数据流：**

```
data/(CSV/gzip) ──build-data.mjs──▶ miniprogram/data/*.js
                                          │ require
                                          ▼
                        data-service（单例，内存索引）
                          ┌───────────────┼───────────────┐
                          ▼               ▼               ▼
                       rank.ts       recommend.ts      各页面
```

---

## 六、核心算法

### 1. 分数 ↔ 位次换算（[rank.ts](miniprogram/services/rank.ts)）

一分一段表按分数**从高到低**排列，累计人数即全省位次。
- `rankAtScore`：先处理越界（高于表顶 / 低于表底），表内用**二分查找**定位分数 ≤ 目标分的最高一行，返回其累计人数及是否精确命中。
- `scoreAtRank`：二分查找累计人数首次 ≥ 目标位次的一行，返回对应分数（位次超出表下界返回 `null`）。

### 2. 历年同位分

以"相同位次"为桥梁：基准年分数 → 位次 → 在其他年份表中反查分数，得到各年同位分（`equivalentsByScore`）；也可直接以位次为基准换算（`equivalentsByRank`）。

### 3. 冲 / 稳 / 保推荐（[recommend.ts](miniprogram/services/recommend.ts)）

采用**等位次法**，以"院校 + 专业组"为最小推荐单位：

1. **聚合**：取每校各专业组**最近 3 年**有效（有人投档且有最低排位）的位次，以最近一年为参考位次 `refRank`。
2. **余量**：`margin = (refRank − 用户位次) / 用户位次`；正值代表用户位次更靠前、占优。
3. **分档**：
   - 冲 `reach`：`-15% ≤ margin < 0`（位次略低于门槛，有风险）
   - 稳 `match`：`0 ≤ margin < 20%`（位次相当，把握较大）
   - 保 `safety`：`margin ≥ 20%`（明显占优，用于兜底）
   - `margin < -15%` 直接淘汰。
4. **概率评估**：结合余量、近三年位次波动幅度 `volatility`（极差 / 中位值）、数据年数，给出高 / 中 / 低参考概率；仅单年数据时最高只给"中"。
5. **配额与补位**：默认按 30% 冲 / 40% 稳 / 30% 保 截取；不足时按"保底 → 稳 → 冲"顺序从候选池补足。
6. **筛选**：地区（多值并集）、层次、办学性质、985/211、名称关键词在院校层过滤；最少计划人数 `minPlan` 按专业组最近一年计划数过滤。

> 推荐结果是基于历史投档数据的**参考信息**，不构成录取承诺。

---

## 七、数据构建管线

[scripts/build-data.mjs](scripts/build-data.mjs) 仅依赖 Node.js 内置模块：

1. 解析 `data/` 内 CSV（支持双引号字段、BOM）与 gzip JSON；
2. 归一化：截断值（"683以上"/"178以内"）解析、选科再选要求结构化、院校属性合并（开源索引 + 补充表）；
3. 输出紧凑数据模块：
   - **schools.js**：`{v, rows:[[code,name,region,city,level,type,nature,belong,flags],…]}`，`flags` 用位标志表示 985/211/双一流；
   - **admissions.js**（v2）：`{v, years, schools:[{c, a:[[yearIdx,group,plan,admitted,minScore,minRank,flags],…]}], groupMajors}`；
   - **rank-tables.js**：`{v, tables:{"年份":[[score,count,cumulative],…]}}`；
   - **subjects.js**（v2，分包）：`{v, subjects:[7科], majors:[专业名称字典], schools:[{c, items:[[level,categoryIdx,first,mode,subjectIdxs,majorIdxs],…]}]}`；
   - **manifest.js**：版本、年份、数据来源、统计信息。
4. 执行内置校验断言（院校数一致性、官方本科线位次锚点、位次单调性、引用完整性、截断值解析）。

每个数据产物在同目录配有手工维护的 `.d.ts`，供 TS 识别数组位置含义。

---

## 八、包体积优化

小程序单个分包上限 2MB。项目采取的措施：

- **字典化/索引化**：选科表中专业（类）名、具体专业名、科目名全部跨校去重存入字典，行内只存索引；
- **紧凑数组 + 位标志**：用位置数组替代对象键名，多个布尔状态压入标志位；
- **专业组专业列表按 (校,组) 去重**，只输出项目中真实出现的组码；
- **babelSetting.ignore** 让 `data`、`subpkg/data` 数据文件跳过 Babel 转译，避免单行大 JSON 转译膨胀；
- 上传开启 `minified` / `minifyWXSS` / `minifyWXML`，关闭 sourcemap；
- 院校详情独立**分包**，配合 `preloadRule` 预加载与懒注入。

当前构建结果：主包数据合计约 806KB，分包 subjects 约 1054KB，均在限制内。

---

## 九、常用命令

在项目根目录执行：

```bash
# 由原始数据重新生成小程序数据产物（含校验断言）
node scripts/build-data.mjs

# TypeScript 严格编译检查（零错误方可发布）
node node_modules/typescript/bin/tsc --noEmit

# 逻辑回归验证（位次换算 / 推荐分档 / 筛选 / 关联完整性）
node scripts/verify-logic.mjs

# 重新绘制 logo
powershell -ExecutionPolicy Bypass -File scripts/draw-logo.ps1
```

Windows 环境提示：PowerShell 执行策略禁用 `.ps1` 时，npm 命令需用 `npm.cmd`；Node 脚本直接 `node xxx` 运行。

---

## 十、数据来源与许可

| 数据 | 提供方 | 许可 |
|---|---|---|
| 院校专业组投档分、一分一段表、专业选科要求 | 广东省教育考试院（公开数据） | 公开信息 |
| 全国院校属性索引、专业组包含专业（2025 招生计划） | 掌上高考，经开源项目 [gaokao-pro](https://github.com/HA7CH/gaokao-pro) 整理 | MIT（代码与编排） |
| 院校属性补充表 | 院校官网公开属性 | 公开信息 |

专业组包含专业的数据为 **2025 年招生计划口径**：专业组代码逐年可能调整，故历史年份覆盖率有限；无映射的专业组仅显示代码，具体以当年官方《招生专业目录》为准。

---

## 十一、隐私说明

- 不调用 `getUserProfile`、手机号、位置、相册、摄像头、剪贴板等任何隐私敏感接口；
- 不发起 `wx.request` / 上传 / 下载，运行时无数据离开用户设备；
- 仅使用本地存储：`gaokao_favorites_v1`（收藏）、`pending_recommend`（推荐参数临时传递），用户可自行清除。

---

## 十二、免责声明

本小程序仅提供广东省高考**历史数据查询与参考**，数据来源于官方公开渠道，可能存在滞后、遗漏或误差；推荐结果不构成志愿填报建议或录取承诺。志愿填报请以广东省教育考试院及各院校官方最新公布的信息为准。

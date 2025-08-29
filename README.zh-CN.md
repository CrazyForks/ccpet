# ccpet

[![npm version](https://badge.fury.io/js/ccpet.svg)](https://badge.fury.io/js/ccpet)
[![Downloads](https://img.shields.io/npm/dm/ccpet.svg)](https://www.npmjs.com/package/ccpet)
[![Node.js CI](https://github.com/terryso/ccpet/workflows/CI/badge.svg)](https://github.com/terryso/ccpet/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md)

一个 Claude Code 状态栏虚拟宠物。宠物的能量会随时间衰减、在你消耗 token 时增加，并在会话之间持久化保存。

## 功能特性

- **🐾 虚拟宠物系统**
  - 基于能量的宠物，响应你的 Claude Code 使用情况
  - 基于时间的衰减（约每分钟 0.0231，约 3 天从 100 → 0）
  - 通过 token 使用进行喂养（1,000,000 tokens = +1 能量）
  
- **🎭 动画表情** 基于能量等级
  - **开心 (≥80)**: `(^_^) (^o^) (^_^) (^v^)` - 你的宠物很健康！
  - **饥饿 (≥40)**: `(o_o) (O_O) (o_o) (-_-)` - 需要一些关注
  - **生病 (≥10)**: `(u_u) (T_T) (u_u) (>_<)` - 是时候喂养你的宠物了
  - **死亡 (<10)**: `(x_x) (X_X) (x_x) (+_+)` - 你的宠物需要紧急护理！

- **📊 丰富状态显示**
  - 彩色能量条和精确的能量值
  - 累计 token 和终身统计数据
  - 实时会话指标（输入/输出/缓存/总计）
  - 宠物诞生时间追踪，支持生命周期管理
  
- **⚙️ 可配置且持久化**
  - 自定义颜色和衰减率
  - 状态在 Claude Code 会话之间持久保存

## 安装和配置

### 快速开始
要将 ccpet 用作你的 Claude Code 状态栏，请在你的 `~/.claude/settings.json` 中添加：

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx ccpet@latest",
    "padding": 0
  }
}
```

### 替代方案：全局安装
为了更好的性能，你可以全局安装：

```bash
npm install -g ccpet
```

然后更新设置以使用全局路径。

## CLI 命令

### 基本用法
```bash
ccpet                    # 显示状态栏（用于 Claude Code）
ccpet --help             # 显示帮助信息
ccpet --version          # 显示版本号
```

### 宠物管理命令

#### 检查命令
```bash
ccpet check              # 手动检查宠物状态（不消耗 token）
ccpet check --watch      # 持续监控模式（60秒间隔）
ccpet check -w --interval 30  # 监控模式，30秒间隔
ccpet check --help       # 显示检查命令帮助
```
使用 `ccpet check` 来：
- ✅ 检查宠物状态而不消耗 token
- ✅ 查看距离上次喂食的时间
- ✅ 监控会话之间的能量等级
- ✅ **新功能:** 持续监控，实时更新状态
- ✅ **新功能:** 简洁的倒计时显示
- ✅ **新功能:** 可自定义刷新间隔（10-300秒）

#### 配置命令
```bash
ccpet config list        # 显示当前配置
ccpet config set <key> <value>  # 设置配置值
ccpet config reset       # 重置为默认配置
ccpet config path        # 显示配置文件位置
```

#### 重置命令
```bash
ccpet reset              # 触发宠物死亡和墓地保存过程
ccpet reset --help       # 显示重置命令帮助
```
使用 `ccpet reset` 来：
- ✅ 手动触发宠物死亡和保存过程
- ✅ 将当前宠物保存到墓地并保留完整历史
- ✅ 创建一个拥有随机名字和全新开始的宠物
- ✅ 测试墓地功能
- ✅ **新功能:** 在 `~/.claude-pet/graveyard/` 中自动保存历史

#### 同步命令
```bash
ccpet sync               # 将宠物和token使用数据同步到Supabase
ccpet sync --dry-run     # 预览同步而不实际执行
ccpet sync --verbose     # 显示详细的同步进度
ccpet sync --start-date 2024-01-01  # 从指定日期开始同步
ccpet sync --end-date 2024-12-31    # 同步到指定日期
ccpet sync --help        # 显示同步命令帮助
```
使用 `ccpet sync` 来：
- ✅ 将宠物记录和token使用情况上传到Supabase数据库
- ✅ 启用跨设备宠物历史同步功能
- ✅ 支持增量同步以提高效率
- ✅ 从宠物出生时间智能检测日期范围
- ✅ 大数据集批量处理
- ✅ **新功能:** 宠物墓地数据的云备份

**设置：**
ccpet已预配置Supabase用于即时同步 - 安装后即可开始使用！

#### 排行榜命令
```bash
ccpet leaderboard        # 显示今日token排行榜
ccpet leaderboard --period 7d     # 显示7天排行榜
ccpet leaderboard --period 30d    # 显示30天排行榜
ccpet leaderboard --period all    # 显示全时段排行榜
ccpet leaderboard --sort cost     # 按成本排序而非token数量
ccpet leaderboard --sort survival # 按存活时间排序
ccpet leaderboard --limit 20      # 显示前20名
ccpet leaderboard --verbose       # 显示详细查询信息
ccpet leaderboard --help          # 显示排行榜命令帮助
```
使用 `ccpet leaderboard` 来：
- ✅ 将您宠物的表现与历史数据进行比较
- ✅ 跟踪不同时间段的token消耗和成本
- ✅ 监控宠物存活统计和成就
- ✅ 漂亮的CLI表格，支持emoji和格式化
- ✅ Supabase不可用时自动降级到离线模式
- ✅ **新功能:** 排名重置的实时倒计时

**排行榜功能：**
- **时间段**: `today`（今日）, `7d`（7天）, `30d`（30天）, `all`（全部）
- **排序选项**: `tokens`（默认）, `cost`（成本）, `survival`（存活） 
- **显示内容**: 排名、宠物名称、类型、Token数量、成本、存活天数、状态
- **离线模式**: 云服务不可用时自动使用本地墓地数据

**配置选项：**
```bash
# 颜色（格式：#RRGGBB 或 #RRGGBB:bright 或 #RRGGBB:bright:bold）
ccpet config set colors.petExpression "#FF0000:bright:bold"
ccpet config set colors.petName "#FF69B4:bright"
ccpet config set colors.energyBar "#00FF00"
ccpet config set colors.energyValue "#00FFFF"
ccpet config set colors.lifetimeTokens "#FF00FF"

# 宠物行为
ccpet config set pet.animationEnabled true
ccpet config set pet.decayRate 0.0231

# 多行显示（新功能！）
ccpet config set display.maxLines 3                    # 显示最多3行 (1-3)
ccpet config set display.line1.enabled true            # 启用/禁用自定义第1行
ccpet config set display.line1.items "expression,energy-bar,energy-value" # 第1行显示内容
ccpet config set display.line2.enabled true            # 启用/禁用第2行
ccpet config set display.line2.items "input,output"    # 第2行显示内容
ccpet config set display.line3.enabled true            # 启用/禁用第3行
ccpet config set display.line3.items "total"           # 第3行显示内容
```

**可用的显示项目：**
- **仅第1行**：`expression`, `energy-bar`, `energy-value`, `accumulated-tokens`, `lifetime-tokens`, `pet-name`
- **仅第2-3行**：`input`, `output`, `cached`, `total`, `context-length`, `context-percentage`, `context-percentage-usable`, `cost`

**注意**：目前，宠物相关元素只能在第1行使用，会话/上下文元素只能在第2-3行使用。

### 持续宠物监控

**使用新的监控模式实时观察你的宠物：**

```bash
# 开始持续监控（默认60秒间隔）
ccpet check --watch

# 自定义监控间隔（10-300秒）
ccpet check --watch --interval 30

# 简短形式
ccpet check -w --interval 45
```

**功能特性：**
- ✅ 实时宠物状态更新
- ✅ 简洁的3行显示布局
- ✅ 倒计时器显示下次更新时间
- ✅ Ctrl+C 优雅退出
- ✅ 错误恢复和重试机制
- ✅ 可自定义刷新间隔（10-300秒）
- ✅ 原地更新，无屏幕闪烁

**示例输出：**
```text
Fluffy 🐶(^_^) ●●●●●●●●●● 100.00 (838.9K) 💖25.84M
⏰ 距离上次喂食: 0分钟前
⏳ 下次更新: 10秒
```

**注意：** 显示内容会在每个间隔原地更新，替换之前的内容，提供清晰的监控体验。

**使用场景：**
- 🎯 监控宠物能量衰减过程
- 🎯 观察喂食后的能量恢复
- 🎯 跟踪长时间会话中的状态变化
- 🎯 调试和测试宠物系统行为

## 状态显示

### 默认3行显示
```text
Luna 🐶(^o^) ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
Input: 2847 Output: 1256 Cached: 512 Total: 4615
Ctx: 2.4K Ctx: 12.0% Ctx(u): 88.5% Cost: $0.15
```

**注意**: 宠物名字通过在`display.line1.items`配置中包含`pet-name`元素来控制。将`pet-name`元素放在列表中你希望显示的位置。上下文指标 (Ctx(u)) 显示为浅绿色。成本指标显示当前会话的总USD费用。

### 单行显示（极简）
配置：`ccpet config set display.maxLines 1`
```text
Luna 🐶(^o^) ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
```

### 2行显示（平衡）
配置：`ccpet config set display.maxLines 2`
```text
Luna 🐶(^o^) ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
Input: 2847 Output: 1256 Cached: 512 Total: 4615
```

### 自定义显示示例

#### 隐藏宠物名字
```bash
ccpet config set display.line1.items "expression,energy-bar,energy-value,accumulated-tokens,lifetime-tokens"
```
```text
🐶(^o^) ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
Input: 2847 Output: 1256 Cached: 512 Total: 4615
```

#### 名字在表情后
```bash
ccpet config set display.line1.items "expression,pet-name,energy-bar,energy-value,accumulated-tokens,lifetime-tokens"
```
```text
🐶(^o^) Luna ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
```

#### 自定义行配置
```bash
ccpet config set display.line1.items "pet-name,expression,energy-value"
ccpet config set display.line2.items "input,output"
ccpet config set display.line3.items "total,context-percentage-usable"
```
```text
Luna 🐶(^o^) 98.52
Input: 2847 Output: 1256
Total: 4615 Ctx(u): 88.5%
```

**显示格式：**
- **第1行**（仅宠物元素）：从`expression`, `energy-bar`, `energy-value`, `accumulated-tokens`, `lifetime-tokens`, `pet-name`中选择
- **第2行**（仅会话/上下文元素）：从`input`, `output`, `cached`, `total`, `context-length`, `context-percentage`, `context-percentage-usable`, `cost`中选择
- **第3行**（仅会话/上下文元素）：与第2行相同的元素

**宠物名称显示：**
- 通过在`display.line1.items`中包含`pet-name`元素来控制
- 位置由`pet-name`在元素列表中的位置决定
- 示例：`"pet-name,expression,energy-bar"`（名字在前），`"expression,pet-name,energy-bar"`（名字在表情后）

## 宠物照顾指南

### 🌟 保持宠物健康
- **积极使用**: 定期使用 Claude Code 来喂养你的宠物
- **Token 转换**: 1,000,000 tokens = +1 能量点
- **自然衰减**: 约每分钟 0.0231 能量（约 3 天完全衰减）

### 😴 当宠物死亡时
如果你的宠物能量降到 0：
- **历史保存**: 你的宠物完整历史会自动保存到墓地
- **新宠物诞生**: 一个拥有随机名字和全新开始的宠物会诞生
- **传承保护**: 所有之前的宠物记录都会安全存储在 `~/.claude-pet/graveyard/`
- 每个新 token 都有助于你的新宠物从零开始成长

### 🪦 宠物墓地与历史记录保存
ccpet 会在宠物去世时自动保存它们的传承：

**自动历史保存:**
- 当宠物死亡（能量 = 0）时，它们的完整状态会移动到 `~/.claude-pet/graveyard/{宠物名}/`
- 每个宠物都有自己的专用文件夹，最终状态得到保存
- 同名宠物通过序号处理（例如，`Fluffy-2/`、`Fluffy-3/`）

**墓地结构:**
```text
~/.claude-pet/
├── pet-state.json          # 当前宠物
└── graveyard/
    ├── Fluffy/
    │   └── pet-state.json  # 完整最终状态
    ├── Shadow/
    │   └── pet-state.json  # 完整最终状态
    ├── Luna-2/             # 同名处理
    │   └── pet-state.json
    └── ...
```

**保存内容:**
- ✅ 宠物名字和动物类型
- ✅ 最终能量等级和表情
- ✅ 完整的终身 token 统计
- ✅ 诞生时间和喂食历史
- ✅ 所有累计成就

**原子操作:**
- 安全的文件操作防止转换过程中的数据丢失
- 备份和回滚机制确保数据完整性
- 即使在系统错误时，你的宠物历史也永远不会丢失

## 故障排除

### 状态栏不更新？
状态栏只在你使用 Claude Code 时更新。使用 `ccpet check` 进行手动更新。

### 宠物消失了？
1. 检查 Claude Code 设置：`cat ~/.claude/settings.json`
2. 验证 ccpet 安装：`ccpet --version`
3. 手动测试：`ccpet check`

## 技术细节

### 数据存储
宠物状态保存在 `~/.claude-pet/pet-state.json` 文件中，包含以下结构：
- `energy`: 当前能量等级 (0-100)
- `expression`: 当前面部表情
- `animalType`: 宠物种类 (cat, dog, rabbit, panda, fox)
- `petName`: 每个宠物的唯一名字（自动生成）
- `birthTime`: 宠物诞生/重生时间 (ISO时间戳)
- `lastFeedTime`: 上次喂食时间戳
- `totalTokensConsumed`: 本生命周期消耗的总token数
- `totalLifetimeTokens`: 终身token消耗量
- `accumulatedTokens`: 等待转换为能量的token数
- `lastDecayTime`: 上次能量衰减计算时间戳
- 会话指标: `sessionTotalInputTokens`, `sessionTotalOutputTokens` 等

**墓地存储:**
- 历史宠物存储在 `~/.claude-pet/graveyard/{宠物名}/pet-state.json`
- 完整状态保存，包含所有统计和时间戳
- 原子文件操作确保转换过程中不会丢失数据

系统会自动为旧版本状态文件添加缺失字段（如 `birthTime` 和 `petName`）以保持向后兼容性。

### 宠物命名系统
ccpet 具有**智能宠物命名系统**，支持文化多样性：

- **随机名字生成**: 每个宠物都会从精选列表中获得独特的随机名字
- **双语支持**: 支持英文和中文名字
- **文化多样性**: 来自不同文化的名字（日文、中文、英文等）
- **持久身份**: 宠物名字会保存并在会话间持续存在
- **自动分配**: 新宠物会自动获得分配的名字

**示例名字：**
- 英文: Whiskers, Shadow, Luna, Max, Bella, Charlie
- 中文: 小白 (Xiaobai), 毛毛 (Maomao), 花花 (Huahua), 团子 (Tuanzi)

## 开发

### 测试
```bash
npm test              # 运行所有测试
npm run test:coverage # 运行测试并生成覆盖率报告
```

### 构建
```bash
npm run build        # 构建分发文件
npm run watch        # 构建并监视更改
```

## 许可证

MIT License

---

**享受你的虚拟编程伙伴！🐾**

*记住：喂得好的宠物是快乐的宠物。保持编码来保持你的宠物健康！*
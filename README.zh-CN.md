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
```
使用 `ccpet check` 来：
- ✅ 检查宠物状态而不消耗 token
- ✅ 查看距离上次喂食的时间
- ✅ 监控会话之间的能量等级

#### 配置命令
```bash
ccpet config list        # 显示当前配置
ccpet config set <key> <value>  # 设置配置值
ccpet config reset       # 重置为默认配置
ccpet config path        # 显示配置文件位置
```

**配置选项：**
```bash
# 颜色（格式：#RRGGBB 或 #RRGGBB:bright 或 #RRGGBB:bright:bold）
ccpet config set colors.petExpression "#FF0000:bright:bold"
ccpet config set colors.energyBar "#00FF00"
ccpet config set colors.energyValue "#00FFFF"
ccpet config set colors.lifetimeTokens "#FF00FF"

# 宠物行为
ccpet config set pet.animationEnabled true
ccpet config set pet.decayRate 0.0231
```

## 状态显示

### 正常运行
```text
(^o^) ●●●●●●●●●● 98.52 (45.2K) 💖5.2M
In: 2847 Out: 1256 Cached: 512 Total: 4615
```

### 低能量
```text
(u_u) ●●○○○○○○○○ 15.32 (890.1K) 💖12.3M
In: 5234 Out: 3421 Cached: 1024 Total: 9679
```

**状态格式：**
- **第 1 行**: `[表情] [能量条] [能量值] ([累计 token]) 💖[终身 token]`
- **第 2 行**: `In: [输入] Out: [输出] Cached: [缓存] Total: [会话总计]`

## 宠物照顾指南

### 🌟 保持宠物健康
- **积极使用**: 定期使用 Claude Code 来喂养你的宠物
- **Token 转换**: 1,000,000 tokens = +1 能量点
- **自然衰减**: 约每分钟 0.0231 能量（约 3 天完全衰减）

### 😴 当宠物死亡时
如果你的宠物能量降到 0：
- 所有统计数据都会重置（终身 token、累计 token）
- 你的宠物可以通过继续使用 Claude Code 复活
- 每个新 token 都有助于从头重建你的宠物

## 故障排除

### 状态栏不更新？
状态栏只在你使用 Claude Code 时更新。使用 `ccpet check` 进行手动更新。

### 宠物消失了？
1. 检查 Claude Code 设置：`cat ~/.claude/settings.json`
2. 验证 ccpet 安装：`ccpet --version`
3. 手动测试：`ccpet check`

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
# ccpet

[![npm version](https://badge.fury.io/js/ccpet.svg)](https://badge.fury.io/js/ccpet)
[![Downloads](https://img.shields.io/npm/dm/ccpet.svg)](https://www.npmjs.com/package/ccpet)
[![Node.js CI](https://github.com/terryso/ccpet/workflows/CI/badge.svg)](https://github.com/terryso/ccpet/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

[English](README.md)

一个 Claude Code 状态栏虚拟宠物。宠物的能量会随时间衰减、在你消耗 token 时增加，并在会话之间持久化保存。

## 功能特性

- **能量模型** 包含衰减和喂养机制
  - 基于时间的衰减 (约每分钟 0.0231，约 3 天从 100 → 0)
  - 通过 token 使用进行喂养 (1,000,000 tokens = +1 能量)
- **动画表情** 基于能量等级的连续循环动画
  - 表情自动循环播放4帧动画
  - 无帧率检测 - 简单的计数器动画系统
- **表情状态** 基于阈值划分 (来自 `src/core/config.ts`)
  - `开心 (>=80)`: 静态 `(^_^)` → 动画 `(^_^) (^o^) (^_^) (^v^)`
  - `饥饿 (>=40)`: 静态 `(o_o)` → 动画 `(o_o) (O_O) (o_o) (-_-)`
  - `生病 (>=10)`: 静态 `(u_u)` → 动画 `(u_u) (T_T) (u_u) (>_<)`
  - `死亡 (<10)`: 静态 `(x_x)` → 动画 `(x_x) (X_X) (x_x) (+_+)`
- **简单动画系统**
  - 基于计数器的动画循环，状态持久化
  - 调用计数跟踪，性能优化
  - 每个能量状态连续4帧动画循环
- **状态输出** (彩色): 表情 + 能量条 + 能量值 + 累计的 tokens
- **会话指标** 行: 输入 / 输出 / 缓存 / 总 tokens
- **持久化状态** 跨会话保存

## 安装和配置

要将 ccpet 用作你的 Claude Code 状态栏，请在你的 `~/.claude/settings.json` 文件中添加以下配置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "npx ccpet@latest",
    "padding": 0 
  }
}
```

配置完成后，你的 Claude Code 状态栏就会显示一个可爱的虚拟宠物，它会根据你的 token 使用情况实时更新状态。

## 输出示例

### 静态模式 (低频更新)

```text
(o_o) ●●●●●●●○○○ 67.43 (125K) 💖2.1M
 In: 2847 Out: 1256 Cached: 512 Total: 4615
```

### 动画模式 (连续循环)

你的宠物会基于能量等级连续循环显示动画表情：

```text
(^o^) ●●●●●●●●●● 98.52 (45K) 💖5.2M    # 帧 1
(^_^) ●●●●●●●●●● 98.52 (45K) 💖5.2M    # 帧 2  
(^v^) ●●●●●●●●●● 98.52 (45K) 💖5.2M    # 帧 3
(^_^) ●●●●●●●●●● 98.52 (45K) 💖5.2M    # 帧 4
```

**格式说明：**

- 第 1 行: 表情 + 10 字符能量条 + 能量值 (2 位小数) + 待转化的 token数 + 宠物生命期总 token 数
- 第 2 行: 会话总计 (输入/输出/缓存/总计)

## 宠物照顾

如果你的宠物死了（显示 `(x_x)` 且能量 < 10），你可以通过积极使用 Claude Code 来复活它。你消耗的每个 token 都会帮助恢复宠物的能量。使用 Claude Code 越多，宠物恢复得越快！

**当宠物能量降到 0 时**：你的宠物会完全死亡，所有 token 统计数据（totalLifetimeTokens、totalTokensConsumed、accumulatedTokens）都会重置为零。要重新开始，只需继续使用 Claude Code - 你消耗的每个新 token 都会从头开始培养你的新宠物！

## 手动检查宠物状态

想在不使用 Claude Code 的情况下查看宠物状态吗？使用手动检查命令：

```bash
npx ccpet-check
```

此命令特点：
- ✅ 显示应用实时衰减后的宠物当前状态
- ✅ **不消耗 Claude Code token**
- ✅ 显示距离上次喂食的时间
- ✅ 完美适用于检查宠物是否需要关注

**为什么状态栏不自动更新？**
Claude Code 状态栏只在你主动使用 Claude Code 时更新。这种设计是为了避免不必要地消耗你的 token。手动检查命令让你可以随时查看宠物状态而不产生 token 费用！

## 许可证

MIT License

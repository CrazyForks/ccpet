# Epic 4: 宠物历史记录与排行榜系统

## Epic 目标

增加宠物历史记录保存和竞争排行榜功能，通过允许用户追踪宠物遗产并基于存活时间和token消耗进行竞争来提升长期参与度。

## Epic 描述

### 现有系统上下文

- **当前相关功能**：宠物死亡触发 `resetToInitialState()` 方法，直接覆盖现有的 pet-state.json 数据，丢失所有历史信息
- **技术栈**：TypeScript，Node.js fs 模块用于 JSON 存储，现有的 PetStorage 类架构
- **集成点**：Pet.ts 重置功能，PetStorage.ts 文件操作，与 ccusage 的潜在集成用于token跟踪

### 增强功能详情

- **新增/修改内容**：将直接状态重置替换为历史记录保存到"墓地"文件夹，添加可配置的宠物命名系统，实现基于存活时间和token消耗的排行榜
- **如何集成**：扩展现有的 PetStorage 类，修改 Pet 类重置行为，添加配置选项控制宠物名称显示，集成 ccusage CLI 和 Supabase 进行数据同步
- **成功标准**：

  1. 宠物内部有唯一名称用于识别，状态栏显示保持默认简洁（名称显示可配置）
  2. 宠物死亡时在墓地结构中保存完整历史记录
  3. Token消耗数据同步到 Supabase，支持多维度排行榜查询
  4. 静态网页排行榜界面显示宠物名称、存活时间和消耗指标

## 故事列表

### Story 4.1: 状态栏第一行可配置显示

**作为一个开发者**，我希望能够配置状态栏第一行的显示内容，**这样** 我就能灵活控制宠物信息的展示方式。

**实现细节**：

- 在现有的 `display` 配置中直接添加 `line1` 配置项：
  ```typescript
  display: {
    maxLines?: number; // 默认3
    line1?: {
      enabled?: boolean; // 是否启用第一行（默认true）
      items?: string[]; // 第一行显示项目列表
    };
    line2?: {
      enabled?: boolean; // 是否启用第二行（默认true）
      items?: string[];
    };
    line3?: {
      enabled?: boolean; // 是否启用第三行（默认true）
      items?: string[];
    };
  }
  ```
- 支持的 line1 items（基于现有第一行的5个元素）：
  - `'expression'` - 表情符号（包含动物emoji）
  - `'energy-bar'` - 能量条
  - `'energy-value'` - 能量数值
  - `'accumulated-tokens'` - 累积token数（带括号格式）
  - `'lifetime-tokens'` - 终身token数（带💖前缀）
  - `'pet-name'` - 宠物名称（需要 Story 4.2 支持）
- 默认配置行为：
  ```json
  "display": {
    "maxLines": 3,
    "line1": {
      "enabled": true,
      "items": ["expression", "energy-bar", "energy-value", "accumulated-tokens", "lifetime-tokens"]
    }
  }
  ```
- 向后兼容：如果没有配置 `line1`，则使用上述默认的5个元素显示
- 修改 StatusBar 的 `formatPetLine` 方法，支持基于配置动态生成第一行内容

### Story 4.2: 宠物命名系统

**作为一个开发者**，我希望每个宠物都有一个唯一的名称用于墓地保存和排行榜识别，**这样** 我就能在历史记录和排行榜中区分不同的宠物。

**实现细节**：

- 在 IPetState 接口中添加 `petName` 字段，用于内部识别和排行榜
- 修改 Pet 类的初始化和重置逻辑以支持随机生成或用户指定的宠物名称
- 更新 PetStorage 类以保存和加载宠物名称
- 宠物名称生成策略：
  - 随机从预设名字列表中选择
  - 支持用户通过命令自定义当前宠物名称
- 向后兼容：为现有宠物分配默认随机名称

### Story 4.3: 宠物墓地与历史记录保存

**作为一个开发者**，我希望当我的宠物死亡时，它们的完整历史记录能够被保存，**这样** 我就可以回顾它们的成就，系统也能维护我所有宠物伙伴的记录。

**实现细节**：

- 当宠物死亡时，将当前的 pet-state.json 移动到 `~/.claude-pet/graveyard/{petName}/pet-state.json`
- 如果同名宠物已存在，使用 `{petName}-{序号}` 的命名方式
- 创建新的 pet-state.json 并进行新宠物初始化
- 保留墓地文件夹结构以便历史访问
- 确保原子文件操作以防止数据丢失

### Story 4.4: Supabase数据同步系统

**作为一个开发者**，我希望我的token消耗数据能自动同步到云端数据库，**这样** 就能支持更丰富的排行榜功能和数据分析。

**实现细节**：

- 基于 ccusage CLI 输出设计 Supabase 表结构：
  - `pet_records` 表：宠物基本信息（名称、出生时间、死亡时间、存活时长）
  - `token_usage` 表：token消耗记录（日期、输入tokens、输出tokens、缓存tokens、成本、宠物ID）
- 创建数据同步命令，从 ccusage 获取数据并上传到 Supabase
- 实现增量同步，只上传新的或更新的记录
- 添加可选的自动同步配置

### Story 4.5: 静态网页排行榜界面

**作为一个开发者**，我希望有一个美观的静态网页显示排行榜，**这样** 我就能方便地查看和分享我的宠物排名成绩。

**实现细节**：

- 创建纯静态 HTML/CSS/JavaScript 排行榜页面
- 通过 Supabase 客户端 API 读取排行榜数据
- 实现多种排名模式（与CLI版本保持一致）：
  - Today - 今日排行榜（每日UTC午夜重置）
  - Last 7 Days - 最近7天排行榜
  - Last 30 Days - 最近30天排行榜  
  - All Time - 全时期排行榜
- 支持多种排序方式：
  - Tokens - 按token消耗排序（默认）
  - Cost - 按金额成本排序
  - Survival - 按存活时间排序
- 网页显示元素（与你提供的参考页面一致）：
  - 排名、用户名/宠物名称、头像/动物emoji
  - Token数量（格式化显示，如20,753,508）
  - 成本金额（美元格式，如$47.90）
  - 存活时间（天数小时格式，如15d 8h）
  - 实时倒计时显示（距离重置时间）
- 响应式设计，支持移动端查看
- 标签页切换不同时间段，排序按钮切换不同指标

## 兼容性要求

- [x] 现有活跃宠物的 pet-state.json 格式保持不变
- [x] 当前的 Pet.ts 状态管理继续正常工作，无需修改
- [x] PetStorage.ts API 保持向后兼容
- [x] 不影响状态栏性能或用户体验
- [x] 现有配置系统支持新的排行榜设置

## 风险缓解

- **主要风险**：宠物死亡时的文件系统操作可能失败，可能导致新旧宠物数据丢失
- **缓解措施**：实现原子文件操作 - 先创建新的宠物状态，然后将旧状态移动到墓地，配备完善的错误处理和回滚功能
- **回滚计划**：如果文件损坏，从最新的墓地备份中恢复宠物状态

## 完成定义

- [x] 宠物死亡时在状态重置前创建墓地备份
- [x] 宠物命名系统集成到 Pet 类和存储层
- [x] 实现基于文件时间和 ccusage 验证指标的双排行榜
- [x] 手动同步命令和可选的自动同步配置正常工作
- [x] 排行榜显示界面清晰地显示带有宠物名称的排名
- [x] 所有现有宠物功能继续正常工作，无回归
- [x] 新的墓地、命名和排行榜功能有全面的测试覆盖
- [x] 文档已更新，包含新命令和功能

### Story 4.6: CLI排行榜命令与金额消耗排行

**作为一个开发者**，我希望能通过命令行直接查看宠物排行榜并看到金额消耗排名，**这样** 我就能快速了解我的宠物在各项指标上的表现，而不需要打开网页。

**实现细节**：

- 新增 `ccpet leaderboard` 命令，支持多种排行模式：
  ```bash
  ccpet leaderboard                    # 默认显示今日排行榜
  ccpet leaderboard --period today     # 今日排行榜
  ccpet leaderboard --period 7d        # 最近7天排行榜
  ccpet leaderboard --period 30d       # 最近30天排行榜  
  ccpet leaderboard --period all       # 全时期排行榜
  ccpet leaderboard --limit 20         # 显示前20名（默认10名）
  ccpet leaderboard --sort tokens      # 按tokens排序（默认）
  ccpet leaderboard --sort cost        # 按成本排序
  ccpet leaderboard --sort survival    # 按存活时间排序
  ```

- CLI显示元素（参考网页版设计）：
  ```
  ┌──────────────────────────────────────────────────────────────────────┐
  │                          Today Leaderboard                          │
  │                     Daily leaderboard resets at midnight UTC        │
  │                           Next reset: 22:36:24                      │
  └──────────────────────────────────────────────────────────────────────┘
  
  RANK  PET NAME      ANIMAL    TOKENS        COST      SURVIVAL
  ────────────────────────────────────────────────────────────────────── 
    1   Fluffy        🐱      20,753,508    $47.90     15d 8h
    2   Whiskers      🐶      10,693,141    $24.28     12d 4h  
    3   Buddy         🐹       5,773,127    $15.24     8d 12h
    4   Charlie       🐰       3,847,685    $12.04     6d 2h
    5   Luna          🐸       3,143,802     $2.28     4d 18h
  ```

- 支持排序切换和实时计时器显示
- 增强Story 4.5网页版，在网页版也添加金额消耗排行功能
- 错误处理：Supabase连接失败时显示本地墓地数据
- 支持配置默认显示模式和数量

**技术集成**：
- 扩展现有CLI命令架构，添加LeaderboardCommand类
- 复用Story 4.4的Supabase查询逻辑，增加成本统计和时间段筛选
- 集成本地墓地数据作为离线降级方案
- 使用表格格式化库（如cli-table3）美化CLI显示

## 技术实现说明

### 与 ccusage 的集成

- 使用 `ccusage` CLI 工具（https://github.com/ryoppippi/ccusage）进行token消耗验证
- 按宠物出生时间戳过滤 ccusage 数据以获取准确的终身总计
- 这防止了手动操作 pet-state.json 中token值的情况

### 墓地结构

```text
~/.claude-pet/
├── pet-state.json (当前宠物)
├── graveyard/
│   ├── Fluffy/
│   │   └── pet-state.json
│   ├── Whiskers/
│   │   └── pet-state.json
│   ├── Fluffy-2/  (同名处理)
│   │   └── pet-state.json
│   └── ...
└── supabase-sync-cache.json (可选的同步缓存)
```

### Supabase 数据库表结构

基于 ccusage CLI 的数据格式设计：

```sql
-- 宠物记录表
CREATE TABLE pet_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_name TEXT NOT NULL,
  animal_type TEXT NOT NULL,
  birth_time TIMESTAMPTZ NOT NULL,
  death_time TIMESTAMPTZ,
  survival_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token使用记录表  
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES pet_records(id),
  usage_date DATE NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
  model_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, usage_date)
);
```

### 排行榜同步选项

- **手动同步**：ccpet sync 命令从 ccusage 获取数据并上传到 Supabase
- **自动同步**：可配置的每日自动同步（默认禁用）
- **增量同步**：智能检测只同步新增或变更的数据
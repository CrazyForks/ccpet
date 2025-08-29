# Story 4.6: CLI排行榜命令与金额消耗排行 - 手工验收测试

## 测试环境要求

### 前置条件
- 已安装ccpet CLI工具
- 已完成Story 4.4的Supabase数据同步配置
- 已有一些同步的宠物和token使用数据
- 本地存在宠物墓地数据（用于离线模式测试）

### Supabase配置
ccpet已预配置Supabase，无需额外配置即可使用排行榜功能。

## AC1: CLI排行榜命令实现 ✅

### 验证步骤
1. **测试基础命令可用性**
   ```bash
   ccpet leaderboard --help
   ```
   
   **期望结果**: 
   - 显示完整的leaderboard命令帮助信息
   - 包含所有可用参数：period, sort, limit等
   - 显示使用示例和配置说明

2. **测试默认参数行为**
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - 使用默认参数 (today, tokens, limit=10)
   - 显示今日token使用排行榜
   - 表格格式整齐美观

3. **测试时间段参数**
   ```bash
   # 测试所有时间段选项
   ccpet leaderboard --period today
   ccpet leaderboard --period 7d  
   ccpet leaderboard --period 30d
   ccpet leaderboard --period all
   ```
   
   **期望结果**: 
   - 每个时间段显示对应的标题
   - 数据筛选正确
   - 标题显示正确的时间段描述

4. **测试排序参数**
   ```bash
   # 测试所有排序选项
   ccpet leaderboard --sort tokens
   ccpet leaderboard --sort cost
   ccpet leaderboard --sort survival
   ```
   
   **期望结果**: 
   - 数据按指定字段正确排序
   - 标题显示对应的排序类型
   - 排名重新计算正确

5. **测试数量限制参数**
   ```bash
   ccpet leaderboard --limit 5
   ccpet leaderboard --limit 20
   ```
   
   **期望结果**: 
   - 显示指定数量的记录
   - 排名正确
   - 超出限制的记录不显示

6. **测试参数组合**
   ```bash
   ccpet leaderboard --period 30d --sort cost --limit 15
   ```
   
   **期望结果**: 
   - 所有参数正确生效
   - 标题反映所有参数设置
   - 数据筛选和排序正确

## AC2: 美观的CLI表格显示 ✅

### 验证步骤
1. **测试表格结构**
   ```bash
   ccpet leaderboard --period all
   ```
   
   **期望结果**: 
   - 表格有清晰的边框和分隔符
   - 列标题清晰（Rank, Pet Name, Type, Tokens, Cost, Survival, Status）
   - 列宽自动调整，对齐整齐

2. **测试标题头显示**
   ```bash
   ccpet leaderboard --period 7d --sort survival
   ```
   
   **期望结果**: 
   - 显示"🏆 7-Day Survival Time Leaderboard"格式标题
   - 标题下有分隔线
   - 标题反映当前查询参数

3. **测试数值格式化**
   ```bash
   ccpet leaderboard --sort tokens
   ```
   
   **期望结果**: 
   - Token数量使用千分位格式化 (1.5K, 2.3M, 1.2B)
   - 成本显示货币格式 ($12.50)
   - 存活时间显示天数格式 (15d)
   - 排名显示 (#1, #2...)

4. **测试动物类型显示**
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - 显示动物emoji和中文名称 (🐱 猫, 🐶 狗, 🐰 兔子, 🐼 熊猫, 🦊 狐狸)
   - 未知动物类型降级显示原始值
   - 列宽适应emoji字符

5. **测试状态显示**
   ```bash
   ccpet leaderboard --period all
   ```
   
   **期望结果**: 
   - 活着的宠物显示 "✅ Alive"
   - 死亡的宠物显示 "💀 Dead" 
   - 状态图标清晰可见

6. **测试倒计时显示**
   ```bash
   ccpet leaderboard --period today
   ccpet leaderboard --period 7d
   ccpet leaderboard --period 30d
   ccpet leaderboard --period all
   ```
   
   **期望结果**: 
   - today: 显示到午夜的倒计时
   - 7d: 显示到下周一的倒计时  
   - 30d: 显示到下月第一天的倒计时
   - all: 显示"All-time rankings (no reset)"

## AC3: 多维度排序和时间段筛选 ✅

### 验证步骤
1. **验证Token排序准确性**
   ```bash
   ccpet leaderboard --sort tokens --period all
   ```
   
   **期望结果**: 
   - 按token总数从高到低排序
   - 排名正确分配
   - 数值显示准确

2. **验证成本排序准确性**
   ```bash
   ccpet leaderboard --sort cost --period all
   ```
   
   **期望结果**: 
   - 按成本总额从高到低排序
   - 成本格式化正确 ($XX.XX)
   - 排名重新计算

3. **验证存活时间排序准确性**
   ```bash
   ccpet leaderboard --sort survival --period all
   ```
   
   **期望结果**: 
   - 按存活天数从高到低排序
   - 存活时间计算准确
   - 包含已死亡和活着的宠物

4. **验证时间段筛选逻辑**
   
   准备测试数据，然后验证：
   ```bash
   # 对比不同时间段的结果
   ccpet leaderboard --period today --verbose
   ccpet leaderboard --period 7d --verbose  
   ccpet leaderboard --period 30d --verbose
   ccpet leaderboard --period all --verbose
   ```
   
   **期望结果**: 
   - 时间段筛选逻辑正确
   - 累计数据计算准确
   - 不同时间段显示不同结果

5. **测试边界情况**
   ```bash
   # 测试极限值
   ccpet leaderboard --limit 1
   ccpet leaderboard --limit 100
   ```
   
   **期望结果**: 
   - 单记录显示正常
   - 最大限制正确执行
   - 表格格式保持一致

## AC4: 错误处理和降级 ✅

### 验证步骤
1. **测试无效参数处理**
   ```bash
   ccpet leaderboard --period invalid
   ccpet leaderboard --sort invalid  
   ccpet leaderboard --limit 0
   ccpet leaderboard --limit 101
   ```
   
   **期望结果**: 
   - 显示清晰的错误信息
   - 提示有效的参数选项
   - 退出码为1
   - 不会继续执行

2. **测试Supabase连接失败降级**
   ```bash
   # 使用错误的配置强制连接失败
   ccpet leaderboard --supabase-url "https://invalid.supabase.co" --verbose
   ```
   
   **期望结果**: 
   - 显示Supabase连接失败警告
   - 自动降级到本地数据模式
   - 显示"📡 Offline Mode"指示器
   - 显示可用的本地数据

3. **测试离线模式功能**
   
   断开网络连接或使用无效配置：
   ```bash
   unset SUPABASE_URL SUPABASE_ANON_KEY
   ccpet leaderboard --verbose
   ```
   
   **期望结果**: 
   - 优雅降级到本地墓地数据
   - 显示当前活着的宠物
   - 读取~/.claude-pet/graveyard/下的历史数据
   - Cost列显示"N/A"
   - 显示离线模式提示信息

4. **测试空数据处理**
   
   在没有数据的环境中：
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - 显示"📭 No data available"信息
   - 提供有用的建议
   - 区分在线和离线模式的建议
   - 不会崩溃或显示错误

5. **测试配置缺失处理**
   ```bash
   ccpet leaderboard --help
   ```
   
   **期望结果**: 
   - 帮助信息始终可用
   - 包含配置指导
   - 说明离线模式功能

## 用户体验验证

### 命令行交互体验
1. **测试帮助信息质量**
   ```bash
   ccpet leaderboard --help
   ```
   
   **期望结果**: 
   - 帮助信息清晰完整
   - 包含所有参数说明
   - 提供实用的使用示例
   - 说明配置优先级
   - 包含离线模式说明

2. **测试详细输出模式**
   ```bash
   ccpet leaderboard --verbose
   ```
   
   **期望结果**: 
   - 显示查询进度信息
   - 显示数据来源 (Supabase/本地)
   - 显示记录数量统计
   - 显示降级信息（如适用）

3. **测试CLI集成**
   ```bash
   ccpet --help
   ```
   
   **期望结果**: 
   - leaderboard命令显示在主帮助中
   - 描述准确简洁
   - 与其他命令格式一致

### 输出格式验证
1. **测试中文宠物名称显示**
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - 中文字符正确显示和对齐
   - 列宽计算考虑中文字符宽度
   - 表格格式保持整齐

2. **测试Unicode支持**
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - Emoji正确显示
   - 表格边框字符正确
   - 特殊符号显示正常

## 性能验证

### 大数据量处理
1. **测试大量记录显示**
   
   在有较多宠物记录的环境中：
   ```bash
   time ccpet leaderboard --limit 100 --period all
   ```
   
   **期望结果**: 
   - 查询在合理时间内完成 (<5秒)
   - 内存使用稳定
   - 表格渲染流畅

2. **测试响应性**
   ```bash
   ccpet leaderboard --verbose
   ```
   
   **期望结果**: 
   - 命令启动快速 (<1秒)
   - 降级策略快速生效
   - 用户体验流畅

## 数据一致性验证

### 排行榜数据准确性
1. **验证与Supabase数据一致性**
   
   对比CLI排行榜和Supabase原始数据：
   ```bash
   ccpet leaderboard --period 30d --sort tokens --verbose
   ```
   
   然后在Supabase查询对应数据验证排序和聚合准确性。

2. **验证本地数据准确性**
   ```bash
   # 离线模式下验证数据
   ccpet leaderboard --verbose
   ```
   
   对比本地pet-state.json和graveyard数据的一致性。

## 集成验证

### 与其他功能的协作
1. **测试与sync命令的协作**
   ```bash
   ccpet sync
   ccpet leaderboard --verbose
   ```
   
   **期望结果**: 
   - 同步后的数据立即反映在排行榜中
   - 数据一致性保持

2. **测试多命令工作流**
   ```bash
   ccpet check
   ccpet leaderboard
   ccpet config list  
   ccpet leaderboard --period all
   ```
   
   **期望结果**: 
   - 所有命令正常工作
   - 不相互干扰
   - 性能保持稳定

## 边界条件测试

### 特殊场景处理
1. **测试新安装环境**
   
   在全新安装的环境中：
   ```bash
   ccpet leaderboard
   ```
   
   **期望结果**: 
   - 优雅处理无数据情况
   - 提供有用的指导信息
   - 不会崩溃

2. **测试宠物刚死亡场景**
   
   在宠物刚死亡后：
   ```bash
   ccpet leaderboard --sort survival
   ```
   
   **期望结果**: 
   - 正确计算存活时间
   - 状态显示为死亡
   - 排序考虑最终存活时间

3. **测试数据库部分可用**
   
   模拟网络不稳定情况：
   ```bash
   ccpet leaderboard --verbose
   ```
   
   **期望结果**: 
   - 降级策略正确触发
   - 错误信息清晰
   - 用户体验不受严重影响

## 测试报告模板

```
### Story 4.6 手工验收测试报告

**测试环境**: 
- 操作系统: 
- 终端类型: 
- Node.js版本: 
- ccpet版本: 
- Supabase连接状态: 

**测试结果总结**:
- [ ] AC1: CLI排行榜命令实现
- [ ] AC2: 美观的CLI表格显示  
- [ ] AC3: 多维度排序和时间段筛选
- [ ] AC4: 错误处理和降级

**功能测试结果**:
- [ ] 基础命令功能
- [ ] 参数解析和验证
- [ ] 表格格式和美观性
- [ ] 数据排序准确性
- [ ] 时间段筛选逻辑
- [ ] 离线降级机制
- [ ] 错误处理和用户体验

**发现的问题**: 
(记录测试中发现的任何问题)

**性能表现**:
- 查询响应时间: 
- 内存使用情况:
- 大数据处理能力:

**总体评估**: ✅ 通过 / ❌ 不通过

**测试人员**: 
**测试日期**: 
```
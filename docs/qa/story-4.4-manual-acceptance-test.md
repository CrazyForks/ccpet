# Story 4.4: Supabase数据同步系统 - 手工验收测试

## 测试环境要求

### 前置条件
- 已安装ccpet CLI工具
- 已配置Supabase项目和API密钥
- 已安装ccusage CLI工具（用于读取token使用数据）
- 确保宠物处于活跃状态

### Supabase配置
ccpet已预配置Supabase，无需额外配置即可使用同步功能。

## AC1: SupabaseSyncService基础架构 ✅

### 验证步骤
1. **测试Supabase连接配置**
   ```bash
   ccpet sync --help
   ```
   
   **期望结果**: 显示完整的sync命令帮助信息，包含所有配置选项

2. **测试配置优先级**
   ```bash
   # 测试环境变量配置
   ccpet sync --dry-run --verbose
   
   # 测试命令行参数覆盖
   ccpet sync --supabase-url "https://test.supabase.co" --supabase-api-key "test-key" --dry-run --verbose
   ```
   
   **期望结果**: 
   - 环境变量配置被正确读取
   - 命令行参数优先级高于环境变量
   - 显示使用的配置信息

3. **测试错误处理**
   ```bash
   # 测试缺少配置
   unset SUPABASE_URL SUPABASE_ANON_KEY
   ccpet sync
   ```
   
   **期望结果**: 显示友好的错误信息，提示配置缺失

## AC2: 宠物记录同步功能 ✅

### 验证步骤
1. **检查当前宠物状态**
   ```bash
   ccpet check
   ```
   
   **记录**: 当前宠物信息（名称、动物类型、UUID、出生时间）

2. **首次宠物记录同步**
   ```bash
   ccpet sync --dry-run --verbose
   ```
   
   **期望结果**: 
   - 显示将要同步的宠物记录信息
   - 包含宠物名称、动物类型、出生时间
   - 如果宠物已死亡，显示死亡时间和存活天数

3. **执行实际宠物记录同步**
   ```bash
   ccpet sync --verbose
   ```
   
   **期望结果**: 
   - 成功同步宠物记录到Supabase
   - 返回宠物记录ID
   - 显示"Pet record synced with ID: xxx"

4. **验证数据库记录**
   在Supabase控制台查询`pet_records`表:
   ```sql
   SELECT * FROM pet_records ORDER BY created_at DESC LIMIT 1;
   ```
   
   **期望结果**: 
   - 记录存在且数据正确
   - UUID与本地宠物一致
   - 宠物信息完整准确

## AC3: Token使用记录同步功能 ✅

### 验证步骤
1. **检查ccusage数据可用性**
   ```bash
   ccusage --help
   npm list -g ccusage
   ```
   
   **期望结果**: ccusage工具正常安装且可用

2. **测试token使用记录读取**
   ```bash
   ccpet sync --dry-run --verbose --start-date $(date -d '7 days ago' '+%Y-%m-%d')
   ```
   
   **期望结果**: 
   - 显示找到的token使用记录数量
   - 展示样例记录（日期、token数量、成本）
   - 确认不会实际同步数据

3. **执行token使用记录同步**
   ```bash
   ccpet sync --verbose --start-date $(date -d '7 days ago' '+%Y-%m-%d')
   ```
   
   **期望结果**: 
   - 成功同步token使用记录
   - 显示处理的记录数量
   - 显示"Successfully synced X records"

4. **验证增量同步**
   ```bash
   # 再次运行相同的同步命令
   ccpet sync --verbose --start-date $(date -d '7 days ago' '+%Y-%m-%d')
   ```
   
   **期望结果**: 
   - 显示"All records are already synced"
   - 不会重复同步已存在的记录

5. **验证数据库记录**
   在Supabase控制台查询`token_usage`表:
   ```sql
   SELECT * FROM token_usage ORDER BY usage_date DESC LIMIT 5;
   ```
   
   **期望结果**: 
   - 记录存在且与本地ccusage数据一致
   - pet_id正确关联到宠物记录
   - 成本和token数量准确

## AC4: 智能日期范围和增量同步 ✅

### 验证步骤
1. **测试首次同步的智能日期范围**
   
   在新的测试环境或清空数据库后:
   ```bash
   ccpet sync --verbose
   ```
   
   **期望结果**: 
   - 自动从宠物出生日期开始同步
   - 显示智能确定的日期范围
   - 同步宠物整个生命周期的数据

2. **测试后续同步的增量逻辑**
   ```bash
   # 第二次运行同步
   ccpet sync --verbose
   ```
   
   **期望结果**: 
   - 自动从上次同步日期的下一天开始
   - 只同步新增的记录
   - 提高同步效率

3. **测试手动日期范围**
   ```bash
   ccpet sync --start-date 2024-01-01 --end-date 2024-01-31 --verbose
   ```
   
   **期望结果**: 
   - 使用用户指定的日期范围
   - 忽略智能日期范围逻辑
   - 同步指定时间段的数据

4. **测试同步状态查询**
   ```bash
   ccpet sync --dry-run --verbose
   ```
   
   **期望结果**: 
   - 正确显示下次同步的起始日期
   - 基于数据库中的最后记录日期计算

## AC5: 错误处理和数据验证 ✅

### 验证步骤
1. **测试网络连接错误**
   ```bash
   # 使用错误的URL
   ccpet sync --supabase-url "https://invalid.supabase.co" --supabase-api-key "test"
   ```
   
   **期望结果**: 
   - 显示清晰的网络错误信息
   - 不会损坏本地数据
   - 退出码为1

2. **测试API密钥错误**
   ```bash
   ccpet sync --supabase-api-key "invalid-key"
   ```
   
   **期望结果**: 
   - 显示认证失败错误
   - 提供解决建议
   - 不会继续执行

3. **测试数据格式验证**
   ```bash
   ccpet sync --start-date "invalid-date"
   ```
   
   **期望结果**: 
   - 显示日期格式错误
   - 提示正确的日期格式 (YYYY-MM-DD)
   - 拒绝执行同步

4. **测试部分失败处理**
   
   模拟批量同步中的部分失败场景:
   ```bash
   ccpet sync --verbose
   ```
   
   **期望结果**: 
   - 成功的记录被正确同步
   - 失败的记录被记录在错误日志中
   - 显示详细的错误统计信息

## AC6: 命令行用户体验 ✅

### 验证步骤
1. **测试帮助信息完整性**
   ```bash
   ccpet sync --help
   ```
   
   **期望结果**: 
   - 显示所有可用选项
   - 包含配置优先级说明
   - 提供使用示例
   - 包含配置命令参考

2. **测试详细输出模式**
   ```bash
   ccpet sync --verbose
   ```
   
   **期望结果**: 
   - 显示详细的同步进度
   - 包含每个步骤的状态信息
   - 提供调试所需的详细日志

3. **测试简洁输出模式**
   ```bash
   ccpet sync
   ```
   
   **期望结果**: 
   - 只显示关键的结果信息
   - 成功时显示同步记录数量
   - 失败时显示简洁的错误信息

## 性能验证

### 批量数据同步性能
1. **测试大量记录同步**
   ```bash
   # 同步大量历史数据
   ccpet sync --start-date $(date -d '90 days ago' '+%Y-%m-%d') --verbose
   ```
   
   **期望结果**: 
   - 同步在合理时间内完成（<2分钟对于90天数据）
   - 使用批处理避免API超时
   - 显示同步进度

2. **测试内存使用**
   在同步大量数据时监控内存使用:
   ```bash
   time ccpet sync --start-date $(date -d '90 days ago' '+%Y-%m-%d')
   ```
   
   **期望结果**: 
   - 内存使用稳定，不出现内存泄漏
   - 处理时间合理

## 数据完整性验证

### 端到端数据一致性检查
1. **比较本地和远程数据**
   ```bash
   # 获取本地ccusage数据
   ccusage --start-date $(date -d '7 days ago' '+%Y-%m-%d') --format json > local_data.json
   
   # 同步到Supabase
   ccpet sync --start-date $(date -d '7 days ago' '+%Y-%m-%d')
   ```
   
   然后在Supabase查询对应数据进行对比验证。

2. **验证数据类型和格式**
   检查Supabase中的数据:
   - 日期格式正确 (YYYY-MM-DD)
   - 数值类型准确 (整数token数量，小数成本)
   - UUID格式有效
   - 外键关联正确

## 集成验证

### 与现有系统的兼容性
1. **验证不影响现有功能**
   ```bash
   ccpet check
   ccpet reset
   ccpet config list
   ```
   
   **期望结果**: 所有现有命令正常工作，不受同步功能影响

2. **验证CLI集成**
   ```bash
   ccpet --help
   ```
   
   **期望结果**: sync命令正确显示在帮助信息中

## 测试报告模板

```
### Story 4.4 手工验收测试报告

**测试环境**: 
- 操作系统: 
- Node.js版本: 
- ccpet版本: 
- ccusage版本:
- Supabase项目: 

**测试结果总结**:
- [ ] AC1: SupabaseSyncService基础架构
- [ ] AC2: 宠物记录同步功能  
- [ ] AC3: Token使用记录同步功能
- [ ] AC4: 智能日期范围和增量同步
- [ ] AC5: 错误处理和数据验证
- [ ] AC6: 命令行用户体验

**发现的问题**: 
(记录测试中发现的任何问题)

**总体评估**: ✅ 通过 / ❌ 不通过

**测试人员**: 
**测试日期**: 
```
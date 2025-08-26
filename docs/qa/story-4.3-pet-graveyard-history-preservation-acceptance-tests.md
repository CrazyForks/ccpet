# Story 4.3 宠物墓地与历史记录保存 - 手工验收测试文档

## 测试基本信息

| 项目 | 值 |
|------|-----|
| 故事编号 | 4.3 |
| 故事名称 | 宠物墓地与历史记录保存 |
| 测试版本 | v1.1.2 |
| 测试日期 | 2025-08-26 |
| 测试人员 | [测试人员姓名] |

## 测试环境准备

### 前置条件
1. ✅ 确保已安装ccpet v1.1.2或更高版本
2. ✅ 确保具有文件系统读写权限（用于访问 `~/.claude-pet/` 目录）
3. ✅ 确保磁盘空间充足（至少10MB用于测试）
4. ✅ 已完成Story 4.2的验收（宠物命名系统）

### 测试环境设置
```bash
# 1. 清理测试环境
rm -rf ~/.claude-pet/graveyard/ 2>/dev/null || true

# 2. 验证ccpet版本
ccpet --version  # 应显示 v1.1.2 或更高

# 3. 创建初始宠物状态
ccpet check      # 创建初始宠物
```

## 验收标准测试

### AC1: 宠物死亡时历史记录保存

#### 测试用例 1.1: 基本死亡和墓地保存功能
**测试步骤：**
1. 创建一个新宠物并记录其状态
   ```bash
   ccpet check
   ```
   📝 **记录**: 当前宠物名称: `_______________`

2. 模拟宠物死亡（通过配置或时间流逝让宠物能量降至0）
   - 方法1: 等待宠物自然死亡（需要较长时间）
   - 方法2: 使用重置命令强制死亡流程
   ```bash
   ccpet reset  # 这会触发死亡->墓地保存->新宠物流程
   ```

3. 验证墓地结构创建
   ```bash
   ls -la ~/.claude-pet/graveyard/
   ```
   **预期结果：**
   - ✅ 存在以原宠物名称命名的目录
   - ✅ 目录权限正确设置

4. 验证墓地文件内容
   ```bash
   ls -la ~/.claude-pet/graveyard/[宠物名称]/
   cat ~/.claude-pet/graveyard/[宠物名称]/pet-state.json
   ```
   **预期结果：**
   - ✅ 存在 `pet-state.json` 文件
   - ✅ 文件包含完整的历史状态信息
   - ✅ JSON格式正确，能够解析

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

#### 测试用例 1.2: 同名宠物序号处理
**测试步骤：**
1. 重复执行重置操作，创建多个同名宠物
   ```bash
   # 如果随机生成了同名宠物，或手动创建同名情况
   ccpet reset
   ccpet reset
   # 重复直到出现同名冲突
   ```

2. 验证墓地中同名宠物的处理
   ```bash
   ls -la ~/.claude-pet/graveyard/ | grep -E "(^d.*同名宠物)"
   ```
   **预期结果：**
   - ✅ 第一个同名宠物：`{petName}/`
   - ✅ 第二个同名宠物：`{petName}-2/`
   - ✅ 第三个同名宠物：`{petName}-3/`
   - ✅ 依此类推...

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

#### 测试用例 1.3: 原子操作验证
**测试步骤：**
1. 创建一个宠物并让其拥有一些历史数据
   ```bash
   ccpet check  # 多次运行积累一些token和时间
   ```

2. 在重置过程中验证数据完整性
   ```bash
   # 执行重置并立即检查文件状态
   ccpet reset &
   # 在重置过程中快速检查文件状态
   ls -la ~/.claude-pet/
   ls -la ~/.claude-pet/graveyard/
   ```
   **预期结果：**
   - ✅ 不存在部分写入的文件
   - ✅ 要么旧状态存在，要么新状态已完整创建
   - ✅ 不存在数据丢失的情况

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

### AC2: 新宠物状态初始化

#### 测试用例 2.1: 新宠物初始化验证
**测试步骤：**
1. 执行宠物重置
   ```bash
   ccpet reset
   ```

2. 验证新宠物状态
   ```bash
   ccpet check
   cat ~/.claude-pet/pet-state.json
   ```
   **预期结果：**
   - ✅ 新宠物有随机生成的名称（不同于墓地中的名称）
   - ✅ energy = 100（满能量）
   - ✅ totalTokensConsumed = 0
   - ✅ accumulatedTokens = 0
   - ✅ totalLifetimeTokens = 0
   - ✅ birthTime 是最近的时间戳
   - ✅ lastFeedTime 是最近的时间戳

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

#### 测试用例 2.2: 随机名称生成验证
**测试步骤：**
1. 多次执行重置，记录生成的宠物名称
   ```bash
   for i in {1..5}; do
     ccpet reset
     echo "重置 $i: $(ccpet check | grep -o '名称：[^[:space:]]*' || echo 'N/A')"
   done
   ```
   **预期结果：**
   - ✅ 每次重置都生成不同的随机名称
   - ✅ 名称来自预定义的中英文名称列表
   - ✅ 名称格式符合预期（无特殊字符问题）

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

### AC3: 墓地文件夹结构维护

#### 测试用例 3.1: 墓地结构完整性
**测试步骤：**
1. 创建多个宠物历史记录
   ```bash
   # 创建至少3-5个宠物历史
   for i in {1..3}; do
     ccpet reset
     sleep 1  # 确保时间戳不同
   done
   ```

2. 验证墓地整体结构
   ```bash
   tree ~/.claude-pet/graveyard/ 2>/dev/null || find ~/.claude-pet/graveyard/ -type f -name "*.json"
   ```
   **预期结果：**
   ```
   ~/.claude-pet/graveyard/
   ├── [宠物名称1]/
   │   └── pet-state.json
   ├── [宠物名称2]/
   │   └── pet-state.json
   └── [宠物名称3]/
       └── pet-state.json
   ```
   - ✅ 每个宠物有独立的子目录
   - ✅ 每个子目录包含完整的状态文件
   - ✅ 目录名称正确对应宠物名称

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

#### 测试用例 3.2: 历史数据访问性
**测试步骤：**
1. 从墓地中读取历史宠物数据
   ```bash
   # 检查每个墓地文件的可读性
   for dir in ~/.claude-pet/graveyard/*/; do
     echo "检查目录: $dir"
     if [ -f "$dir/pet-state.json" ]; then
       echo "  - 文件存在: ✅"
       if jq . "$dir/pet-state.json" >/dev/null 2>&1; then
         echo "  - JSON有效: ✅"
         echo "  - 宠物名称: $(jq -r '.petName' "$dir/pet-state.json")"
         echo "  - 总Token: $(jq -r '.totalLifetimeTokens' "$dir/pet-state.json")"
       else
         echo "  - JSON无效: ❌"
       fi
     else
       echo "  - 文件缺失: ❌"
     fi
     echo "---"
   done
   ```
   **预期结果：**
   - ✅ 所有墓地文件都可读
   - ✅ 所有JSON文件格式正确
   - ✅ 包含完整的历史状态信息

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

## 错误场景测试

### 测试用例 E1: 文件权限错误处理
**测试步骤：**
1. 创建权限受限的墓地目录
   ```bash
   mkdir -p ~/.claude-pet/graveyard/test-restricted
   chmod 000 ~/.claude-pet/graveyard/test-restricted
   ```

2. 执行重置操作并观察错误处理
   ```bash
   ccpet reset 2>&1 | tee reset-error.log
   ```
   **预期结果：**
   - ✅ 系统优雅处理权限错误
   - ✅ 不崩溃或产生未处理的异常
   - ✅ 记录适当的错误日志

3. 清理测试
   ```bash
   chmod 755 ~/.claude-pet/graveyard/test-restricted
   rmdir ~/.claude-pet/graveyard/test-restricted
   ```

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

### 测试用例 E2: 磁盘空间不足模拟
**注意：此测试可能影响系统，请在测试环境中进行**

**测试步骤：**
1. 创建一个小的测试分区或使用已满的目录（如果安全）
2. 尝试在空间不足的情况下执行重置
3. 验证系统的错误恢复机制

**预期结果：**
- ✅ 系统检测到空间不足
- ✅ 优雅降级或错误恢复
- ✅ 不损坏现有数据

**测试结果：** ✅通过 / ❌失败 / ⏭️跳过（风险过高）  
**备注：** ________________

## 兼容性测试

### 测试用例 C1: 向后兼容性验证
**测试步骤：**
1. 创建一个不包含petName的旧状态文件
   ```bash
   # 备份当前状态
   cp ~/.claude-pet/pet-state.json ~/.claude-pet/pet-state.json.backup

   # 创建没有petName字段的旧格式状态
   jq 'del(.petName)' ~/.claude-pet/pet-state.json.backup > ~/.claude-pet/pet-state-old.json
   cp ~/.claude-pet/pet-state-old.json ~/.claude-pet/pet-state.json
   ```

2. 执行重置操作
   ```bash
   ccpet reset
   ```
   **预期结果：**
   - ✅ 系统自动为旧状态补充petName字段
   - ✅ 墓地保存操作正常执行
   - ✅ 不出现崩溃或错误

3. 恢复环境
   ```bash
   mv ~/.claude-pet/pet-state.json.backup ~/.claude-pet/pet-state.json
   ```

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

## 性能测试

### 测试用例 P1: 大量历史记录性能
**测试步骤：**
1. 创建大量墓地记录（建议10-20个）
   ```bash
   start_time=$(date +%s)
   for i in {1..10}; do
     ccpet reset >/dev/null 2>&1
     echo "Created graveyard entry $i"
   done
   end_time=$(date +%s)
   echo "Total time: $((end_time - start_time)) seconds"
   ```

2. 验证性能是否在可接受范围内
   **预期结果：**
   - ✅ 每次重置操作在5秒内完成
   - ✅ 墓地数量不影响单次操作性能
   - ✅ 系统响应时间保持稳定

**测试结果：** ✅通过 / ❌失败  
**实际性能：** 平均耗时 _______ 秒  
**备注：** ________________

## 数据完整性验证

### 测试用例 D1: 完整生命周期数据验证
**测试步骤：**
1. 创建一个宠物并记录详细状态
   ```bash
   ccpet check > initial-state.txt
   initial_name=$(grep -o 'petName":"[^"]*' ~/.claude-pet/pet-state.json | cut -d'"' -f3)
   echo "初始宠物名称: $initial_name"
   ```

2. 让宠物积累一些活动数据（如果可能的话）
3. 执行重置并验证墓地中的数据完整性
   ```bash
   ccpet reset
   
   # 验证墓地中的数据
   graveyard_file="$HOME/.claude-pet/graveyard/$initial_name/pet-state.json"
   if [ -f "$graveyard_file" ]; then
     echo "墓地文件存在: ✅"
     
     # 验证关键字段
     echo "验证数据完整性:"
     echo "- petName: $(jq -r '.petName' "$graveyard_file")"
     echo "- birthTime: $(jq -r '.birthTime' "$graveyard_file")"
     echo "- lastFeedTime: $(jq -r '.lastFeedTime' "$graveyard_file")"
     echo "- totalLifetimeTokens: $(jq -r '.totalLifetimeTokens' "$graveyard_file")"
     echo "- animalType: $(jq -r '.animalType' "$graveyard_file")"
   else
     echo "墓地文件不存在: ❌"
   fi
   ```
   **预期结果：**
   - ✅ 所有原始状态字段都被保存
   - ✅ 数据类型和格式正确
   - ✅ 时间戳信息准确保存

**测试结果：** ✅通过 / ❌失败  
**备注：** ________________

## 测试总结

### 验收标准完成度
- AC1 (宠物死亡时历史记录保存): ✅通过 / ❌失败
- AC2 (新宠物状态初始化): ✅通过 / ❌失败  
- AC3 (墓地文件夹结构维护): ✅通过 / ❌失败

### 测试统计
| 测试类别 | 总数 | 通过 | 失败 | 跳过 |
|---------|------|------|------|------|
| 功能测试 | 7 | ___ | ___ | ___ |
| 错误场景 | 2 | ___ | ___ | ___ |
| 兼容性测试 | 1 | ___ | ___ | ___ |
| 性能测试 | 1 | ___ | ___ | ___ |
| 数据完整性 | 1 | ___ | ___ | ___ |
| **总计** | **12** | **___** | **___** | **___** |

### 发现的问题
| 序号 | 问题描述 | 严重程度 | 状态 |
|------|---------|----------|------|
| 1 | | 高/中/低 | 开放/已修复 |
| 2 | | 高/中/低 | 开放/已修复 |

### 测试结论
- ✅ **验收通过** - 所有AC标准满足，功能正常工作
- ⚠️ **条件通过** - 主要功能正常，但存在次要问题
- ❌ **验收失败** - 存在阻塞性问题，需要修复

### 测试人员签名
**测试人员：** ________________  
**测试完成日期：** ________________  
**审核人员：** ________________  
**审核日期：** ________________

---

## 附录

### 测试环境信息
- **操作系统：** ________________
- **Node.js版本：** ________________
- **ccpet版本：** ________________
- **磁盘可用空间：** ________________

### 相关文档
- [Story 4.3 技术文档](../stories/4.3.pet-graveyard-history-preservation.md)
- [测试策略文档](../architecture/testing-strategy.md)
- [错误处理文档](../architecture/error-handling.md)

### 清理命令
测试完成后，可使用以下命令清理测试数据：
```bash
# 清理墓地测试数据（小心使用）
rm -rf ~/.claude-pet/graveyard/
rm -f ~/.claude-pet/pet-state.json.backup
rm -f ~/.claude-pet/pet-state-old.json
rm -f initial-state.txt
rm -f reset-error.log
```
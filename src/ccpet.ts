import { Pet, IPetState } from './core/Pet';
import { StatusBarFormatter } from './ui/StatusBar';
import { PetStorage } from './services/PetStorage';
import { ConfigService } from './services/ConfigService';
import { AutoSyncService } from './services/AutoSyncService';
import { getTokenMetrics } from './utils/jsonl';
import { PET_CONFIG, generateRandomPetName } from './core/config';
import { v4 as uuidv4 } from 'uuid';

// Simple animation counter for cycling expressions
class AnimationCounter {
  private callCount: number = 0;
  private readonly testMode: boolean;
  private readonly COUNTER_FILE = require('path').join(require('os').homedir(), '.claude-pet', 'animation-counter.json');

  constructor(testMode: boolean = false) {
    this.testMode = testMode;
    if (!testMode) {
      this.loadCounter();
    }
  }

  private loadCounter(): void {
    try {
      const fs = require('fs');
      if (fs.existsSync(this.COUNTER_FILE)) {
        const data = JSON.parse(fs.readFileSync(this.COUNTER_FILE, 'utf8'));
        this.callCount = data.callCount || 0;
      }
    } catch (error) {
      // 忽略加载错误，从0开始
      this.callCount = 0;
    }
  }

  private saveCounter(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // 确保目录存在
      const dir = path.dirname(this.COUNTER_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const data = {
        callCount: this.callCount,
        lastUpdate: Date.now()
      };
      fs.writeFileSync(this.COUNTER_FILE, JSON.stringify(data));
    } catch (error) {
      // 忽略保存错误
    }
  }

  public recordCall(): void {
    // 在测试模式下不记录调用
    if (this.testMode) {
      return;
    }
    this.callCount++;
    this.saveCounter();
  }

  public shouldEnableAnimation(): boolean {
    // 在测试模式下禁用动画
    return !this.testMode;
  }

  public getFrameIndex(): number {
    // 基于调用次数返回帧索引，用于动画循环
    return this.callCount;
  }
}

class ClaudeCodeStatusLine {
  private pet: Pet;
  private formatter: StatusBarFormatter;
  private storage: PetStorage;
  private configService: ConfigService;
  private animationCounter: AnimationCounter;
  private autoSyncService: AutoSyncService;

  constructor(testMode: boolean = false, configService?: ConfigService) {
    this.animationCounter = new AnimationCounter(testMode);
    this.storage = new PetStorage();
    this.configService = configService || new ConfigService();
    this.autoSyncService = new AutoSyncService(this.configService, testMode);
    this.formatter = new StatusBarFormatter(testMode, configService);
    
    // Load or create initial pet state
    const savedState = this.storage.loadState();
    const now = new Date();
    const initialState: IPetState = savedState || {
      uuid: uuidv4(),
      energy: PET_CONFIG.INITIAL_ENERGY,
      expression: PET_CONFIG.HAPPY_EXPRESSION,
      animalType: Pet.getRandomAnimalType(), // 随机分配动物类型给新宠物
      birthTime: now, // 新宠物的诞生时间
      lastFeedTime: now,
      totalTokensConsumed: 0,
      accumulatedTokens: 0,
      totalLifetimeTokens: 0,
      petName: generateRandomPetName() // 为新宠物分配随机名称
    };


    this.pet = new Pet(initialState, { config: PET_CONFIG });
    
    // Apply time decay since last session
    if (savedState) {
      this.pet.applyTimeDecay();
    }
  }

  public async processTokensAndGetStatusDisplay(claudeCodeInput: ClaudeCodeStatusInput): Promise<string> {
    try {
      // 记录函数调用以更新动画帧
      this.animationCounter.recordCall();
      
      // Always apply time decay first
      this.pet.applyTimeDecay();
      
      // Process tokens from JSONL transcript file
      // Check if this is a resumed conversation (total_cost_usd = 0 indicates resume)
      const isResumedConversation = claudeCodeInput.cost.total_cost_usd === 0;
      const tokenMetrics = await getTokenMetrics(claudeCodeInput.transcript_path, isResumedConversation);
      
      if (tokenMetrics.totalTokens > 0) {
        // Feed pet with actual tokens (using new accumulation system)
        this.pet.feed(tokenMetrics.totalTokens);
      }
      
      // Update session metrics using proper method
      const sessionMetrics: any = {
        sessionTotalInputTokens: tokenMetrics.sessionTotalInputTokens,
        sessionTotalOutputTokens: tokenMetrics.sessionTotalOutputTokens,
        sessionTotalCachedTokens: tokenMetrics.sessionTotalCachedTokens,
        sessionTotalCostUsd: claudeCodeInput.cost.total_cost_usd,
        contextLength: tokenMetrics.contextLength
      };
      
      // Only calculate percentages if contextLength is defined
      if (tokenMetrics.contextLength !== undefined) {
        sessionMetrics.contextPercentage = Math.min(100, (tokenMetrics.contextLength / 200000) * 100);
        sessionMetrics.contextPercentageUsable = Math.min(100, (tokenMetrics.contextLength / 160000) * 100);
      }
      
      this.pet.updateSessionMetrics(sessionMetrics);
      
      // Get updated state for display
      const state = this.pet.getState();
      
      // 检查并触发自动同步（在后台运行，不影响状态显示）
      this.autoSyncService.checkAndTriggerAutoSync().catch(error => {
        // 静默处理自动同步错误，不影响主要功能
        console.warn('Auto sync check failed:', error);
      });
      
      // 启用动画并获取当前帧索引
      const animationEnabled = this.animationCounter.shouldEnableAnimation();
      const frameIndex = this.animationCounter.getFrameIndex();
      
      // 获取用户配置
      const config = this.configService.getConfig();
      const emojiEnabled = config.pet.emojiEnabled ?? true;
      
      // 获取动画表情（带emoji支持）
      const animatedExpression = this.pet.getAnimatedExpression(animationEnabled, frameIndex, emojiEnabled);
      
      // 显示宠物状态（带动画表情）
      return this.formatter.formatPetDisplay(state, animatedExpression);
      
    } catch (error) {
      console.error('Token processing failed:', error);
      // Apply time decay even on error
      this.pet.applyTimeDecay();
      // Fallback to current state without token processing
      const state = this.pet.getState();
      return this.formatter.formatPetDisplay(state);
    }
  }

  public getStatusDisplay(): string {
    // 记录函数调用以更新动画帧
    this.animationCounter.recordCall();
    
    // Apply time decay before getting display
    this.pet.applyTimeDecay();
    const state = this.pet.getState();
    
    // 检查并触发自动同步（在后台运行，不影响状态显示）
    this.autoSyncService.checkAndTriggerAutoSync().catch(error => {
      // 静默处理自动同步错误，不影响主要功能
      console.warn('Auto sync check failed:', error);
    });
    
    // 启用动画并获取当前帧索引
    const animationEnabled = this.animationCounter.shouldEnableAnimation();
    const frameIndex = this.animationCounter.getFrameIndex();
    
    // 获取用户配置
    const config = this.configService.getConfig();
    const emojiEnabled = config.pet.emojiEnabled ?? true;
    
    // 获取动画表情（带emoji支持）
    const animatedExpression = this.pet.getAnimatedExpression(animationEnabled, frameIndex, emojiEnabled);
    
    // 显示宠物状态（带动画表情）
    return this.formatter.formatPetDisplay(state, animatedExpression);
  }

  public saveState(): void {
    this.storage.saveState(this.pet.getState());
  }

  public adoptNewPet(): void {
    if (this.pet.isDead()) {
      // Save current deceased pet to graveyard before creating new one
      this.pet.resetToInitialState((currentState: IPetState) => {
        try {
          this.storage.moveToGraveyard(currentState);
          console.log(`Moved deceased pet "${currentState.petName}" to graveyard`);
        } catch (error) {
          console.error('Failed to move pet to graveyard:', error);
          // Continue with reset even if graveyard save fails
        }
      });
      
      this.saveState();
      
      const newPetState = this.pet.getState();
      console.log(`New pet "${newPetState.petName}" adopted successfully`);
      
      // Show success notification if VSCode API is available
      if (typeof window !== 'undefined' && window.vscode?.postMessage) {
        window.vscode.postMessage({
          command: 'showInformationMessage',
          text: `Successfully adopted a new pet named "${newPetState.petName}"! Your pet is now happy and full of energy.`
        });
      }
    }
  }

  public isPetDead(): boolean {
    return this.pet.isDead();
  }
}

// Claude Code Status Hook Interface
interface ClaudeCodeStatusInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
  version: string;
  output_style: {
    name: string;
  };
  cost: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
}

// Function to read from stdin
function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let input = '';
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    
    process.stdin.on('end', () => {
      resolve(input.trim());
    });
  });
}

// Main execution for CLI
export async function main(): Promise<void> {
  try {
    // Read Claude Code JSON input from stdin
    const inputData = await readStdin();
    // console.log('Input data:', inputData);
    
    if (!inputData) {
      // No input provided - check if CCPET_TRANSCRIPT_PATH is set for testing
      const transcriptPath = process.env.CCPET_TRANSCRIPT_PATH;
      if (transcriptPath) {
        // Create a minimal ClaudeCodeStatusInput for testing
        const claudeCodeInput: ClaudeCodeStatusInput = {
          hook_event_name: 'test',
          session_id: 'test',
          transcript_path: transcriptPath,
          cwd: process.cwd(),
          model: { id: 'test', display_name: 'test' },
          workspace: { current_dir: process.cwd(), project_dir: process.cwd() },
          version: '1.0.0',
          output_style: { name: 'default' },
          cost: {
            total_cost_usd: 0,
            total_duration_ms: 0,
            total_api_duration_ms: 0,
            total_lines_added: 0,
            total_lines_removed: 0
          }
        };
        
        const statusLine = new ClaudeCodeStatusLine();
        const display = await statusLine.processTokensAndGetStatusDisplay(claudeCodeInput);
        statusLine.saveState();
        process.stdout.write(display);
        return;
      }
      
      // No input provided and no transcript path - show basic status
      const statusLine = new ClaudeCodeStatusLine();
      const display = statusLine.getStatusDisplay();
      statusLine.saveState();
      process.stdout.write(display);
      return;
    }
    
    let claudeCodeInput: ClaudeCodeStatusInput;
    try {
      claudeCodeInput = JSON.parse(inputData);
      // console.log('Claude Code input:', claudeCodeInput)
    } catch (error) {
      // Invalid JSON - show basic status
      const statusLine = new ClaudeCodeStatusLine();
      const display = statusLine.getStatusDisplay();
      statusLine.saveState();
      process.stdout.write(display);
      return;
    }
    
    const statusLine = new ClaudeCodeStatusLine();
    const display = await statusLine.processTokensAndGetStatusDisplay(claudeCodeInput);
    statusLine.saveState();
    
    // Output the status line display
    process.stdout.write(display);
  } catch (error) {
    // Fallback display on error
    process.stdout.write('(?) ERROR');
    process.stderr.write(`Pet status error: ${error}\n`);
    process.exit(1);
  }
}

// VSCode Extension Activation (if running in VSCode environment)
export function activate(context: any) {
  const statusLine = new ClaudeCodeStatusLine();

  // Register the adoptNewPet command
  context.subscriptions.push(
    {
      command: 'claude-pet.adoptNewPet',
      callback: () => {
        statusLine.adoptNewPet();
      }
    }
  );

  // Register command with VSCode if vscode API is available
  if (typeof window !== 'undefined' && window.vscode?.commands) {
    window.vscode.commands.registerCommand('claude-pet.adoptNewPet', () => {
      statusLine.adoptNewPet();
    });
  }
}

// VSCode Extension Deactivation
export function deactivate() {
  // Clean up if needed
}

// Note: main() is now called explicitly from cli.ts
// The automatic execution has been removed to prevent duplicate calls

export { ClaudeCodeStatusLine };
export { StatusBarFormatter } from './ui/StatusBar';
import { CheckCommand } from './commands/CheckCommand';
import { ConfigCommand } from './commands/ConfigCommand';
import { ResetCommand } from './commands/ResetCommand';
import { SyncCommand } from './commands/SyncCommand';
import { LeaderboardCommand } from './commands/LeaderboardCommand';
import { AutoSyncStatusCommand } from './commands/AutoSyncStatusCommand';
import { main as ccpetMain } from './ccpet';

// Import package.json to get version
const packageJson = require('../package.json');

interface Command {
  name: string;
  description: string;
  execute(args: string[]): Promise<void>;
}

const commands: Command[] = [
  new AutoSyncStatusCommand(),
  new CheckCommand(),
  new ConfigCommand(),
  new LeaderboardCommand(),
  new ResetCommand(),
  new SyncCommand()
];

function showVersion() {
  console.log(`ccpet v${packageJson.version}`);
}

function showHelp() {
  console.log('ccpet - Claude Code Pet CLI');
  console.log('');
  console.log('Usage: ccpet [command] [options]');
  console.log('');
  console.log('Commands:');
  for (const command of commands) {
    console.log(`  ${command.name.padEnd(12)} ${command.description}`);
  }
  console.log('');
  console.log('Options:');
  console.log('  -h, --help               Show help information');
  console.log('  -v, --version            Show version number');
  console.log('');
  console.log('Examples:');
  console.log('  ccpet                    # Show status line (for Claude Code)');
  console.log('  ccpet autosync status    # Check auto sync status and settings');
  console.log('  ccpet check             # Manually check pet status');  
  console.log('  ccpet config list       # List current configuration');
  console.log('  ccpet config set colors.petExpression "#FF0000"');
  console.log('  ccpet leaderboard       # Show pet leaderboard rankings');
  console.log('  ccpet reset             # Reset pet to initial state');
  console.log('  ccpet sync              # Sync pet data to Supabase');
}

export async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Default: directly call ccpet main function for backward compatibility
    // This maintains compatibility with existing Claude Code configurations
    await ccpetMain();
    return;
  }

  const commandName = args[0];
  
  if (commandName === '--help' || commandName === '-h') {
    showHelp();
    return;
  }

  if (commandName === '--version' || commandName === '-v') {
    showVersion();
    return;
  }


  const command = commands.find(cmd => cmd.name === commandName);
  
  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.error('Run "ccpet --help" for usage information.');
    process.exit(1);
  }

  try {
    await command.execute(args.slice(1));
  } catch (error: any) {
    console.error(`Error executing command: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}
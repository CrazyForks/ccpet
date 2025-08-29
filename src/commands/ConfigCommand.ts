import { ConfigService } from '../services/ConfigService';

export class ConfigCommand {
  name = 'config';
  description = 'Manage ccpet configuration';
  private configService = new ConfigService();

  async execute(args: string[]): Promise<void> {
    if (args.length === 0) {
      this.showHelp();
      return;
    }

    const subCommand = args[0];

    switch (subCommand) {
      case 'list':
        await this.listConfig();
        break;
      case 'set':
        await this.setConfig(args.slice(1));
        break;
      case 'reset':
        await this.resetConfig();
        break;
      case 'path':
        await this.showConfigPath();
        break;
      default:
        console.error(`Unknown config command: ${subCommand}`);
        this.showHelp();
        process.exit(1);
    }
  }

  private showHelp(): void {
    console.log('ccpet config - Configuration management');
    console.log('');
    console.log('Usage: ccpet config <subcommand> [options]');
    console.log('');
    console.log('Subcommands:');
    console.log('  list                     List current configuration');
    console.log('  set <key> <value>        Set configuration value');
    console.log('  reset                    Reset to default configuration');
    console.log('  path                     Show configuration file path');
    console.log('');
    console.log('Configuration keys:');
    console.log('  colors.petExpression     Pet expression color');
    console.log('  colors.petName           Pet name color');
    console.log('  colors.energyBar         Energy bar color');
    console.log('  colors.energyValue       Energy value color');
    console.log('  colors.accumulatedTokens Accumulated tokens color');
    console.log('  colors.lifetimeTokens    Lifetime tokens color');
    console.log('  colors.sessionInput      Session input color');
    console.log('  colors.sessionOutput     Session output color');
    console.log('  colors.sessionCached     Session cached color');
    console.log('  colors.sessionTotal      Session total color');
    console.log('  colors.contextLength     Context length color');
    console.log('  colors.contextPercentage Context percentage color');
    console.log('  colors.contextPercentageUsable Context percentage usable color');
    console.log('  pet.animationEnabled     Enable/disable animations (true/false)');
    console.log('  pet.decayRate           Energy decay rate per minute');
    console.log('  display.maxLines         Maximum lines to display (1-3)');
    console.log('  display.line2.enabled    Enable/disable line 2 (true/false)');
    console.log('  display.line2.items      Items to show on line 2 (comma-separated)');
    console.log('  display.line3.enabled    Enable/disable line 3 (true/false)');
    console.log('  display.line3.items      Items to show on line 3 (comma-separated)');
    console.log('  supabase.url             Supabase project URL');
    console.log('  supabase.apiKey          Supabase anonymous API key');
    console.log('  supabase.autoSync        Enable/disable auto sync (true/false)');
    console.log('  supabase.syncInterval    Auto sync interval in minutes (number)');
    console.log('');
    console.log('Available display items: input, output, cached, total, context-length, context-percentage, context-percentage-usable');
    console.log('');
    console.log('Examples:');
    console.log('  ccpet config set colors.petExpression "#FF0000:bright"');
    console.log('  ccpet config set pet.animationEnabled false');
    console.log('  ccpet config set pet.decayRate 0.05');
    console.log('  ccpet config set display.maxLines 3');
    console.log('  ccpet config set display.line2.items "input,output"');
    console.log('  ccpet config set display.line3.items "total"');
  }

  private async listConfig(): Promise<void> {
    try {
      const config = this.configService.listConfig();
      console.log('Current configuration:');
      console.log(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to list configuration:', errorMessage);
      process.exit(1);
    }
  }

  private async setConfig(args: string[]): Promise<void> {
    if (args.length !== 2) {
      console.error('Usage: ccpet config set <key> <value>');
      process.exit(1);
    }

    const [key, value] = args;
    
    try {
      if (key.startsWith('colors.')) {
        const colorKey = key.replace('colors.', '') as any;
        this.configService.setColorConfig(colorKey, value);
        console.log(`✅ Set ${key} = ${value}`);
      } else if (key.startsWith('pet.')) {
        const petKey = key.replace('pet.', '') as any;
        let parsedValue: any = value;
        
        // Parse boolean and number values
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        this.configService.setPetConfig(petKey, parsedValue);
        console.log(`✅ Set ${key} = ${parsedValue}`);
      } else if (key.startsWith('display.')) {
        const displayKey = key.replace('display.', '');
        let parsedValue: any = value;
        
        // Parse boolean and number values for display config
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        this.configService.setDisplayConfig(displayKey, parsedValue);
        console.log(`✅ Set ${key} = ${parsedValue}`);
      } else if (key.startsWith('supabase.')) {
        const supabaseKey = key.replace('supabase.', '');
        let parsedValue: any = value;
        
        // Parse boolean and number values for Supabase config
        if (value === 'true') parsedValue = true;
        else if (value === 'false') parsedValue = false;
        else if (!isNaN(Number(value))) parsedValue = Number(value);
        
        this.configService.setSupabaseConfig(supabaseKey, parsedValue);
        console.log(`✅ Set ${key} = ${parsedValue}`);
      } else {
        console.error(`Unknown configuration key: ${key}`);
        console.error('Run "ccpet config" to see available keys.');
        process.exit(1);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to set configuration:', errorMessage);
      process.exit(1);
    }
  }

  private async resetConfig(): Promise<void> {
    try {
      this.configService.resetConfig();
      console.log('✅ Configuration reset to defaults');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to reset configuration:', errorMessage);
      process.exit(1);
    }
  }

  private async showConfigPath(): Promise<void> {
    try {
      const path = this.configService.getConfigPath();
      console.log(`Configuration file: ${path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to get configuration path:', errorMessage);
      process.exit(1);
    }
  }
}
import { confirm, input, select } from '@inquirer/prompts';

// ---------------------------------------------------------------------------
// ask() — Yes/No prompt — Task 4.3
// ---------------------------------------------------------------------------

export async function ask(message: string): Promise<boolean> {
  try {
    return await confirm({ message, default: false });
  } catch {
    // Ctrl+C or stream close
    console.log('\nCancelled.');
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// strongConfirm() — user must type a specific word — Task 4.3
// ---------------------------------------------------------------------------

export async function strongConfirm(message: string, requiredWord: string): Promise<boolean> {
  console.log(message);
  console.log(`Type "${requiredWord}" to confirm, or anything else to cancel:`);
  try {
    const answer = await input({ message: '>' });
    return answer.trim() === requiredWord;
  } catch {
    console.log('\nCancelled.');
    process.exit(0);
  }
}

// ---------------------------------------------------------------------------
// choose() — single selection from a list — Task 4.3
// ---------------------------------------------------------------------------

export async function choose<T extends string>(message: string, choices: T[]): Promise<T> {
  try {
    const result = await select<T>({
      message,
      choices: choices.map((c) => ({ name: c, value: c })),
    });
    return result;
  } catch {
    console.log('\nCancelled.');
    process.exit(0);
  }
}

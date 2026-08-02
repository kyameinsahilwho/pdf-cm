import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Executes a Python script reliably across Windows, Mac, and Linux environments.
 * Tries `python`, `py`, and `python3` in order if command fails with ENOENT.
 */
export async function runPythonScript(
  scriptPath: string,
  args: string[],
  options: { timeout?: number; maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const executables = process.platform === 'win32'
    ? ['python', 'py', 'python3']
    : ['python3', 'python'];

  let lastError: any = null;

  for (const pyExec of executables) {
    try {
      const res = await execFileAsync(pyExec, [scriptPath, ...args], {
        timeout: options.timeout || 120000,
        maxBuffer: options.maxBuffer || 1024 * 1024 * 50,
      });
      return res;
    } catch (err: any) {
      lastError = err;
      // If error is ENOENT (python command not found), try next executable in list
      if (err.code === 'ENOENT') {
        continue;
      }
      // If Python process returned non-zero exit code or stderr, throw explicit error
      const stderr = err.stderr || err.message || 'Python execution failed';
      throw new Error(`Python execution error (${pyExec}): ${stderr}`);
    }
  }

  throw new Error(
    `Failed to locate Python executable (${executables.join(', ')}). Error: ${lastError?.message || lastError}`
  );
}

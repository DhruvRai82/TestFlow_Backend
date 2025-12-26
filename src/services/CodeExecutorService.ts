import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface ExecutionResult {
    runId: string;
    logs: string[];
    exitCode: number | null;
}

export class CodeExecutorService {
    private tempDir: string;

    constructor() {
        this.tempDir = path.join(process.cwd(), 'temp_execution');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    async executeCode(content: string, language: string): Promise<ExecutionResult> {
        const runId = uuidv4();
        let fileName = `${runId}.txt`;
        let command = '';
        let args: string[] = [];
        let env = { ...process.env }; // Inherit env (PATH, DISPLAY, etc.)

        // 1. Prepare File & Command
        switch (language) {
            case 'typescript':
            case 'javascript':
                fileName = `${runId}.ts`; // Run everything as TS/JS via tsx for simplicity
                // Using 'npx tsx' allows it to find local node_modules easily
                command = 'npx';
                args = ['tsx', path.join(this.tempDir, fileName)];
                break;
            case 'python':
                fileName = `${runId}.py`;

                // Check for local venv "python_env" in backend root
                const venvPath = path.join(process.cwd(), 'python_env', 'Scripts', 'python.exe');
                if (fs.existsSync(venvPath)) {
                    command = venvPath;
                } else {
                    command = 'python'; // Fallback to system python
                }

                args = [path.join(this.tempDir, fileName)];
                break;
            case 'java':
                // Basic Java Support (Single File)
                fileName = `Main_${runId.replace(/-/g, '')}.java`;
                command = 'java';
                // Note: Java requires valid class name matching filename. 
                // We rely on user or we might need a wrapper.
                // Assuming JDK 11+ single-file execution:
                args = [path.join(this.tempDir, fileName)];
                break;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }

        const filePath = path.join(this.tempDir, fileName);

        // 2. Write File
        fs.writeFileSync(filePath, content);

        // 3. Execute
        return new Promise((resolve) => {
            const logs: string[] = [];

            // Spawn Process
            const process = spawn(command, args, {
                shell: true,
                env, // Pass environment (Critical for Browsers!)
            });

            process.stdout.on('data', (data) => {
                logs.push(data.toString());
            });

            process.stderr.on('data', (data) => {
                // Some tools (Playwright) print info to stderr, distinguishing isn't always "Error"
                // But for now we log it.
                logs.push(`[Details] ${data.toString()}`);
            });

            process.on('close', (code) => {
                // Cleanup
                try {
                    // Delay cleanup slightly in case of file locks? No, standard unlink should be fine.
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (e) {
                    // ignore
                }

                resolve({
                    runId,
                    logs,
                    exitCode: code
                });
            });

            // Timeout safety (120 seconds for automation)
            const timeoutMs = 120000;
            const timeoutId = setTimeout(() => {
                try {
                    process.kill();
                    logs.push(`\n[System] Execution timed out (${timeoutMs / 1000}s limit).`);
                } catch (e) {
                    // process might be gone
                }
                resolve({ runId, logs, exitCode: -1 });
            }, timeoutMs);

            // Clear timeout if finished
            process.on('exit', () => clearTimeout(timeoutId));
        });
    }
}

export const codeExecutorService = new CodeExecutorService();

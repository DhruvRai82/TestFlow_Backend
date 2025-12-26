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

        // 1. Prepare File & Command
        switch (language) {
            case 'typescript':
                fileName = `${runId}.ts`;
                command = 'npx';
                // Use tsx for better compatibility/speed
                args = ['tsx', path.join(this.tempDir, fileName)];
                break;
            case 'python':
                fileName = `${runId}.py`;
                // Try python3, fallback to python might be needed in some envs
                command = 'python';
                args = [path.join(this.tempDir, fileName)];
                break;
            case 'java':
                // Java is tricky because class name must match filename.
                // We'll rename the class in code or use "Main"? 
                // Let's assume user writes a class inside? 
                // For simplicity, we save as Main.java and compile.
                // But concurrency issues if multiple runs.
                // For v1, let's skip Java or treat as "Single File Execution"
                fileName = `Main_${runId.replace(/-/g, '')}.java`;
                const className = fileName.replace('.java', '');

                // Hack: Replace "public class X" with "public class Main_uuid" ??
                // Or just tell user "Please name your class Main"?
                // Let's try to just run it via `java` (single file source code program in Java 11+)
                // `java Main.java` works in modern Java.
                command = 'java';
                args = [path.join(this.tempDir, fileName)];
                break;
            default:
                throw new Error(`Unsupported language: ${language}`);
        }

        const filePath = path.join(this.tempDir, fileName);

        // 2. Write File
        // For java, we might need to patch the class name if we want to be smart, 
        // but for now let's trust the user or rely on java 11 single-file mode.
        fs.writeFileSync(filePath, content);

        // 3. Execute
        return new Promise((resolve) => {
            const logs: string[] = [];

            // Spawn Process
            // Shell: true helps with path resolution (e.g. npx)
            const process = spawn(command, args, { shell: true });

            process.stdout.on('data', (data) => {
                logs.push(data.toString());
            });

            process.stderr.on('data', (data) => {
                logs.push(`[Error] ${data.toString()}`);
            });

            process.on('close', (code) => {
                // Cleanup
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (e) {
                    console.error('Cleanup error', e);
                }

                resolve({
                    runId,
                    logs,
                    exitCode: code
                });
            });

            // Timeout safety (10 seconds)
            setTimeout(() => {
                process.kill();
                logs.push('\n[System] Execution timed out (10s limit).');
                resolve({ runId, logs, exitCode: -1 });
            }, 10000);
        });
    }
}

export const codeExecutorService = new CodeExecutorService();


import { chromium, Browser, Page } from 'playwright';
import { supabase } from '../lib/supabase';

// DB Interfaces
interface TestRun {
    id: string;
    project_id: string;
    script_id: string;
    status: 'pending' | 'running' | 'passed' | 'failed' | 'error';
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
    trigger_source?: string;
    error_message?: string;
}

interface TestLog {
    run_id: string;
    step_index: number;
    action: string;
    status: 'pass' | 'fail' | 'info' | 'warning';
    message: string;
    timestamp: string;
}

export class TestRunnerService {

    /**
     * Executes a recorded script by ID and logs everything to keys tables.
     */
    async executeTest(scriptId: string, projectId: string, triggerSource: 'manual' | 'scheduler' | 'ci' = 'manual'): Promise<any> {
        let browser: Browser | null = null;
        let page: Page | null = null;
        let runId: string = '';
        const startTime = Date.now();

        try {
            // 1. Fetch Script Data
            const { data: script, error: scriptError } = await supabase
                .from('recorded_scripts')
                .select('*')
                .eq('id', scriptId)
                .single();

            if (scriptError || !script) throw new Error(`Script not found: ${scriptError?.message}`);

            // 2. Initialize Run Record
            const { data: runData, error: runError } = await supabase
                .from('test_runs')
                .insert({
                    project_id: projectId,
                    script_id: scriptId,
                    status: 'running',
                    started_at: new Date().toISOString(),
                    trigger_source: triggerSource
                })
                .select()
                .single();

            if (runError) throw new Error(`Failed to create run record: ${runError.message}`);
            runId = runData.id;

            // 3. Launch Browser
            console.log(`[TestRunner] Starting Run ${runId} for Script ${script.name}`);
            browser = await chromium.launch({
                headless: process.env.HEADLESS !== 'false',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const context = await browser.newContext();
            page = await context.newPage();

            // 4. Log Start
            await this.logStep(runId, 0, 'start', 'info', `Starting execution of ${script.name}`);

            // 5. Execute Steps
            // Assuming script.steps is the array of steps stored in JSON
            const steps = script.steps || [];

            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                const target = this.parseSelector(step.target);

                await this.logStep(runId, i + 1, step.command, 'info', `Executing: ${step.command} on ${step.target}`);

                try {
                    if (step.command === 'open') {
                        await page.goto(step.target, { timeout: 30000 });
                    }
                    else if (step.command === 'click') {
                        await page.click(target, { timeout: 10000 });
                    }
                    else if (step.command === 'type') {
                        try {
                            await page.fill(target, step.value || '', { timeout: 5000 });
                        } catch (fillError: any) {
                            // Fallback for Checkboxes/Radios which throw "cannot be filled"
                            if (fillError.message.includes('cannot be filled')) {
                                console.log('[TestRunner] Input cannot be filled, attempting check/click...');
                                // If value implies checked
                                if (step.value === 'on' || step.value === 'true') {
                                    await page.check(target, { timeout: 5000 });
                                } else {
                                    await page.click(target, { timeout: 5000 });
                                }
                            } else {
                                throw fillError;
                            }
                        }
                    }
                    else if (step.command === 'wait') {
                        await page.waitForTimeout(parseInt(step.value) || 1000);
                    }
                    // Add more commands (assert, etc.) here as needed

                    await this.logStep(runId, i + 1, step.command, 'pass', `Step ${i + 1} passed`);
                } catch (stepError: any) {
                    console.error(`[TestRunner] Step ${i + 1} failed:`, stepError.message);
                    await this.logStep(runId, i + 1, step.command, 'fail', `Failed: ${stepError.message}`);
                    throw stepError; // Re-throw to catch block to fail the run
                }
            }

            // 6. Success Completion
            const duration = Date.now() - startTime;
            await supabase
                .from('test_runs')
                .update({
                    status: 'passed',
                    completed_at: new Date().toISOString(),
                    duration_ms: duration
                })
                .eq('id', runId);

            await this.logStep(runId, 999, 'end', 'info', 'Test completed successfully');

            return { status: 'passed', runId, duration };

        } catch (error: any) {
            console.error('[TestRunner] Run Failed:', error);

            // 7. Failure Completion
            if (runId) {
                const duration = Date.now() - startTime;
                await supabase
                    .from('test_runs')
                    .update({
                        status: 'failed',
                        completed_at: new Date().toISOString(),
                        duration_ms: duration,
                        error_message: error.message
                    })
                    .eq('id', runId);
            }
            return { status: 'failed', error: error.message, runId };
        } finally {
            if (browser) await browser.close();
        }
    }

    private async logStep(runId: string, index: number, action: string, status: 'pass' | 'fail' | 'info' | 'warning', message: string) {
        try {
            await supabase.from('test_logs').insert({
                run_id: runId,
                step_index: index,
                action,
                status,
                message,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            console.error('[TestRunner] Failed to log step:', err);
        }
    }

    private parseSelector(rawTarget: string): string {
        // Handle target formats like "css=.class" or "id=foo" or just "xpath=..."
        if (!rawTarget) return '';

        if (rawTarget.startsWith('css=')) return rawTarget.replace('css=', '');
        if (rawTarget.startsWith('id=')) return `#${rawTarget.replace('id=', '')}`;
        if (rawTarget.startsWith('xpath=')) return rawTarget.replace('xpath=', '');

        // Return as is if no prefix (playwright tries to auto-detect)
        return rawTarget;
    }
}

export const testRunnerService = new TestRunnerService();

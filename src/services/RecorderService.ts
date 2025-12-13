/// <reference lib="dom" />
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { Server } from 'socket.io';
import { ReportService } from './ReportService';
import { supabase } from '../lib/supabase';

interface RecordedStep {
    command: string;
    target: string;
    targets: string[][]; // Array of [selector, type] tuples
    value: string;
}

interface RecordedScript {
    id: string;
    projectId: string;
    name: string;
    module: string;
    steps: RecordedStep[];
    createdAt: string;
}

export class RecorderService {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private isRecording = false;
    private recordedSteps: RecordedStep[] = [];
    private io: Server | null = null;
    private reportService: ReportService;

    constructor() {
        this.reportService = new ReportService();
    }

    setSocket(io: Server) {
        this.io = io;
    }

    async startRecording(url: string) {
        try {
            console.log(`[Recorder] Starting recording for ${url}`);
            if (this.isRecording) {
                await this.stopRecording();
            }

            const headlessParam = process.env.HEADLESS !== 'false';
            console.log(`[Recorder] Launching browser (Headless: ${headlessParam}, Env: ${process.env.HEADLESS})...`);

            this.browser = await chromium.launch({
                headless: headlessParam,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.context = await this.browser.newContext();
            this.page = await this.context.newPage();
            this.isRecording = true;
            this.recordedSteps = [];

            // Add initial open command
            const initialStep: RecordedStep = {
                command: 'open',
                target: url,
                targets: [],
                value: ''
            };
            this.recordedSteps.push(initialStep);

            // Emit 'record:step' to match frontend listener
            console.log('[Recorder] Emitting initial step:', initialStep);
            this.io?.emit('record:step', {
                action: 'navigate',
                url: url,
                timestamp: Date.now()
            });

            // Expose function to browser
            await this.page.exposeFunction('recordEvent', (event: any) => {
                console.log('[Recorder] Received event from browser:', event);
                if (this.isRecording) {
                    this.recordedSteps.push({
                        command: event.command,
                        target: event.target,
                        targets: event.targets || [],
                        value: event.value
                    });

                    // Emit 'record:step' to match frontend listener
                    this.io?.emit('record:step', {
                        action: event.command === 'type' ? 'type' : 'click',
                        selector: event.target,
                        value: event.value,
                        timestamp: Date.now()
                    });
                }
            });

            await this.page.addInitScript(() => {
                console.log('[Browser] Init script injected');

                const getSelectors = (el: HTMLElement): string[][] => {
                    const targets: string[][] = [];

                    // 1. ID
                    if (el.id) {
                        targets.push([`id=${el.id}`, 'id']);
                        targets.push([`css=#${el.id}`, 'css:finder']);
                        targets.push([`xpath=//*[@id='${el.id}']`, 'xpath:attributes']);
                    }

                    // 2. Name
                    const name = el.getAttribute('name');
                    if (name) {
                        targets.push([`name=${name}`, 'name']);
                        targets.push([`css=${el.tagName.toLowerCase()}[name="${name}"]`, 'css:finder']);
                        targets.push([`xpath=//${el.tagName.toLowerCase()}[@name='${name}']`, 'xpath:attributes']);
                    }

                    // 3. Link Text (for anchors)
                    if (el.tagName === 'A') {
                        const text = el.innerText?.trim();
                        if (text) {
                            targets.push([`linkText=${text}`, 'linkText']);
                            targets.push([`xpath=//a[contains(text(),'${text}')]`, 'xpath:link']);
                        }
                    }

                    // 4. CSS Classes
                    if (el.className && typeof el.className === 'string' && el.className.trim() !== '') {
                        const classes = el.className.split(/\s+/).filter(c => c && !c.includes(':') && !c.includes('/'));
                        if (classes.length > 0) {
                            const cssSelector = `${el.tagName.toLowerCase()}.${classes.join('.')}`;
                            targets.push([`css=${cssSelector}`, 'css:finder']);
                        }
                    }

                    // 5. XPath (Relative/Position)
                    const getXPath = (element: HTMLElement): string => {
                        if (element.id) return `//*[@id='${element.id}']`;
                        if (element === document.body) return '/html/body';

                        let ix = 0;
                        const siblings = element.parentNode?.childNodes;
                        if (siblings) {
                            for (let i = 0; i < siblings.length; i++) {
                                const sibling = siblings[i] as HTMLElement;
                                if (sibling === element) {
                                    const path = getXPath(element.parentNode as HTMLElement);
                                    return `${path}/${element.tagName.toLowerCase()}${ix + 1 > 1 ? `[${ix + 1}]` : ''}`;
                                }
                                if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                                    ix++;
                                }
                            }
                        }
                        return '';
                    };

                    const fullXpath = getXPath(el);
                    if (fullXpath) {
                        targets.push([`xpath=${fullXpath}`, 'xpath:position']);
                    }

                    // 6. Text Content (Button/Span/Div)
                    if (['BUTTON', 'SPAN', 'DIV', 'LABEL'].includes(el.tagName)) {
                        const text = el.innerText?.trim();
                        if (text && text.length < 50 && text.length > 0) {
                            targets.push([`xpath=//${el.tagName.toLowerCase()}[contains(.,'${text}')]`, 'xpath:innerText']);
                        }
                    }

                    return targets;
                };

                document.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

                    console.log('[Browser] Click detected on:', target);
                    const targets = getSelectors(target);
                    (window as any).recordEvent({
                        command: 'click',
                        target: targets.length > 0 ? targets[0][0] : target.tagName.toLowerCase(),
                        targets: targets,
                        value: ''
                    });
                }, true);

                document.addEventListener('change', (e) => {
                    const target = e.target as HTMLInputElement;
                    if (['INPUT', 'TEXTAREA'].includes(target.tagName)) {
                        console.log('[Browser] Change detected on:', target);
                        const targets = getSelectors(target);
                        (window as any).recordEvent({
                            command: 'type',
                            target: targets.length > 0 ? targets[0][0] : target.tagName.toLowerCase(),
                            targets: targets,
                            value: target.value
                        });
                    }
                }, true);
            });

            await this.page.goto(url);
            console.log('[Recorder] Recording started successfully');
        } catch (error) {
            console.error('[Recorder] Error starting recording:', error);
            throw error;
        }
    }

    async stopRecording() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.context = null;
            this.page = null;
        }
        this.isRecording = false;
        return this.recordedSteps;
    }

    async saveScript(script: Omit<RecordedScript, 'id' | 'createdAt'> & { userId: string }) {
        // Map frontend step format (action/selector) to backend format (command/target)
        const mappedSteps = script.steps.map((step: any) => {
            let command = step.command;
            let target = step.target;
            let targets = step.targets || [];
            let value = step.value || '';

            // Handle frontend format
            if (step.action) {
                if (step.action === 'navigate') {
                    command = 'open';
                    target = step.url;
                } else {
                    command = step.action; // click, type
                    target = step.selector;
                }
            }

            return {
                command: command || 'unknown',
                target: target || '',
                targets: targets,
                value: value
            };
        });

        const newScript = {
            id: Date.now().toString(),
            project_id: script.projectId,
            name: script.name,
            module: script.module,
            steps: mappedSteps,
            created_at: new Date().toISOString(),
            user_id: script.userId
        };

        const { data, error } = await supabase
            .from('recorded_scripts')
            .insert(newScript)
            .select()
            .single();

        if (error) {
            console.error('Error saving script:', error);
            throw error;
        }

        // Map back to frontend format
        return {
            id: data.id,
            projectId: data.project_id,
            name: data.name,
            module: data.module,
            steps: data.steps,
            createdAt: data.created_at,
            userId: data.user_id
        };
    }

    async deleteScript(scriptId: string, userId?: string) {
        let query = supabase
            .from('recorded_scripts')
            .delete()
            .eq('id', scriptId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { error } = await query;

        if (error) {
            console.error('Error deleting script:', error);
            throw error;
        }
        return { status: 'deleted' };
    }

    async getScripts(projectId?: string, userId?: string) {
        let query = supabase
            .from('recorded_scripts')
            .select('*')
            .order('created_at', { ascending: false });

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error reading scripts:', error);
            return [];
        }

        return data.map((s: any) => ({
            id: s.id,
            projectId: s.project_id,
            name: s.name,
            module: s.module,
            steps: s.steps,
            createdAt: s.created_at,
            userId: s.user_id
        }));
    }

    async playScript(scriptId: string, userId?: string) {
        let query = supabase.from('recorded_scripts').select('*').eq('id', scriptId);
        if (userId) query = query.eq('user_id', userId);

        const { data: scriptData, error } = await query.single();

        if (error || !scriptData) throw new Error('Script not found or access denied');

        const script = {
            id: scriptData.id,
            projectId: scriptData.project_id,
            name: scriptData.name,
            module: scriptData.module,
            steps: scriptData.steps,
            createdAt: scriptData.created_at,
            userId: scriptData.user_id
        };

        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== 'false',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const context = await browser.newContext();
        const page = await context.newPage();

        const startTime = Date.now();
        let stepsCompleted = 0;

        try {
            for (let i = 0; i < script.steps.length; i++) {
                const step = script.steps[i];
                let target = step.target;
                if (target.startsWith('css=')) target = target.replace('css=', '');
                if (target.startsWith('id=')) target = `#${target.replace('id=', '')}`;
                if (target.startsWith('xpath=')) target = target.replace('xpath=', '');

                if (step.target.includes('=')) {
                    target = step.target;
                }

                console.log(`[Recorder] Executing: ${step.command} on ${target}`);

                this.io?.emit('recorder:step:start', { index: i, step });

                try {
                    if (step.command === 'open') {
                        await page.goto(step.target);
                    } else if (step.command === 'click') {
                        await page.click(target);
                    } else if (step.command === 'type') {
                        await page.fill(target, step.value);
                    }

                    this.io?.emit('recorder:step:success', { index: i });
                    stepsCompleted++;
                } catch (stepError: any) {
                    this.io?.emit('recorder:step:error', { index: i, error: stepError.message });
                    throw stepError;
                }
            }

            console.log('[Recorder] Script finished successfully');
            await browser.close();

            await this.reportService.addReport({
                scriptId: script.id,
                projectId: script.projectId,
                scriptName: script.name,
                module: script.module,
                status: 'pass',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                stepsCompleted,
                totalSteps: script.steps.length,
                userId: script.userId
            });

            return { status: 'pass' };
        } catch (err: any) {
            console.error('[Recorder] Script failed:', err);
            await browser.close();

            await this.reportService.addReport({
                scriptId: script.id,
                projectId: script.projectId,
                scriptName: script.name,
                module: script.module,
                status: 'fail',
                startTime: new Date(startTime).toISOString(),
                endTime: new Date().toISOString(),
                duration: Date.now() - startTime,
                error: err.message,
                stepsCompleted,
                totalSteps: script.steps.length,
                userId: script.userId
            });

            return { status: 'fail', error: err.message };
        }
    }

    async exportScript(scriptId: string, format: 'side' | 'java' | 'python', userId?: string) {
        const scripts = await this.getScripts(undefined, userId);
        const script = scripts.find(s => s.id === scriptId);
        if (!script) throw new Error('Script not found');

        if (format === 'side') {
            return {
                id: script.id,
                version: "2.0",
                name: script.name,
                url: script.steps.find((s: any) => s.command === 'open')?.target || "",
                tests: [{
                    id: script.id,
                    name: script.name,
                    commands: script.steps.map((s: any) => ({
                        id: Date.now().toString(), // Dummy ID
                        comment: "",
                        command: s.command,
                        target: s.target,
                        targets: s.targets || [],
                        value: s.value
                    }))
                }],
                suites: [{
                    id: Date.now().toString(),
                    name: "Default Suite",
                    persistSession: false,
                    parallel: false,
                    timeout: 300,
                    tests: [script.id]
                }],
                urls: [script.steps.find((s: any) => s.command === 'open')?.target || ""],
                plugins: []
            };
        } else if (format === 'java') {
            let code = `import org.junit.Test;\nimport org.junit.Before;\nimport org.junit.After;\nimport static org.junit.Assert.*;\nimport static org.hamcrest.CoreMatchers.is;\nimport static org.hamcrest.core.IsNot.not;\nimport org.openqa.selenium.By;\nimport org.openqa.selenium.WebDriver;\nimport org.openqa.selenium.firefox.FirefoxDriver;\nimport org.openqa.selenium.chrome.ChromeDriver;\nimport org.openqa.selenium.remote.RemoteWebDriver;\nimport org.openqa.selenium.remote.DesiredCapabilities;\nimport org.openqa.selenium.Dimension;\nimport org.openqa.selenium.WebElement;\nimport org.openqa.selenium.interactions.Actions;\nimport org.openqa.selenium.support.ui.ExpectedConditions;\nimport org.openqa.selenium.support.ui.WebDriverWait;\nimport org.openqa.selenium.JavascriptExecutor;\nimport org.openqa.selenium.Alert;\nimport org.openqa.selenium.Keys;\nimport java.util.*;\nimport java.net.MalformedURLException;\nimport java.net.URL;\n\npublic class ${script.name.replace(/[^a-zA-Z0-9]/g, '')}Test {\n  private WebDriver driver;\n  private Map<String, Object> vars;\n  JavascriptExecutor js;\n\n  @Before\n  public void setUp() {\n    driver = new ChromeDriver();\n    js = (JavascriptExecutor) driver;\n    vars = new HashMap<String, Object>();\n  }\n\n  @After\n  public void tearDown() {\n    driver.quit();\n  }\n\n  @Test\n  public void ${script.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}() {\n`;

            for (const step of script.steps) {
                if (step.command === 'open') {
                    code += `    driver.get("${step.target}");\n`;
                } else if (step.command === 'click') {
                    let selector = step.target;
                    if (selector.startsWith('id=')) selector = `By.id("${selector.replace('id=', '')}")`;
                    else if (selector.startsWith('name=')) selector = `By.name("${selector.replace('name=', '')}")`;
                    else if (selector.startsWith('css=')) selector = `By.cssSelector("${selector.replace('css=', '').replace(/"/g, '\\"')}")`;
                    else if (selector.startsWith('xpath=')) selector = `By.xpath("${selector.replace('xpath=', '').replace(/"/g, '\\"')}")`;
                    else selector = `By.cssSelector("${selector.replace(/"/g, '\\"')}")`;

                    code += `    driver.findElement(${selector}).click();\n`;
                } else if (step.command === 'type') {
                    let selector = step.target;
                    if (selector.startsWith('id=')) selector = `By.id("${selector.replace('id=', '')}")`;
                    else if (selector.startsWith('name=')) selector = `By.name("${selector.replace('name=', '')}")`;
                    else if (selector.startsWith('css=')) selector = `By.cssSelector("${selector.replace('css=', '').replace(/"/g, '\\"')}")`;
                    else if (selector.startsWith('xpath=')) selector = `By.xpath("${selector.replace('xpath=', '').replace(/"/g, '\\"')}")`;
                    else selector = `By.cssSelector("${selector.replace(/"/g, '\\"')}")`;

                    code += `    driver.findElement(${selector}).sendKeys("${step.value}");\n`;
                }
            }
            code += `  }\n}\n`;
            return code;
        } else if (format === 'python') {
            let code = `import pytest\nimport time\nimport json\nfrom selenium import webdriver\nfrom selenium.webdriver.common.by import By\nfrom selenium.webdriver.common.action_chains import ActionChains\nfrom selenium.webdriver.support import expected_conditions\nfrom selenium.webdriver.support.wait import WebDriverWait\nfrom selenium.webdriver.common.keys import Keys\nfrom selenium.webdriver.common.desired_capabilities import DesiredCapabilities\n\nclass Test${script.name.replace(/[^a-zA-Z0-9]/g, '')}():\n  def setup_method(self, method):\n    self.driver = webdriver.Chrome()\n    self.vars = {}\n  \n  def teardown_method(self, method):\n    self.driver.quit()\n  \n  def test_${script.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}(self):\n`;

            for (const step of script.steps) {
                if (step.command === 'open') {
                    code += `    self.driver.get("${step.target}")\n`;
                } else if (step.command === 'click') {
                    let selector = step.target;
                    let by = "By.CSS_SELECTOR";
                    let val = selector;

                    if (selector.startsWith('id=')) { by = "By.ID"; val = selector.replace('id=', ''); }
                    else if (selector.startsWith('name=')) { by = "By.NAME"; val = selector.replace('name=', ''); }
                    else if (selector.startsWith('css=')) { by = "By.CSS_SELECTOR"; val = selector.replace('css=', ''); }
                    else if (selector.startsWith('xpath=')) { by = "By.XPATH"; val = selector.replace('xpath=', ''); }

                    code += `    self.driver.find_element(${by}, "${val.replace(/"/g, '\\"')}").click()\n`;
                } else if (step.command === 'type') {
                    let selector = step.target;
                    let by = "By.CSS_SELECTOR";
                    let val = selector;

                    if (selector.startsWith('id=')) { by = "By.ID"; val = selector.replace('id=', ''); }
                    else if (selector.startsWith('name=')) { by = "By.NAME"; val = selector.replace('name=', ''); }
                    else if (selector.startsWith('css=')) { by = "By.CSS_SELECTOR"; val = selector.replace('css=', ''); }
                    else if (selector.startsWith('xpath=')) { by = "By.XPATH"; val = selector.replace('xpath=', ''); }

                    code += `    self.driver.find_element(${by}, "${val.replace(/"/g, '\\"')}").send_keys("${step.value}")\n`;
                }
            }
            return code;
        }
    }
    async getReports(projectId?: string, userId?: string) {
        return this.reportService.getReports(projectId, userId);
    }

    async deleteReport(id: string, userId?: string) {
        return this.reportService.deleteReport(id, userId);
    }
}

export const recorderService = new RecorderService();

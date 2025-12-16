import cron from 'node-cron';
import { supabase } from '../lib/supabase';
import { recorderService } from './RecorderService';

interface Schedule {
    id: string;
    script_id: string;
    cron_expression: string;
    user_id: string;
    is_active: boolean;
}

export class SchedulerService {
    private tasks: Map<string, cron.ScheduledTask> = new Map();

    constructor() {
        // init called explicitly
    }

    async init() {
        // Load active schedules from DB
        console.log('[Scheduler] Initializing schedules...');
        const { data, error } = await supabase
            .from('schedules')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('[Scheduler] Failed to load schedules:', error);
            return;
        }

        if (data) {
            data.forEach((schedule: Schedule) => {
                this.scheduleJob(schedule);
            });
            console.log(`[Scheduler] Loaded ${data.length} active schedules.`);
        }
    }

    private scheduleJob(schedule: Schedule) {
        // Stop existing if any (update case)
        if (this.tasks.has(schedule.id)) {
            this.tasks.get(schedule.id)?.stop();
        }

        if (!cron.validate(schedule.cron_expression)) {
            console.error(`[Scheduler] Invalid Cron: ${schedule.cron_expression} for ID ${schedule.id}`);
            return;
        }

        const task = cron.schedule(schedule.cron_expression, async () => {
            console.log(`[Scheduler] ⏰ Triggering scheduled script: ${schedule.script_id}`);
            try {
                await recorderService.playScript(schedule.script_id, schedule.user_id);
                console.log(`[Scheduler] ✅ Scheduled Run Complete: ${schedule.script_id}`);
            } catch (e) {
                console.error(`[Scheduler] ❌ Scheduled Run Failed: ${schedule.script_id}`, e);
            }
        });

        this.tasks.set(schedule.id, task);
    }

    async createSchedule(scriptId: string, cronExpression: string, userId: string) {
        const newSchedule = {
            id: Date.now().toString(),
            script_id: scriptId,
            cron_expression: cronExpression,
            user_id: userId,
            is_active: true,
            created_at: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('schedules')
            .insert(newSchedule)
            .select()
            .single();

        if (error) throw error;

        this.scheduleJob(data);
        return data;
    }

    async deleteSchedule(id: string) {
        // Stop task
        if (this.tasks.has(id)) {
            this.tasks.get(id)?.stop();
            this.tasks.delete(id);
        }

        const { error } = await supabase
            .from('schedules')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return { status: 'deleted' };
    }

    async listSchedules(userId: string) {
        const { data, error } = await supabase
            .from('schedules')
            .select(`
                *,
                recorded_scripts (name, module)
            `)
            .eq('user_id', userId);

        if (error) throw error;

        // Flatten structure for easier consumption
        return data.map(s => ({
            id: s.id,
            scriptId: s.script_id,
            scriptName: s.recorded_scripts?.name || 'Unknown Script',
            cronExpression: s.cron_expression,
            isActive: s.is_active,
            createdAt: s.created_at
        }));
    }
}

export const schedulerService = new SchedulerService();

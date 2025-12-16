import { supabase } from '../lib/supabase';

export interface ExecutionReport {
    id: string;
    projectId: string;
    scriptId?: string;
    scriptName: string;
    module?: string;
    status: 'pass' | 'fail';
    startTime: string;
    endTime: string;
    duration: number; // in milliseconds
    error?: string;
    stepsCompleted: number;
    totalSteps: number;
    userId?: string;
    logs?: string;
}

export class ReportService {
    async addReport(report: Omit<ExecutionReport, 'id'>) {
        const newReport = {
            id: Date.now().toString(),
            project_id: report.projectId,
            script_id: report.scriptId,
            script_name: report.scriptName,
            module: report.module,
            status: report.status,
            start_time: report.startTime,
            end_time: report.endTime,
            duration: report.duration,
            error: report.error,
            steps_completed: report.stepsCompleted,
            total_steps: report.totalSteps,
            user_id: report.userId,
            logs: report.logs
        };

        const { data, error } = await supabase
            .from('execution_reports')
            .insert(newReport)
            .select()
            .single();

        if (error) {
            console.error('Error saving report:', error);
            throw error;
        }

        return data;
    }

    async getReports(projectId?: string, userId?: string) {
        let query = supabase
            .from('execution_reports')
            .select('*')
            .order('start_time', { ascending: false });

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error reading reports:', error);
            return [];
        }

        return data.map((r: any) => ({
            id: r.id,
            projectId: r.project_id,
            scriptId: r.script_id,
            scriptName: r.script_name,
            module: r.module,
            status: r.status,
            startTime: r.start_time,
            endTime: r.end_time,
            duration: r.duration,
            error: r.error,
            stepsCompleted: r.steps_completed,
            totalSteps: r.total_steps,
            userId: r.user_id
        }));
    }

    async deleteReport(id: string, userId?: string) {
        let query = supabase
            .from('execution_reports')
            .delete()
            .eq('id', id);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { error } = await query;

        if (error) {
            console.error('Error deleting report:', error);
            throw error;
        }
        return { status: 'deleted' };
    }
}

export const reportService = new ReportService();

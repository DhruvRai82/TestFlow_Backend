
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const url = process.env.SUPABASE_URL;

console.log('--- CORRECT SUPABASE URL ---');
console.log(url);
console.log('----------------------------');

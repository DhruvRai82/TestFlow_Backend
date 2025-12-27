import express from 'express';
import { supabase } from '../lib/supabase';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[Auth] Login attempt for: ${email}`);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('[Auth] Login Error:', error.message);
            return res.status(401).json({ message: error.message });
        }

        console.log(`[Auth] Login successful for: ${email}`);
        res.json({
            message: 'Login successful',
            data: { user: data.user, session: data.session },
        });
    } catch (error) {
        console.error('[Auth] Unexpected Login Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(`[Auth] Registration attempt for: ${email}`);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            console.error('[Auth] Registration Error:', error.message);
            return res.status(400).json({ message: error.message });
        }

        console.log(`[Auth] Registration successful for: ${email}`);
        res.json({
            user: data.user,
            session: data.session,
        });
    } catch (error) {
        console.error('[Auth] Unexpected Registration Error:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

export const authRouter = router;

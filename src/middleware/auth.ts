import { Request, Response, NextFunction } from 'express';

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        const userIdHeader = req.headers['x-user-id'];

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            // Allow public access to health check or specific routes if needed
            // But for protected routes, fail.
            // For now, if no token, check if we have x-user-id as fallback (dev mode)
            if (userIdHeader) {
                (req as any).user = { uid: userIdHeader };
                return next();
            }
            return res.status(401).json({ error: 'Unauthorized: No token provided' });
        }

        const token = authHeader.split('Bearer ')[1];

        // TODO: In production, verify token with firebase-admin
        // const decodedToken = await admin.auth().verifyIdToken(token);
        // (req as any).user = decodedToken;

        // MOCK VERIFICATION (Unblocks Development)
        // We trust the token is present and valid for dev environment
        // In realprod, you MUST use firebase-admin
        if (token) {
            (req as any).user = {
                uid: userIdHeader || 'test-user-id',
                email: 'test@example.com'
            };
            next();
        } else {
            throw new Error('Invalid token');
        }

    } catch (error) {
        console.error('Auth Error:', error);
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

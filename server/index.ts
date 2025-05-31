import dotenv from 'dotenv';
dotenv.config();

// --- REMOVE OR COMMENT OUT Drizzle/Neon-related imports ---
// import { db } from "./db"; // This is your old Drizzle DB connection
// console.log("DATABASE_URL:", process.env.DATABASE_URL); // This line can be removed as well

import express, { type Request, Response, NextFunction } from "express";
// Corrected path to routes.ts: it's directly in 'server/'
import { registerRoutes } from "./routes"; // <--- NO CHANGE HERE, still './routes' as it's in the same directory
import { setupVite, serveStatic, log } from "./vite";

// --- NEW: Import your Firestore setup ---
// Path to FirestoreStorage.ts is relative to server/index.ts
import { FirestoreStorage } from './FirestoreStorage';
import { IStorage } from './storage';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
        capturedJsonResponse = bodyJson;
        return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
        const duration = Date.now() - start;
        if (path.startsWith("/api")) {
            let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
            if (capturedJsonResponse) {
                logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
            }

            if (logLine.length > 80) {
                logLine = logLine.slice(0, 79) + "…";
            }

            log(logLine);
        }
    });

    next();
});

(async () => {
    // --- NEW: Instantiate FirestoreStorage ---
    const storage: IStorage = new FirestoreStorage();
    log("Initialized FirestoreStorage.");

    // --- Modify registerRoutes to accept the storage instance ---
    const server = await registerRoutes(app, storage); // <<< Pass storage here

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";

        res.status(status).json({ message });
        throw err;
    });

    if (app.get("env") === "development") {
        await setupVite(app, server);
    } else {
        serveStatic(app);
    }

    const port = 5000;
    server.listen(port, "127.0.0.1", () => {
        log(`serving on port ${port}`);
    });
})();
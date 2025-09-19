import { Router } from "express";
import { syncUserWithDb } from "../controller/auth.controller.js";
const router = Router();

router.post("/sync", syncUserWithDb);

export default router;

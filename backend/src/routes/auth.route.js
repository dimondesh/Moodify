import { Router } from "express";
import {
  checkEmailExists,
  syncUserWithDb,
} from "../controller/auth.controller.js";
const router = Router();

router.post("/sync", syncUserWithDb);
router.post("/check-email", checkEmailExists);

export default router;

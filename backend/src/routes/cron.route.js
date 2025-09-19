import { Router } from "express";
import { cronJobController } from "../controller/cronjob.controller.js";
const router = Router();

router.get("/", cronJobController);

export default router;

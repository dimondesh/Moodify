import express from "express";
import { getDailyMixes, getMixById } from "../controller/mix.controller.js";
import { identifyUser } from "../middleware/identifyUser.middleware.js";

const router = express.Router();

router.get("/", identifyUser, getDailyMixes);
router.get("/:id", getMixById);

export default router;

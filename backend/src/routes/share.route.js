import { Router } from "express";
import { getSharedEntity } from "../controller/share.controller.js";

const router = Router();

router.get("/:entityType/:entityId", getSharedEntity);

export default router;

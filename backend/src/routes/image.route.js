// backend/src/routes/image.route.js
import { Router } from "express";
import { optimizeExistingImages } from "../controller/image.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/optimize-existing", protectRoute, optimizeExistingImages);

export default router;

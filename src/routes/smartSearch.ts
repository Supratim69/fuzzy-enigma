import express from "express";
import { postSmartSearch } from "../controllers/smartSearchController.js";
const router = express.Router();

router.post("/smart-search", postSmartSearch);

export default router;

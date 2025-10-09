import express from "express";
import { postSearch } from "../controllers/searchController.js";
const router = express.Router();

router.post("/search", postSearch);

export default router;

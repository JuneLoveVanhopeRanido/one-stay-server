const express = require("express");
const router = express.Router();
const favoriteController = require("./favorite-controller");
const { authMiddleware } = require("../../middleware/auth");

// Add to favorites
router.post("/add", authMiddleware, favoriteController.addFavorite);

// Remove from favorites
router.post("/remove", authMiddleware, favoriteController.removeFavorite);

// Check if resort is favorite
router.get("/isFavorite/:resortId", authMiddleware, favoriteController.isFavorite);

// Get all favorites of current user
router.get("/user/:user", authMiddleware, favoriteController.getMyFavorites);

module.exports = router;

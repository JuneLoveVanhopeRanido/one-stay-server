const User = require("../../models/user-model");
const Resort = require("../../models/resort-model"); // make sure you have this

/** Add resort to favorites */
exports.addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resortId } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!user.favorites.includes(resortId)) {
      user.favorites.push(resortId);
      await user.save();
    }

    res.json({ isFavorite: true });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


/** Remove resort from favorites */
exports.removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { resortId } = req.body;

    const user = await User.findById(userId);

    user.favorites = user.favorites.filter(
      (id) => id.toString() !== resortId
    );

    await user.save();

    res.json({ isFavorite: false });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};


/** Check if resort is favorite */
exports.isFavorite = async (req, res) => {
  const userId = req.user._id;
  const { resortId } = req.params;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isFavorite = user.favorites.includes(resortId);
    res.status(200).json({ isFavorite });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/** Get all favorites of current user */
exports.getMyFavorites = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userId = req.user._id;

    // First fetch user favorites
    const user = await User.findById(userId).populate({
      path: "favorites",
      model: "Resort",
      select: "id resort_name location image", 
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const favorites = user.favorites;

    // ⭐ Build enriched favorite resorts
    const enrichedFavorites = await Promise.all(
      favorites.map(async (resort) => {
        // --- GET FEEDBACKS ---
        const feedbacks = await Feedback.find({
          resort_id: resort.id,
          type: "customer_to_owner",
        });

        const averageRating =
          feedbacks.length > 0
            ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
            : 0;

        const reviewsCount = feedbacks.length;

        // --- GET LOWEST ROOM PRICE ---
        const rooms = await Room.find({
          resort_id: resort.id,
          deleted: false,
        })
          .sort({ price_per_night: 1 })
          .limit(1);

        const lowestPrice = rooms.length > 0 ? rooms[0].price_per_night : 0;

        // --- GET AVAILABLE ROOMS COUNT ---
        const availableRoomsCount = await Room.countDocuments({
          resort_id: resort.id,
          status: "available",
          deleted: false,
        });

        return {
          ...resort.toObject(),
          rating: parseFloat(averageRating.toFixed(2)),
          reviews: reviewsCount,
          price_per_night: lowestPrice,
          available_rooms: availableRoomsCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedFavorites.length,
      favorites: enrichedFavorites,
    });

  } catch (error) {
    console.error("Get favorites error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching favorites",
    });
  }
};

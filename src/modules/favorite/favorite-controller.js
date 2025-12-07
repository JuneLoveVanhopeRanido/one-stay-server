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
    const userId = req.user._id;

    const user = await User.findById(userId).populate({
      path: "favorites",
      model: "Resort",
      select: "_id resort_name location image deleted createdAt",
    });

    if (!user) return res.status(404).json({ message: "User not found" });

    const favorites = user.favorites;

    const enhancedFavorites = await Promise.all(
      favorites.map(async (resort) => {
        // ⭐ Get all feedback for rating
        const feedbacks = await Feedback.find({
          resort_id: resort._id,
          type: "customer_to_owner",
        });

        const averageRating =
          feedbacks.length > 0
            ? feedbacks.reduce((sum, f) => sum + f.rating, 0) /
              feedbacks.length
            : 0;

        // ⭐ Total reviews
        const reviewsCount = feedbacks.length;

        // ⭐ Get lowest room price
        const rooms = await Room.find({
          resort_id: resort._id,
          deleted: false,
        })
          .sort({ price_per_night: 1 })
          .limit(1);

        const lowestPrice = rooms.length > 0 ? rooms[0].price_per_night : 0;

        // ⭐ Available rooms
        const availableRoomsCount = await Room.countDocuments({
          resort_id: resort._id,
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

    // 🔥 Optional: sort favorites the same way featured resorts are sorted
    enhancedFavorites.sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.status(200).json(enhancedFavorites);
  } catch (err) {
    console.error("Get favorites error:", err);
    res.status(500).json({ message: "Server error." });
  }
};


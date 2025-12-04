const User = require("../../models/user-model");
const Resort = require("../../models/resort-model"); // make sure you have this

/** Add resort to favorites */
exports.addFavorite = async (req, res) => {
  const userId = req.user._id; // from authMiddleware
  const { resortId } = req.body;

  if (!resortId) return res.status(400).json({ message: "Resort ID is required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.favorites.includes(resortId)) {
      return res.status(200).json({ message: "Already in favorites" });
    }

    user.favorites.push(resortId);
    await user.save();

    res.status(201).json({ message: "Added to favorites" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/** Remove resort from favorites */
exports.removeFavorite = async (req, res) => {
  const userId = req.user._id;
  const { resortId } = req.body;

  if (!resortId) return res.status(400).json({ message: "Resort ID is required" });

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.favorites = user.favorites.filter(fav => fav.toString() !== resortId);
    await user.save();

    res.status(200).json({ message: "Removed from favorites" });
  } catch (err) {
    console.error(err);
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
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).populate({
      path: "favorites",
      select: "_id resort_name location image_url"
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.favorites);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

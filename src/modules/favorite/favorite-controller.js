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
  const userId = req.user._id;

  try {
    const user = await User.findById(userId).populate({
      path: "favorites",
      select: "_id resort_name location image"
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.favorites);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
	username: { type: String, required: true, unique: true },
	email: { type: String, required: true, unique: true },
	password: { type: String, required: true },
	role: { type: String, enum: ['customer', 'owner'], required: true },
	createdAt: { type: Date, default: Date.now },
	deleted: { type: Boolean, default: false },
	favorites: [
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Resort",
			default: []
		}
	],
});

module.exports = mongoose.model('User', userSchema);

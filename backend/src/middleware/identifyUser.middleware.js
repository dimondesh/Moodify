import { firebaseAdmin } from "../lib/firebase.js";
import { User } from "../models/user.model.js";

export const identifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return next();
    }

    const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
    const user = await User.findOne({ firebaseUid: decodedToken.uid }).lean();

    if (user) {
      req.user = {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
      };
    }
  } catch (error) {
    console.log(
      "IdentifyUser Middleware: Could not verify token, proceeding as guest.",
      error.message
    );
  }

  next();
};

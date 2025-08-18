import jwt from "jsonwebtoken";
import Errorhandler from "./ErrorHandling.js";
import UserModel from "../Modal/UserModel.js";

export const isUserLoggedin = async (req, res, next) => {
  const { token } = req.cookies;

  if (!token) {
    return next(new Errorhandler("Please login to access this page."));
  }

  const Decode = jwt.verify(token, process.env.JWT_SECRET);

  const user = await UserModel.findById(Decode.id);

  req.user = user;

  next();
};

export const isAuthenticated = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new Errorhandler("You are not authenticated", 401));
    }

    if (req.user.role !== role) {
      return next(
        new Errorhandler("Access denied , You are not authenticated", 403)
      );
    }

    next();
  };
};

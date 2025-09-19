import { Genre } from "../models/genre.model.js";

export const cronJobController = async (req, res, next) => {
  try {
    const genre = await Genre.findOne();

    if (!genre) {
      console.log("No genres found");
      return res.status(404).json({ message: "No genres found" });
    }

    console.log("cronjob succeeded:", genre.name);

    res.status(200).json(genre);
  } catch (error) {
    next(error);
  }
};

// scripts/migrateMixes.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Mix } from "../models/mix.model.js";
import { getTranslationsForKey } from "../lib/translations.js";

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected...");
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
};

const migrate = async () => {
  await connectDB();
  console.log("Connected to DB.");

  const mixes = await Mix.find({
    $or: [
      { searchableNames: { $exists: false } },
      { searchableNames: { $size: 0 } },
    ],
  });
  console.log(`Found ${mixes.length} mixes to migrate.`);
  let migratedCount = 0;

  for (const mix of mixes) {
    const searchableNames = getTranslationsForKey(mix.name);
    if (searchableNames.length > 0) {
      mix.searchableNames = searchableNames;
      await mix.save();
      migratedCount++;
      console.log(`Migrated "${mix.name}"`);
    } else {
      console.warn(`No translations found for key: "${mix.name}"`);
    }
  }

  console.log(`Migration complete. Updated ${migratedCount} mixes.`);
  mongoose.disconnect();
  process.exit(0);
};

migrate().catch((err) => {
  console.error(err);
  mongoose.disconnect();
  process.exit(1);
});

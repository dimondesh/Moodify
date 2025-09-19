import fs from 'fs/promises';

export const deleteTempFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
    console.log(`Temporary file deleted: ${filePath}`);
  } catch (error) {
    console.error(`Failed to delete temporary file: ${filePath}`, error);
  }
};
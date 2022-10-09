import { ddbmapper } from "./services/dynamodb";
import app from "./app";

const PORT = process.env.PORT || 3000;

// Bootstrapping
(async () => {
  try {
    ddbmapper.connect();
  } catch (error) {
    console.error("Failed to create dynamodb tables:", error);
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
})();

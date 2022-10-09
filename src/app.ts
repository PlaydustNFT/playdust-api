import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";

import swaggerUi from "swagger-ui-express";
import swaggerJSDoc from "swagger-jsdoc";

import passport from "./services/passport";
import routes from "./routes";

const app = express();
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Playdust Rest API",
      version: "1.0.0",
    },
  },
  apis: ["./src/routes/*.ts"],
});

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(passport.initialize());

// Swagger document UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rest API
app.use(routes);

export default app;

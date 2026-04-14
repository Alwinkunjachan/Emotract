import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import v1AuthRoutes from "./routes/v1/auth.js";
import v1MessageRoutes from "./routes/v1/messages.js";
import logger from "./middleware/logger.js";
import swaggerDocs from './config/swagger.js';
import dotenv from "dotenv";
import { setupSocket } from "./config/socket.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:5173",
    process.env.ADMIN_URL || "http://localhost:5174"
  ],
  credentials: true,
}));

app.use(express.json());

// Logger middleware
app.use(logger);

// Connect to MongoDB
connectDB();

app.get("/", (req, res) => {
  res.redirect("/api-docs");
});

// v1 API Routes
app.use("/api/v1/auth", v1AuthRoutes);
app.use("/api/v1/messages", v1MessageRoutes);

// Swagger Docs Route
swaggerDocs(app);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () =>
  console.log(`Server started on http://localhost:${PORT}`)
);

// initialize socket.io
setupSocket(server);

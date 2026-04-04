import serverless from "serverless-http";
import app from "../src/index.js";

export default serverless(app);

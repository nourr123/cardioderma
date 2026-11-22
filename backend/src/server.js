const dns = require("node:dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

require("dotenv").config();

const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();

  // Express + Socket.IO partagent le même serveur HTTP
  const server = http.createServer(app);
  const io = initSocket(server);
  app.set("io", io); // utilisé par les controllers pour notifier en temps réel

  server.listen(PORT, () => {
    console.log(`CardioDerma API running on port ${PORT}`);
  });
};

start();
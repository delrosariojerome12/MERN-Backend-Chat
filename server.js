const express = require("express");
const cors = require("cors");
const app = express();
const userRoutes = require("./routes/UserRoutes");
const User = require("./models/User");
const Message = require("./models/Message");

const rooms = [
  "general",
  "tech",
  "finance",
  "crypto",
  "gaming",
  "programming",
  "testing",
];

// get data form
app.use(express.urlencoded({extended: true}));

// parse data to json
app.use(express.json());
app.use(cors());
app.use("/users", userRoutes);

require(`./connection`);

const server = require("http").createServer(app);
// server port
const PORT = 5001;
// bridge between client and server
const io = require(`socket.io`)(server, {
  cors: {
    origin: `http://localhost:3000`,
    methods: [`GET`, `POST`],
  },
});

// socket
io.on("connection", (socket) => {
  socket.on("new-user", async () => {
    const members = await User.find();
    io.emit("new-user", members);
    console.log(members);
  });
  socket.on("join-room", async (newRoom, previousRoom) => {
    socket.join(newRoom);
    socket.leave(previousRoom);
    let roomMessages = await getLastMessagesFromRoom(newRoom);
    roomMessages = sortRoomsMessagesByDate(roomMessages);
    socket.emit("room-messages", roomMessages);
  });
  socket.on("message-room", async (room, content, sender, time, date) => {
    const newMessage = await Message.create({
      content,
      from: sender,
      time,
      date,
      to: room,
    });
    let roomMessages = await getLastMessagesFromRoom(room);
    roomMessages = sortRoomsMessagesByDate(roomMessages);
    // sending msg to room
    io.to(room).emit("room-messages", roomMessages);
    socket.broadcast.emit("notifications", room);
  });

  app.delete("/logout", async (req, res) => {
    try {
      const {_id, newMessages} = req.body;
      const user = await User.findById(_id);
      user.status = "offline";
      user.newMessages = newMessages;
      await user.save();
      const members = await User.find();
      console.log(user);
      socket.broadcast.emit("new-user", members);
      res.status(200).send();
    } catch (e) {
      console.log(e);
      res.status(400).send();
    }
  });
});

app.get("/rooms", (req, res) => {
  res.json(rooms);
});

const getLastMessagesFromRoom = async (room) => {
  let roomMessages = await Message.aggregate([
    {$match: {to: room}},
    {$group: {_id: `$date`, messagesByDate: {$push: `$$ROOT`}}},
  ]);
  return roomMessages;
};
const sortRoomsMessagesByDate = (messages) => {
  return messages.sort((a, b) => {
    let date1 = a._id.split("/");
    let date2 = b._id.split("/");

    date1 = date1[2] + date1[0] + date1[1];
    date2 = date2[2] + date2[0] + date2[1];
    return date1 < date2 ? -1 : 1;
  });
};

server.listen(PORT, () => {
  console.log("listen", PORT);
});

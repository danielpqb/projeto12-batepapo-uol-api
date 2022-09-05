import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import joi from "joi";
import dotenv from "dotenv";
dotenv.config();
import dayjs from "dayjs";

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
  db = mongoClient.db("bate_papo_uol");
});

const usersSchema = joi.object({
  name: joi.string().required(),
});

const messagesSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  if (usersSchema.validate({ name }, { abortEarly: true }).error) {
    res.status(422).send({ message: "Invalid username" });
    return;
  }

  try {
    //Does this participant name already exists?
    if (await db.collection("participants").findOne({ name: name })) {
      res.status(409).send({ message: "Duplicate participant name" });
      return;
    }

    const dateNow = Date.now();

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: dateNow });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(dateNow).format("HH:mm:ss"),
    });

    res.status(201).send("OK");
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get("/participants", async (req, res) => {
  try {
    res.status(200).send(await db.collection("participants").find().toArray());
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/messages", async (req, res) => {
  const from = req.headers.user;
  const { to, text, type } = req.body;

  if (
    messagesSchema.validate({ to, text, type }, { abortEarly: false }).error
  ) {
    res.status(422).send({ message: "Invalid message" });
    return;
  }

  const exists = await db.collection("participants").findOne({ name: from });

  if (!exists) {
    res.status(422).send({ message: "Participant not found" });
    return;
  }

  await db.collection("messages").insertOne({
    from: from,
    to: to,
    text: text,
    type: type,
    time: dayjs(Date.now()).format("HH:mm:ss"),
  });

  res.status(201).send("OK");
});

app.get("/messages", async (req, res) => {
  const limit = parseInt(req.query.limit);
  const user = req.headers.user;

  try {
    const messages = await db.collection("messages").find().toArray();
    const lastMessages = messages.filter((message) => {
      return (
        message.type === "message" ||
        message.type === "status" ||
        message.to === user ||
        message.from === user
      );
    });
    if (limit > 0) {
      res.send(lastMessages.slice(-limit));
      return;
    }
    res.send(lastMessages);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post("/status", async (req, res) => {
  const user = req.headers.user;

  try {
    const exists = await db.collection("participants").findOne({ name: user });
    if (!exists) {
      res.sendStatus(404);
      return;
    }

    await db
      .collection("participants")
      .updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error);
  }
});

//Inactive users
const getInactiveUsers = async () => {
  const users = await db.collection("participants").find().toArray();
  return users.filter((user) => {
    return Date.now() - user.lastStatus > 10000;
  });
};
setInterval(async () => {
  const inactiveUsers = await getInactiveUsers();

  inactiveUsers.forEach(async (user) => {
    await db.collection("participants").deleteOne({ _id: user._id });
    await db.collection("messages").insertOne({
      from: user.name,
      to: "Todos",
      text: "sai da sala...",
      type: "status",
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
  });
}, 15000);

app.listen(5000, () => console.log("Listening on port 5000!"));

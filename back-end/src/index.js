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

const userSchema = joi.object({
  name: joi.string().required(),
});

app.post("/participants", async (req, res) => {
  let { name } = req.body;

  if (userSchema.validate({ name }, { abortEarly: true }).error) {
    res.status(422).send({ message: "Invalid username" });
    return;
  }

  try {
    //Does this participant name already exists?
    if (await db.collection("participants").findOne({ name: name })) {
      res.status(409).send({ message: "Duplicate participant name" });
      return;
    }

    await db
      .collection("participants")
      .insertOne({ name: name, lastStatus: Date.now() });

    await db.collection("messages").insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(now).format("HH:mm:ss"),
    });

    res.status(201).send("OK");
  } catch (error) {
    res.status(500).send(error);
  }
});

app.listen(5000, () => console.log("Listening on port 5000!"));

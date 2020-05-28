const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { ApolloServer } = require("apollo-server-express");
const { prisma } = require("./generated/prisma-client");
const Mutation = require("./resolvers/Mutation");
const Query = require("./resolvers/Query");
const Custom = require("./resolvers/Custom");
const { importSchema } = require("graphql-import");
require("dotenv").config();
const Sentry = require("@sentry/node");

Sentry.init({
  environment: process.NODE_ENV,
  dsn:
    "https://d9fee5a77a6a4e6ca633668d5dd849dc@o358156.ingest.sentry.io/5257206",
});

myUndefinedFunction();

const app = express();

// enable cors
const corsOptions = {
  origin: process.env.FRONTEND_URL,
  credentials: true,
};

app.use(cors(corsOptions));

// log all requests to the console
if (process.env.SILENCE_LOGS !== "true") {
  app.use(morgan("dev"));
}

app.use(cookieParser());

// decode the JWT so we can get the userId on each request
app.use((req, res, next) => {
  const { token } = req.cookies;

  if (token) {
    const { userId } = jwt.verify(token, process.env.APP_SECRET);
    // put the userId onto the req for future request to access
    req.userId = userId;
  }
  next();
});

// get User from their id
app.use(async (req, res, next) => {
  // if they arent logged in, skip this
  if (!req.userId) {
    return next();
  }

  const user = await server.context().prisma.user(
    {
      id: req.userId,
    },
    "{ id, permissions, email, name }"
  );

  req.user = user;
  next();
});

const typeDefs = importSchema("./src/schema.graphql");

const server = new ApolloServer({
  typeDefs,
  resolvers: {
    Mutation,
    Query,
    ...Custom,
  },
  introspection: true,
  playground: true,
  context: (req) => ({ ...req, prisma }),
});

// TODO: turn cors om properly using middleware above
// graphQL endpoint
server.applyMiddleware({ app, path: "/graphql", cors: false });

app.listen({ port: process.env.PORT }, () => {
  console.log(
    `🚀 Server ready at http://localhost:${process.env.PORT}${
      server.graphqlPath
    }`
  );
});

module.exports = app;

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

const getUser = async (token) => {
  if (!token) return null;

  // decode the JWT so we can get the userId
  const { userId } = jwt.verify(token, process.env.APP_SECRET);

  try {
    const user = await prisma.user(
      {
        id: userId,
      },
      "user { id, permissions }" // TODO: this seems to have no effect. Might need to be in ast format - https://www.prisma.io/blog/graphql-server-basics-demystifying-the-info-argument-in-graphql-resolvers-6f26249f613a
    );

    return {
      id: user.id,
      permissions: user.permissions,
    };
  } catch (error) {
    console.error({ error });
  }
};

Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  dsn: process.env.SENTRY_DSN,
});

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
  context: async ({ req }) => {
    // doing this here instead of in express middleware to follow this - https://www.apollographql.com/docs/apollo-server/security/authentication/
    const { token } = req.cookies;
    const user = await getUser(token);

    return { prisma, res: req.res, user };
  },
});

// TODO: turn cors on properly using middleware above
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

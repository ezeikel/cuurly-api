import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import express from "express";
import http from "http";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";
const morgan = require("morgan"); // BUG: https://github.com/expressjs/morgan/issues/190
import { createContext } from "./context";
import Mutation from "./resolvers/Mutation";
import Query from "./resolvers/Query";
import Custom from "./resolvers/Custom";

dotenv.config();

Sentry.init({
  enabled: process.env.NODE_ENV === "production",
  environment: process.env.NODE_ENV,
  dsn: process.env.SENTRY_DSN,
});

const typeDefs = gql`
  scalar Date
  scalar Upload

  enum Gender {
    MALE
    FEMALE
    NONBINARY
    NOTSPECIFIED
  }

  enum Role {
    USER
    ADMIN
  }

  type SuccessMessage {
    message: String
  }

  type Like {
    id: ID!
    user: User!
    post: Post!
    createdAt: Date!
    updatedAt: Date!
  }

  type Comment {
    id: ID!
    text: String!
    writtenBy: User!
    post: Post!
    createdAt: Date!
    updatedAt: Date!
  }

  type User {
    id: ID!
    firstName: String!
    lastName: String!
    username: String!
    profilePicture: Media
    website: String
    bio: String
    email: String!
    phoneNumber: String
    gender: Gender!
    following: [User!]!
    followers: [User!]!
    verified: Boolean!
    posts: [Post!]!
    likes: [Like!]!
    comments: [Comment!]!
    role: Role!
    createdAt: Date!
    updatedAt: Date!
  }

  type Post {
    id: ID!
    caption: String
    media: [Media!]!
    author: User!
    likes: [Like!]!
    comments: [Comment!]!
    createdAt: Date!
    updatedAt: Date!
  }

  type Media {
    id: ID!
    type: String!
    caption: String
    url: String!
    publicId: String!
    createdAt: Date!
    updatedAt: Date!
  }

  type Query {
    currentUser: User
    # users(
    #   where: UserWhereInput
    #   orderBy: UserOrderByInput
    #   skip: Int
    #   first: Int
    # ): [User!]!
    users: [User!]!
    userz: [User!]! # Just for testing
    user(id: ID, username: String, email: String): User # TODO: Find a way to make it that you have to pass one of these
    following(id: ID, username: String, email: String): [User!]!
    followers(id: ID, username: String, email: String): [User!]!
    profilePicture: Media
    posts: [Post!]!
    post(id: ID!): Post
    feed(id: ID!): [Post!]!
    explore(id: ID!): [Post!]!
    likedPosts(id: ID!): [Post!]!
  }

  type Mutation {
    signup(
      firstName: String!
      lastName: String!
      username: String!
      email: String!
      password: String!
    ): User!
    signin(username: String!, password: String!): User!
    signout: SuccessMessage
    requestReset(email: String!): SuccessMessage
    resetPassword(
      resetToken: String!
      password: String!
      confirmPassword: String!
    ): User!
    follow(id: ID!): User!
    unfollow(id: ID!): User!
    createPost(file: Upload!, caption: String): Post!
    # singleUpload (file: Upload!): File!
    # multipleUpload (files: [Upload!]!): [File!]!
    deletePost(id: ID!, publicId: String!): Post!
    likePost(id: ID!): Like!
    unlikePost(id: ID!): Like!
    addComment(id: ID!, text: String!): Comment!
    deleteComment(id: ID!): Comment!
    updateUser(
      firstName: String
      lastName: String
      username: String
      profilePicture: Upload
      website: String
      bio: String
      email: String
      phoneNumber: String
      gender: String
      oldPassword: String
      password: String
    ): User!
  }
`;

const resolvers = {
  Mutation,
  Query,
  ...Custom,
};

const startApolloServer = async (typeDefs, resolvers) => {
  const app = express();
  const httpServer = http.createServer(app);

  const whitelist = [
    /\.cuurly\.co/,
    /localhost/,
    /studio\.apollographql\.com/,
    /vercel\.app/,
    /bs-local\.com/,
    /airtableblocks\.com/,
  ];

  const corsOptions = {
    origin: (origin, callback) => {
      if (
        whitelist.includes(origin) ||
        whitelist.filter(url => url.test && url.test(origin)).length ||
        !origin
      ) {
        callback(null, true);
      } else {
        console.error(`Not allowed by CORS: ${origin}`);
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    credentials: true,
  };

  app.use(cors(corsOptions));

  // log all requests to the console
  if (process.env.SILENCE_LOGS !== "true") {
    app.use(morgan("dev"));
  }

  app.use(cookieParser());

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    context: async ({ req }) => ({
      ...(await createContext({ req })),
    }),
  });

  await server.start();

  // graphQL endpoint
  server.applyMiddleware({ app, path: "/graphql", cors: false });
  await new Promise<void>(resolve =>
    httpServer.listen({ port: process.env.PORT }, resolve),
  );
  console.log(
    `🚀 Server ready at http://localhost:${process.env.PORT}${server.graphqlPath}`,
  );
};

startApolloServer(typeDefs, resolvers);

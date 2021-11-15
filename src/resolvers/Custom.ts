// const { prisma } = require("../generated/prisma-client");
import { GraphQLScalarType } from "graphql";
import { Kind } from "graphql/language";

const Custom = {
  Date: new GraphQLScalarType({
    name: "Date",
    description: "Date custom scalar type",
    serialize(value) {
      return value.getTime(); // value sent to client
    },
    parseValue(value) {
      return new Date(value); // value from the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(ast.value); // ast value is always in string format
      }
      return null;
    },
  }),
  User: {
    posts: (parent) =>
      prisma.user({ id: parent.id }).posts({ orderBy: "createdAt_DESC" }),
    following: (parent) => prisma.user({ id: parent.id }).following(),
    followers: (parent) => prisma.user({ id: parent.id }).followers(),
    likes: (parent) => prisma.user({ id: parent.id }).likes(),
    comments: (parent) => prisma.user({ id: parent.id }).comments(),
    profilePicture: (parent) => prisma.user({ id: parent.id }).profilePicture(),
  },
  Post: {
    author: (parent) => prisma.post({ id: parent.id }).author(),
    likes: (parent) => prisma.post({ id: parent.id }).likes(),
    comments: (parent) => prisma.post({ id: parent.id }).comments(),
    media: (parent) => prisma.post({ id: parent.id }).media(),
  },
  Like: {
    user: (parent) => prisma.like({ id: parent.id }).user(),
    post: (parent) => prisma.like({ id: parent.id }).post(),
  },
  Comment: {
    writtenBy: (parent) => prisma.comment({ id: parent.id }).writtenBy(),
  },
};

export default Custom;

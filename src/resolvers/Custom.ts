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
  // User: {
  //   posts: (parent, {}, { prisma }) =>
  //     prisma.user.findUnique({ where: { id: parent.id }}).posts({ orderBy: "createdAt_DESC" }),
  //   following: (parent, {}, { prisma }) => prisma.user.findUnique({ where: { id: parent.id }}).following(),
  //   followers: (parent, {}, { prisma }) => prisma.user.findUnique({ where: { id: parent.id }}).followers(),
  //   likes: (parent, {}, { prisma }) => prisma.user.findUnique({ where: { id: parent.id }}).likes(),
  //   comments: (parent, {}, { prisma }) => prisma.user.findUnique({ where: { id: parent.id }}).comments(),
  //   profilePicture: (parent, {}, { prisma }) => prisma.user.findUnique({ where: { id: parent.id }}).profilePicture(),
  // },
  // Post: {
  //   author: (parent, {}, { prisma }) => prisma.post.findUnique({ where: { id: parent.id }}).author(),
  //   likes: (parent, {}, { prisma }) => prisma.post.findUnique({ where: { id: parent.id }}).likes(),
  //   comments: (parent, {}, { prisma }) => prisma.post.findUnique({ where: { id: parent.id }}).comments(),
  //   media: (parent, {}, { prisma }) => prisma.post.findUnique({ where: { id: parent.id }}).media(),
  // },
  // Like: {
  //   user: (parent, {}, { prisma }) => prisma.like.findUnique({ where: { id: parent.id }}).user(),
  //   post: (parent, {}, { prisma }) => prisma.like.findUnique({ where: { id: parent.id }}).post(),
  // },
  // Comment: {
  //   writtenBy: (parent, {}, { prisma }) => prisma.comment.findUnique({ where: { id: parent.id }}).writtenBy(),
  // },
};

export default Custom;

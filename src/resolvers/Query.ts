import { isLoggedIn, hasPermission } from "../utils"

const Query = {
  currentUser: (parent, args, context) => {
    if (!context.user) {
      return null;
    }

    return context.prisma.user.findUnique(
      { where: {
        id: context.user.id,
      }}
    );
  },
  users: (parent, args, context) => {
    isLoggedIn(context.user?.id);

    // hasPermission(context.user.permissions, ["ADMIN", "PERMISSIONUPATE"]);

    // just filtering on username for now until OR is added back for mongo connector - https://github.com/prisma/prisma/issues/3897

    return context.prisma.user.findMany();
  },
  user: (parent, { id, username, email }, context) =>
    context.prisma.user.findUnique({ where: { id, username, email } }),
  userz: (parent, args, context) => context.prisma.user.findMany(),
  following: (parent, { id, username, email }, context) =>
    context.prisma.user.findUnique({ where: { id, username, email }}).following(),
  followers: (parent, { id, username, email }, context) =>
    context.prisma.user.findUnique({ where: { id, username, email }}).followers(),
  posts: (parent, args, context) => context.prisma.user.findMany(),
  post: (parent, { id }, context) => context.prisma.post.findUnique({ where: { id }}),
  feed: async (parent, { id }, { prisma, user: { id: userId } }) => {
    const following = await prisma.user.findUnique({ where: { id }}).following();
    const followingIds = following.map((follower) => follower.id);

    return prisma.post.findMany({
      where: {
        author: { is: { id: { in: [...followingIds, userId] } } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  },
  explore: async (parent, { id }, { prisma, user: { id: userId } }) => {
    const following = await prisma.user.findUnique({ where: { id }}).following();
    const followingIds = following.map((follower) => follower.id);


    return prisma.post.findMany(
      {
        where: {
          author: { isNot: { id: { in: [...followingIds, userId] } } },
        },
        orderBy: {
          createdAt: "desc"
        }
      },
    );
  },
  likedPosts: async (parent, { id }, context) => {
    return context.prisma.like.findMany(
      {
        where: {
          user: { id },
        },
        orderBy: { // TODO: This should be ordered by WHEN liked not when liked post was created
          createdAt: "desc"
        }
      },
    );
  },
};

export default Query;
